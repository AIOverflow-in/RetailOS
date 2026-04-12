'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'
import type { StockAdjustment } from '@/types'
import { fmtDate } from '@/lib/gst'
import TableSkeleton from '@/components/shared/TableSkeleton'
import Pagination from '@/components/shared/Pagination'

const PAGE_SIZE = 20

const reasonLabels: Record<string, string> = {
  damage: 'Damage',
  theft: 'Theft',
  miscount: 'Miscount',
  physical_count: 'Physical Count',
  other: 'Other',
}

export default function AdjustmentsPage() {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const load = useCallback(() => {
    setLoading(true)
    api.listStockAdjustments(page, PAGE_SIZE)
      .then(d => {
        setAdjustments(d.adjustments ?? [])
        setTotal(d.total)
      })
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">

      <div className="flex items-center gap-4">
        <Link
          href="/inventory"
          className="flex items-center gap-1.5 text-body-sm text-[#AAAAAA] hover:text-[#111] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Inventory
        </Link>
      </div>

      <div>
        <h1 className="text-heading-xl font-bold tracking-tight text-[#111]">Stock Adjustments</h1>
        <p className="text-body text-[#999] mt-0.5">
          {loading ? 'Loading\u2026' : `${total} adjustments`}
        </p>
      </div>

      {loading ? (
        <TableSkeleton cols={6} />
      ) : adjustments.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#EBEBEB] py-20 text-center">
          <p className="text-body text-[#AAAAAA]">No stock adjustments yet.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-[#EBEBEB] overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F2F2F2]">
                  {['Product', 'Batch', 'Change', 'Reason', 'Notes', 'Date'].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-caption font-medium text-[#BBBBBB] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {adjustments.map(a => (
                  <tr key={a.adjustment_id} className="border-b border-[#F7F7F7] last:border-0 hover:bg-[#FAFAFA] transition-colors">
                    <td className="py-3 px-4 text-body font-medium text-[#111]">{a.product_name}</td>
                    <td className="py-3 px-4 text-body-sm text-[#999] font-mono">{a.batch_no}</td>
                    <td className="py-3 px-4">
                      <span className={`text-body font-medium ${a.qty_change > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {a.qty_change > 0 ? '+' : ''}{a.qty_change}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-body text-[#888]">{reasonLabels[a.reason] ?? a.reason}</td>
                    <td className="py-3 px-4 text-body-sm text-[#999] max-w-[200px] truncate">{a.notes ?? '\u2014'}</td>
                    <td className="py-3 px-4 text-body-sm text-[#999] whitespace-nowrap">{fmtDate(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            total={total}
            limit={PAGE_SIZE}
            onChange={p => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          />
        </>
      )}
    </div>
  )
}
