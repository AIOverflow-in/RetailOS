'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, MessageCircle, Printer,
  Pencil, Trash2, Check, X, Plus, Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { OrderDetail, ShopSettings, OrderItem, GSTRate } from '@/types'
import { fmtCurrency, fmtDate, GST_RATES } from '@/lib/gst'
import { buildBillData, generateBill, sendBillViaWhatsApp } from '@/lib/generateBill'
import { useProductSearch } from '@/lib/useProductSearch'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import EditQuantityDialog from '@/components/EditQuantityDialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface BatchOption {
  batch_id: string; batch_no: string; expiry_date: string
  mrp: number; selling_price: number; available_stock: number
  purchase_gst_rate?: number | null
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<OrderDetail | null>(null)
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [returning, setReturning] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [editingItem, setEditingItem] = useState<OrderItem | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const { query, suggestions, loading: searchLoading, handleQuery, triggerPreload, setQuery, setSuggestions } = useProductSearch()
  const [addProduct, setAddProduct] = useState<{ product_id: string; name: string } | null>(null)
  const [addBatches, setAddBatches] = useState<BatchOption[]>([])
  const [addBatch, setAddBatch] = useState<BatchOption | null>(null)
  const [addQty, setAddQty] = useState(1)
  const [addPrice, setAddPrice] = useState(0)
  const [addGst, setAddGst] = useState<GSTRate>(0)

  function load() {
    api.getOrder(id).then(setData).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    api.getSettings().then(setSettings)
  }, [id])

  async function handleReturn() {
    setReturning(true)
    try {
      await api.returnOrder(id)
      toast.success('Order returned — stock restored')
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Return failed')
    } finally {
      setReturning(false)
    }
  }

  async function deleteItem(item: OrderItem) {
    setSubmitting(true)
    try {
      await api.editOrder(id, {
        edits: [{ item_id: item.item_id, new_qty: 0 }],
        additions: [],
        comment: '',
      })
      toast.success(`${item.product_name} returned`)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Return failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function selectAddProduct(p: { product_id: string; name: string }) {
    setAddProduct(p)
    setQuery(p.name)
    setSuggestions([])
    const bs = (await api.listActiveBatches(p.product_id)) ?? []
    setAddBatches(bs as BatchOption[])
    if (bs.length === 1) selectAddBatch(bs[0] as BatchOption)
  }

  function selectAddBatch(b: BatchOption) {
    setAddBatch(b)
    setAddPrice(b.selling_price)
    setAddGst((b.purchase_gst_rate as GSTRate) ?? 0)
    setAddQty(1)
  }

  function resetAdd() {
    setAddOpen(false)
    setAddProduct(null)
    setAddBatch(null)
    setAddBatches([])
    setQuery('')
    setSuggestions([])
    setAddQty(1)
    setAddPrice(0)
    setAddGst(0)
  }

  async function submitAdd() {
    if (!addProduct || !addBatch) return
    setSubmitting(true)
    try {
      await api.editOrder(id, {
        edits: [],
        additions: [{
          batch_id: addBatch.batch_id,
          product_name: addProduct.name,
          batch_no: addBatch.batch_no,
          qty: addQty,
          sale_price: addPrice,
          gst_rate: addGst,
        }],
        comment: '',
      })
      toast.success('Item added')
      resetAdd()
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Add failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="max-w-2xl space-y-4">
      <Skeleton className="h-8 w-48 bg-[#F2F2F2]" />
      <Skeleton className="h-28 w-full rounded-lg bg-[#F2F2F2]" />
      <Skeleton className="h-56 w-full rounded-lg bg-[#F2F2F2]" />
    </div>
  )

  if (!data) return <p className="text-body text-[#AAAAAA]">Order not found.</p>

  const { order, items } = data

  const statusColor = order.status === 'active' ? 'text-emerald-600'
    : order.status === 'returned' ? 'text-amber-500'
    : order.status === 'partially_returned' ? 'text-orange-500'
    : 'text-[#CCCCCC]'

  const editable = order.status === 'active' || order.status === 'partially_returned'
  const anyReturned = items.some(i => i.returned_qty > 0)

  return (
    <div className="max-w-4xl space-y-5">

      {/* Nav bar */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-body-sm font-medium border border-[#E0E0E0] rounded-lg px-3 h-8 text-[#555555] hover:bg-[#F5F5F5] hover:border-[#C8C8C8] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <div className="flex items-center gap-2">
          {order.status === 'active' && (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <button className="h-8 px-3 text-body-sm font-medium border border-amber-300 text-amber-600 rounded-lg hover:bg-amber-50 transition-colors">
                    Return Order
                  </button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Return {order.order_number}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark the order as returned and restore all stock to the respective batches.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-amber-500 text-white hover:bg-amber-600"
                    onClick={handleReturn}
                  >
                    {returning ? 'Returning…' : 'Confirm Return'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {order.customer_phone && (
            <Tooltip content="Send bill via WhatsApp">
              <button
                onClick={async () => {
                  if (!data || !settings) return
                  const shopName = localStorage.getItem('shop_name') ?? ''
                  await sendBillViaWhatsApp(buildBillData(data, settings, shopName))
                }}
                className="flex items-center gap-1.5 text-body-sm font-medium border border-[#E0E0E0] rounded-lg px-3 h-8 text-[#555555] hover:bg-[#F5F5F5] hover:border-[#C8C8C8] transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Send Bill
              </button>
            </Tooltip>
          )}
          <Tooltip content="Generate PDF bill">
            <button
              onClick={async () => {
                if (!data || !settings) return
                const shopName = localStorage.getItem('shop_name') ?? ''
                await generateBill(buildBillData(data, settings, shopName))
              }}
              className="flex items-center gap-1.5 text-body-sm font-medium border border-[#E0E0E0] rounded-lg px-3 h-8 text-[#555555] hover:bg-[#F5F5F5] hover:border-[#C8C8C8] transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-heading-lg font-bold tracking-tight text-[#111] font-mono">{order.order_number}</h1>
        <p className="text-body text-[#999] mt-0.5 flex items-center gap-3 flex-wrap">
          <span>{fmtDate(order.created_at)}</span>
          <span className={`text-body-sm font-medium ${statusColor}`}>
            {'●'} {order.status.replace('_', ' ')}
          </span>
          <span className="text-body-sm text-[#888] capitalize">{order.payment_mode ?? 'cash'}</span>
          {order.updated_at && (
            <span className="text-body-sm text-[#888]">Last edited: {fmtDate(order.updated_at)}</span>
          )}
        </p>
        {order.return_comment && (
          <div className="mt-2 px-3 py-2 bg-[#FFF8EB] border border-amber-200 rounded-lg text-body-sm text-[#7A5A0E]">
            <span className="font-medium">Note: </span>{order.return_comment}
          </div>
        )}
      </div>

      {/* Customer card */}
      {order.customer_name && (
        <div className="bg-white rounded-lg border border-[#EBEBEB] px-5 py-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-caption font-medium text-label mb-1">Customer</p>
            <p className="text-body font-medium text-[#111]">{order.customer_name}</p>
          </div>
          {order.customer_phone && (
            <div>
              <p className="text-caption font-medium text-label mb-1">Phone</p>
              <p className="text-body font-medium text-[#111]">{order.customer_phone}</p>
            </div>
          )}
        </div>
      )}

      {/* Add Product button */}
      {editable && (
        <div className="flex justify-end print:hidden">
          <button
            onClick={() => setAddOpen(v => !v)}
            className="flex items-center gap-1.5 h-9 px-4 text-body-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Product
          </button>
        </div>
      )}

      {/* Line items */}
      <div className="bg-white rounded-lg border border-[#EBEBEB] overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F2F2F2]">
              {(() => {
                const cols = ['Product', 'Batch', 'Qty']
                if (anyReturned) cols.push('Returned')
                cols.push('Sale Price', 'GST', 'Total')
                if (editable) cols.push('Action')
                return cols.map(h => (
                  <th key={h} className="text-left py-2.5 px-4 text-caption font-medium text-label">{h}</th>
                ))
              })()}
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const active = item.qty - item.returned_qty
              const fullyReturned = active === 0
              return (
                <tr key={item.item_id} className={`border-b border-[#F7F7F7] last:border-0 ${fullyReturned ? 'opacity-50' : 'hover:bg-[#FAFAFA]'}`}>
                  <td className="py-3 px-4 text-body font-medium text-[#111]">{item.product_name}</td>
                  <td className="py-3 px-4 text-body-sm text-[#999] font-mono">{item.batch_no}</td>
                  <td className="py-3 px-4 text-body text-[#555]">{item.qty}</td>
                  {anyReturned && (
                    <td className="py-3 px-4 text-body text-amber-600">{item.returned_qty || '—'}</td>
                  )}
                  <td className="py-3 px-4 text-body text-[#555]">{fmtCurrency(item.sale_price)}</td>
                  <td className="py-3 px-4 text-body-sm text-[#999]">{item.gst_rate}%</td>
                  <td className="py-3 px-4 text-body font-medium text-[#111]">{fmtCurrency(item.line_total)}</td>
                  {editable && (
                    <td className="py-3 px-4 print:hidden">
                      {!fullyReturned ? (
                        <div className="flex items-center gap-1.5">
                          <Tooltip content="Edit quantity">
                            <button
                              onClick={() => { setEditingItem(item); setEditOpen(true) }}
                              disabled={submitting}
                              className="h-7 w-7 flex items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                          <AlertDialog>
                            <AlertDialogTrigger
                              render={
                                <button
                                  disabled={submitting}
                                  className="h-7 w-7 flex items-center justify-center rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              }
                            />
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Return {item.product_name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  All {active} unit(s) of this item will be returned and stock restored.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-500 text-white hover:bg-red-600"
                                  onClick={() => deleteItem(item)}
                                >
                                  Confirm Return
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ) : (
                        <span className="text-caption text-[#AAA]">returned</span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}

            {/* Inline add row */}
            {addOpen && editable && (
              <tr className="border-t border-[#F2F2F2] bg-[#FAFCFF] align-top">
                <td className="py-3 px-4" colSpan={anyReturned ? 7 : 6}>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-caption text-label">Product</span>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CCC] pointer-events-none" />
                        <input
                          className="h-9 px-3 pl-9 w-56 text-body border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#999] transition-colors"
                          placeholder="Search product…"
                          value={query}
                          onChange={e => handleQuery(e.target.value)}
                          onFocus={() => triggerPreload()}
                          autoFocus
                        />
                        {(suggestions.length > 0 || searchLoading) && (
                          <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white border border-[#EBEBEB] rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                            {searchLoading && suggestions.length === 0 && (
                              <p className="px-4 py-2.5 text-body-sm text-label">Searching…</p>
                            )}
                            {suggestions.map(p => (
                              <button
                                key={p.product_id}
                                type="button"
                                className="w-full text-left px-4 py-2 hover:bg-[#F7F7F7] transition-colors border-b border-[#F5F5F5] last:border-0"
                                onMouseDown={e => { e.preventDefault(); selectAddProduct(p) }}
                              >
                                <p className="text-body font-medium text-[#111]">{p.name}</p>
                                <p className="text-caption text-[#999]">{p.company_name}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {addBatches.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-caption text-label">Batch</span>
                        <select
                          className="h-9 px-3 w-48 text-body border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#999]"
                          value={addBatch?.batch_id ?? ''}
                          onChange={e => {
                            const b = addBatches.find(b => b.batch_id === e.target.value)
                            if (b) selectAddBatch(b)
                          }}
                        >
                          <option value="">Select batch…</option>
                          {addBatches.map(b => (
                            <option key={b.batch_id} value={b.batch_id}>
                              {b.batch_no} · stock {b.available_stock}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {addBatch && (
                      <>
                        <div className="flex flex-col gap-1">
                          <span className="text-caption text-label">Qty</span>
                          <input
                            type="number" min={1} max={addBatch.available_stock}
                            className="h-9 px-3 w-16 text-body text-right border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#999]"
                            value={addQty}
                            onChange={e => setAddQty(Math.max(1, Math.min(addBatch.available_stock, parseInt(e.target.value) || 1)))}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-caption text-label">Sale Price</span>
                          <input
                            type="number" min={0} step={0.01}
                            className="h-9 px-3 w-24 text-body text-right border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#999]"
                            value={addPrice || ''}
                            onChange={e => setAddPrice(parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-caption text-label">GST</span>
                          <select
                            className="h-9 px-3 w-20 text-body border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#999]"
                            value={String(addGst)}
                            onChange={e => setAddGst(parseInt(e.target.value) as GSTRate)}
                          >
                            {GST_RATES.map(r => (
                              <option key={r} value={String(r)}>{r}%</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    <div className="ml-auto flex items-end gap-1.5">
                      <Tooltip content="Save">
                        <button
                          onClick={submitAdd}
                          disabled={submitting || !addBatch || addQty < 1}
                          className="h-9 w-9 flex items-center justify-center rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </Tooltip>
                      <Tooltip content="Cancel">
                        <button
                          onClick={resetAdd}
                          className="h-9 w-9 flex items-center justify-center rounded border border-[#E0E0E0] text-[#888] hover:bg-[#F5F5F5] transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="bg-white rounded-lg border border-[#EBEBEB] px-5 py-4 space-y-2">
        {order.cgst_total > 0 && (
          <>
            <div className="flex justify-between text-body text-[#888]">
              <span>CGST</span><span>{fmtCurrency(order.cgst_total)}</span>
            </div>
            <div className="flex justify-between text-body text-[#888]">
              <span>SGST</span><span>{fmtCurrency(order.sgst_total)}</span>
            </div>
          </>
        )}
        {order.igst_total > 0 && (
          <div className="flex justify-between text-body text-[#888]">
            <span>IGST</span><span>{fmtCurrency(order.igst_total)}</span>
          </div>
        )}
        <div className="flex justify-between text-subtitle-lg font-bold text-[#111] pt-2 border-t border-[#F2F2F2]">
          <span>Total</span><span>{fmtCurrency(order.total_amount)}</span>
        </div>
      </div>

      <EditQuantityDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        orderId={id}
        item={editingItem}
        onSuccess={load}
      />
    </div>
  )
}
