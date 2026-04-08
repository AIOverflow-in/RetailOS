'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import { api } from '@/lib/api'
import type { InventoryRow } from '@/types'
import { fmtCurrency, fmtDate } from '@/lib/gst'
import TableSkeleton from '@/components/shared/TableSkeleton'
import Pagination from '@/components/shared/Pagination'

const PAGE_SIZE = 20

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    api.listInventory().then(d => setRows(d ?? [])).finally(() => setLoading(false))
  }, [])

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
          <h1 className="text-[30px] font-bold tracking-tight text-[#111]">Inventory</h1>
          <p className="text-[13px] text-[#999] mt-0.5">
            {loading ? 'Loading…' : `${rows.length} batches`}
          </p>
        </div>
        <Link
          href="/inventory/add"
          className="mt-2 flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Add Stock
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CCCCCC]" />
        <input
          className="w-full h-9 pl-9 pr-4 text-[13px] bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCCCCC] transition-colors placeholder:text-[#CCCCCC]"
          placeholder="Search product, company, batch…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <TableSkeleton cols={8} />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#EBEBEB] py-20 text-center">
          <p className="text-[13px] text-[#AAAAAA]">
            {q ? 'No results found.' : 'No stock yet. Add your first batch.'}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-[#EBEBEB] overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F2F2F2]">
                  {['Product', 'Company', 'Batch', 'Expiry', 'MRP', 'Selling', 'Stock', 'HSN'].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-[11px] font-medium text-[#BBBBBB] whitespace-nowrap">
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
                      <td className="py-3 px-4 text-[13px] font-medium text-[#111]">{r.name}</td>
                      <td className="py-3 px-4 text-[13px] text-[#888]">{r.company_name}</td>
                      <td className="py-3 px-4 text-[12px] text-[#999] font-mono">{r.batch_no}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`text-[12px] ${expired ? 'text-red-500' : expiring ? 'text-amber-500' : 'text-[#999]'}`}>
                          {(expired || expiring) && <span className="mr-1">●</span>}
                          {fmtDate(r.expiry_date)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[13px] text-[#888]">{fmtCurrency(r.mrp)}</td>
                      <td className="py-3 px-4 text-[13px] font-medium text-[#111]">{fmtCurrency(r.selling_price)}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[12px] font-medium ${
                          r.available_stock === 0 ? 'text-red-500' :
                          r.available_stock < 10 ? 'text-amber-500' : 'text-[#555]'
                        }`}>
                          {r.available_stock}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[12px] text-[#CCCCCC] font-mono">{r.hsn_code ?? '—'}</td>
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
    </div>
  )
}
