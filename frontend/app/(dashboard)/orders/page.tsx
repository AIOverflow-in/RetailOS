'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { Order } from '@/types'
import { fmtCurrency, fmtDate } from '@/lib/gst'
import TableSkeleton from '@/components/shared/TableSkeleton'
import Pagination from '@/components/shared/Pagination'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const PAGE_SIZE = 20

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listOrders(q, page, PAGE_SIZE)
      setOrders(res.orders ?? [])
      setTotal(Number(res.total) ?? 0)
    } finally {
      setLoading(false)
    }
  }, [q, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [q])

  async function deleteOrder(id: string) {
    setDeleting(id)
    try {
      await api.deleteOrder(id)
      toast.success('Order deleted')
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-6">

      {/* Page title */}
      <div>
        <h1 className="text-heading-xl font-bold tracking-tight text-[#111]">Orders</h1>
        <p className="text-body text-[#999] mt-0.5">
          {loading ? 'Loading…' : `${total.toLocaleString()} total orders`}
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CCCCCC]" />
        <input
          className="w-full h-9 pl-9 pr-4 text-body bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCCCCC] transition-colors placeholder:text-[#CCCCCC]"
          placeholder="Search bill no, name, phone…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <TableSkeleton cols={6} />
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#EBEBEB] py-20 text-center">
          <p className="text-body text-[#AAAAAA]">
            {q ? 'No results found.' : 'No orders yet.'}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-[#EBEBEB] overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F2F2F2]">
                  {['Bill No', 'Customer', 'Phone', 'Date', 'Total', 'Payment', 'Status', ''].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-caption font-medium text-label whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.order_id} className="border-b border-[#F7F7F7] last:border-0 hover:bg-[#FAFAFA] transition-colors">
                    <td className="py-3 px-4 font-mono text-body-sm font-medium text-[#111]">{o.order_number}</td>
                    <td className="py-3 px-4 text-body font-medium text-[#111]">
                      {o.customer_name ?? <span className="text-[#CCCCCC]">—</span>}
                    </td>
                    <td className="py-3 px-4 text-body text-[#888]">{o.customer_phone ?? '—'}</td>
                    <td className="py-3 px-4 text-body text-[#888] whitespace-nowrap">{fmtDate(o.created_at)}</td>
                    <td className="py-3 px-4 text-body font-medium text-[#111]">{fmtCurrency(o.total_amount)}</td>
                    <td className="py-3 px-4">
                      <span className="text-body-sm text-[#888] capitalize">{o.payment_mode ?? 'cash'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-body-sm font-medium ${
                        o.status === 'active' ? 'text-emerald-600' :
                        o.status === 'returned' ? 'text-amber-500' : 'text-[#CCCCCC]'
                      }`}>
                        {'\u25CF'} {o.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-4">
                        <Link
                          href={`/orders/${o.order_id}`}
                          className="text-body-sm font-medium border border-[#E0E0E0] rounded-md px-2 py-0.5 text-[#555555] hover:bg-[#F5F5F5] hover:border-[#C8C8C8] transition-colors"
                        >
                          View
                        </Link>
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <button className="text-body-sm font-medium border border-red-200 rounded-md px-2 py-0.5 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors">
                                Delete
                              </button>
                            }
                          />
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {o.order_number}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will delete the order and restore stock to the respective batches.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-500 text-white hover:bg-red-600"
                                onClick={() => deleteOrder(o.order_id)}
                              >
                                {deleting === o.order_id ? 'Deleting…' : 'Delete'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
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
