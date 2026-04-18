'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { OrderDetail, ShopSettings } from '@/types'
import { fmtCurrency, fmtDate } from '@/lib/gst'
import { buildBillData, generateBill } from '@/lib/generateBill'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<OrderDetail | null>(null)
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [returning, setReturning] = useState(false)

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
    } catch (err: any) {
      toast.error(err.message || 'Return failed')
    } finally {
      setReturning(false)
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
    : 'text-[#CCCCCC]'

  return (
    <div className="max-w-2xl space-y-5">

      {/* Nav bar */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-body-sm text-[#AAAAAA] hover:text-[#111] transition-colors"
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
                    {returning ? 'Returning\u2026' : 'Confirm Return'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <button
            onClick={async () => {
              if (!data || !settings) return
              const shopName = localStorage.getItem('shop_name') ?? ''
              await generateBill(buildBillData(data, settings, shopName))
            }}
            className="flex items-center gap-1.5 text-body-sm text-[#AAAAAA] hover:text-[#111] transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
        </div>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-heading-lg font-bold tracking-tight text-[#111] font-mono">{order.order_number}</h1>
        <p className="text-body text-[#999] mt-0.5 flex items-center gap-3">
          <span>{fmtDate(order.created_at)}</span>
          <span className={`text-body-sm font-medium ${statusColor}`}>
            {'\u25CF'} {order.status}
          </span>
          <span className="text-body-sm text-[#888] capitalize">{order.payment_mode ?? 'cash'}</span>
        </p>
      </div>

      {/* Customer card */}
      {order.customer_name && (
        <div className="bg-white rounded-lg border border-[#EBEBEB] px-5 py-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-caption font-medium text-[#BBBBBB] mb-1">Customer</p>
            <p className="text-body font-medium text-[#111]">{order.customer_name}</p>
          </div>
          {order.customer_phone && (
            <div>
              <p className="text-caption font-medium text-[#BBBBBB] mb-1">Phone</p>
              <p className="text-body font-medium text-[#111]">{order.customer_phone}</p>
            </div>
          )}
        </div>
      )}

      {/* Line items */}
      <div className="bg-white rounded-lg border border-[#EBEBEB] overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F2F2F2]">
              {['Product', 'Batch', 'Qty', 'Sale Price', 'GST', 'Total'].map(h => (
                <th key={h} className="text-left py-2.5 px-4 text-caption font-medium text-[#BBBBBB]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.item_id} className="border-b border-[#F7F7F7] last:border-0 hover:bg-[#FAFAFA]">
                <td className="py-3 px-4 text-body font-medium text-[#111]">{item.product_name}</td>
                <td className="py-3 px-4 text-body-sm text-[#999] font-mono">{item.batch_no}</td>
                <td className="py-3 px-4 text-body text-[#555]">{item.qty}</td>
                <td className="py-3 px-4 text-body text-[#555]">{fmtCurrency(item.sale_price)}</td>
                <td className="py-3 px-4 text-body-sm text-[#999]">{item.gst_rate}%</td>
                <td className="py-3 px-4 text-body font-medium text-[#111]">{fmtCurrency(item.line_total)}</td>
              </tr>
            ))}
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
    </div>
  )
}
