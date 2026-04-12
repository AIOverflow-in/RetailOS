'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, Pencil } from 'lucide-react'
import { api } from '@/lib/api'
import type { Customer } from '@/types'
import { fmtDate } from '@/lib/gst'
import TableSkeleton from '@/components/shared/TableSkeleton'
import Pagination from '@/components/shared/Pagination'
import EditCustomerModal from '@/components/customers/EditCustomerModal'

const PAGE_SIZE = 20

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  // Edit modal state
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const fetchCustomers = useCallback(() => {
    setLoading(true)
    api.listCustomers(q, page, PAGE_SIZE)
      .then(d => {
        setCustomers(d.customers ?? [])
        setTotal(d.total)
      })
      .finally(() => setLoading(false))
  }, [q, page])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  useEffect(() => { setPage(1) }, [q])

  return (
    <div className="space-y-6">

      {/* Page title */}
      <div>
        <h1 className="text-heading-xl font-bold tracking-tight text-[#111]">Customers</h1>
        <p className="text-body text-[#999] mt-0.5">
          {loading ? 'Loading\u2026' : `${total} customers`}
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CCCCCC]" />
        <input
          className="w-full h-9 pl-9 pr-4 text-body bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCCCCC] transition-colors placeholder:text-[#CCCCCC]"
          placeholder="Search by name or phone\u2026"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <TableSkeleton cols={6} />
      ) : customers.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#EBEBEB] py-20 text-center">
          <p className="text-body text-[#AAAAAA]">
            {q ? 'No customers found.' : 'No customers yet.'}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-[#EBEBEB] overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F2F2F2]">
                  {['Name', 'Phone', 'Age', 'Visits', 'Joined', ''].map(h => (
                    <th key={h || 'actions'} className="text-left py-2.5 px-4 text-caption font-medium text-[#BBBBBB] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr
                    key={c.customer_id}
                    className="border-b border-[#F7F7F7] last:border-0 hover:bg-[#FAFAFA] transition-colors"
                  >
                    <td className="py-3 px-4 text-body font-medium text-[#111]">{c.name}</td>
                    <td className="py-3 px-4 text-body text-[#888] font-mono">{c.phone}</td>
                    <td className="py-3 px-4 text-body text-[#999]">{c.age ?? '\u2014'}</td>
                    <td className="py-3 px-4 text-body text-[#999]">{c.visit_count}</td>
                    <td className="py-3 px-4 text-body-sm text-[#999]">{fmtDate(c.created_at)}</td>
                    <td className="py-3 px-2">
                      <button
                        onClick={() => { setEditCustomer(c); setEditOpen(true) }}
                        className="p-1.5 rounded-md text-[#CCCCCC] hover:text-[#555] hover:bg-[#F2F2F2] transition-colors"
                        title="Edit customer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
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

      <EditCustomerModal
        customer={editCustomer}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={fetchCustomers}
      />
    </div>
  )
}
