'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Search, Pencil, SlidersHorizontal, PackageMinus } from 'lucide-react'
import { api } from '@/lib/api'
import type { InventoryRow } from '@/types'
import { fmtCurrency, fmtDate } from '@/lib/gst'
import TableSkeleton from '@/components/shared/TableSkeleton'
import Pagination from '@/components/shared/Pagination'
import EditProductModal from '@/components/inventory/EditProductModal'
import EditBatchModal from '@/components/inventory/EditBatchModal'
import StockAdjustmentModal from '@/components/inventory/StockAdjustmentModal'

const PAGE_SIZE = 20

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  // Edit product modal state
  const [editProduct, setEditProduct] = useState<{
    product_id: string; name: string; company_name: string; sku: string | null; hsn_code: string | null
  } | null>(null)
  const [editProductOpen, setEditProductOpen] = useState(false)

  // Edit batch modal state
  const [editBatch, setEditBatch] = useState<{
    batch_id: string; batch_no: string; buying_price: number; selling_price: number;
    mrp: number; expiry_date: string; purchase_qty: number; sold_qty: number; box_no: string | null;
    purchase_gst_rate: number | null; landing_price: number | null;
    distributor_details: { name?: string; location?: string; phone?: string; invoice_no?: string } | null
  } | null>(null)
  const [editBatchOpen, setEditBatchOpen] = useState(false)

  // Stock adjustment modal state
  const [adjustBatch, setAdjustBatch] = useState<{
    batch_id: string; batch_no: string; name: string;
    purchase_qty: number; sold_qty: number; available_stock: number
  } | null>(null)
  const [adjustOpen, setAdjustOpen] = useState(false)

  const fetchInventory = useCallback(() => {
    setLoading(true)
    api.listInventory().then(d => {
      setRows(d ?? [])
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchInventory() }, [fetchInventory])

  useEffect(() => { setPage(1) }, [q])

  const filtered = rows?.filter(r =>
    q === '' ||
    r.name.toLowerCase().includes(q.toLowerCase()) ||
    r.company_name.toLowerCase().includes(q.toLowerCase()) ||
    (r.batch_no ?? '').toLowerCase().includes(q.toLowerCase())
  )

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const isExpiringSoon = (date: string) => {
    const diff = new Date(date).getTime() - Date.now()
    return diff > 0 && diff < 60 * 24 * 60 * 60 * 1000
  }
  const isExpired = (date: string) => new Date(date) <= new Date()

  return (
    <div className="space-y-6">

      {/* Page title */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-heading-xl font-bold tracking-tight text-[#111]">Inventory</h1>
          <p className="text-body text-[#999] mt-0.5">
            {loading ? 'Loading\u2026' : `${filtered.length} batches`}
          </p>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Link
            href="/inventory/adjustments"
            className="flex items-center gap-1.5 h-8 px-3 text-body-sm font-medium border border-[#E5E5E5] text-[#888] rounded-lg hover:border-[#CCC] hover:text-[#111] transition-colors shrink-0"
          >
            Adjustment History
          </Link>
          <Link
            href="/inventory/add"
            className="flex items-center gap-1.5 h-8 px-3 text-body-sm font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Add Stock
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CCCCCC]" />
        <input
          className="w-full h-9 pl-9 pr-4 text-body bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCCCCC] transition-colors placeholder:text-[#CCCCCC]"
          placeholder="Search product, company, batch\u2026"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <TableSkeleton cols={9} />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#EBEBEB] py-20 text-center">
          <p className="text-body text-[#AAAAAA]">
            {q ? 'No results found.' : 'No stock yet. Add your first batch.'}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-[#EBEBEB] overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F2F2F2]">
                  {['Product', 'Company', 'Batch', 'Expiry', 'MRP', 'Selling', 'Stock', 'HSN', ''].map(h => (
                    <th key={h || 'actions'} className="text-left py-2.5 px-4 text-caption font-medium text-[#BBBBBB] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(r => {
                  const expired = isExpired(r.expiry_date)
                  const expiring = !expired && isExpiringSoon(r.expiry_date)
                  return (
                    <tr
                      key={r.batch_id}
                      className={`border-b border-[#F7F7F7] last:border-0 hover:bg-[#FAFAFA] transition-colors ${expired ? 'opacity-40' : ''}`}
                    >
                      <td className="py-3 px-4 text-body font-medium text-[#111]">{r.name}</td>
                      <td className="py-3 px-4 text-body text-[#888]">{r.company_name}</td>
                      <td className="py-3 px-4 text-body-sm text-[#999] font-mono">{r.batch_no}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`text-body-sm ${expired ? 'text-red-500' : expiring ? 'text-amber-500' : 'text-[#999]'}`}>
                          {(expired || expiring) && <span className="mr-1">{'\u25CF'}</span>}
                          {fmtDate(r.expiry_date)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-body text-[#888]">{fmtCurrency(r.mrp)}</td>
                      <td className="py-3 px-4 text-body font-medium text-[#111]">{fmtCurrency(r.selling_price)}</td>
                      <td className="py-3 px-4">
                        <span className={`text-body-sm font-medium ${
                          r.available_stock === 0 ? 'text-red-500' :
                          r.available_stock < 10 ? 'text-amber-500' : 'text-[#555]'
                        }`}>
                          {r.available_stock}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-body-sm text-[#CCCCCC] font-mono">{r.hsn_code ?? '\u2014'}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => {
                              setEditProduct({
                                product_id: r.product_id,
                                name: r.name,
                                company_name: r.company_name,
                                sku: r.sku,
                                hsn_code: r.hsn_code,
                              })
                              setEditProductOpen(true)
                            }}
                            className="p-1.5 rounded-md text-[#CCCCCC] hover:text-[#555] hover:bg-[#F2F2F2] transition-colors"
                            title="Edit product"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditBatch({
                                batch_id: r.batch_id,
                                batch_no: r.batch_no,
                                buying_price: r.buying_price,
                                selling_price: r.selling_price,
                                mrp: r.mrp,
                                expiry_date: r.expiry_date,
                                purchase_qty: r.purchase_qty,
                                sold_qty: r.sold_qty,
                                box_no: r.box_no,
                                purchase_gst_rate: r.purchase_gst_rate ?? null,
                                landing_price: r.landing_price ?? null,
                                distributor_details: r.distributor_details ?? null,
                              })
                              setEditBatchOpen(true)
                            }}
                            className="p-1.5 rounded-md text-[#CCCCCC] hover:text-[#555] hover:bg-[#F2F2F2] transition-colors"
                            title="Edit batch"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setAdjustBatch({
                                batch_id: r.batch_id,
                                batch_no: r.batch_no,
                                name: r.name,
                                purchase_qty: r.purchase_qty,
                                sold_qty: r.sold_qty,
                                available_stock: r.available_stock,
                              })
                              setAdjustOpen(true)
                            }}
                            className="p-1.5 rounded-md text-[#CCCCCC] hover:text-[#555] hover:bg-[#F2F2F2] transition-colors"
                            title="Adjust stock"
                          >
                            <PackageMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            total={filtered.length}
            limit={PAGE_SIZE}
            onChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          />
        </>
      )}

      <EditProductModal
        product={editProduct}
        open={editProductOpen}
        onOpenChange={setEditProductOpen}
        onSaved={fetchInventory}
      />

      <EditBatchModal
        batch={editBatch}
        open={editBatchOpen}
        onOpenChange={setEditBatchOpen}
        onSaved={fetchInventory}
      />

      <StockAdjustmentModal
        batch={adjustBatch}
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        onSaved={fetchInventory}
      />
    </div>
  )
}
