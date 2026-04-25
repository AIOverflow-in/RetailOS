'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Search, ArrowUp, ArrowDown, Check } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { Order } from '@/types'
import { fmtCurrency, fmtDate } from '@/lib/gst'
import TableSkeleton from '@/components/shared/TableSkeleton'
import Pagination from '@/components/shared/Pagination'
import { Tooltip } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const PAGE_SIZE = 20

type PaymentMode = 'cash' | 'upi' | 'card' | 'mixed'
type OrderStatus = 'active' | 'returned' | 'partially_returned'
type SortField = 'date' | 'total'
type SortDir = 'asc' | 'desc'

const PAYMENT_OPTIONS: { value: PaymentMode; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'mixed', label: 'Mixed' },
]

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'returned', label: 'Returned' },
  { value: 'partially_returned', label: 'Partially returned' },
]

function MultiSelectFilter<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  selected: Set<T>
  onChange: (next: Set<T>) => void
}) {
  const [open, setOpen] = useState(false)
  const count = selected.size
  const display =
    count === 0
      ? label
      : count === 1
        ? (options.find(o => selected.has(o.value))?.label ?? label)
        : `${label} (${count})`

  function toggle(value: T) {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    onChange(next)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={`flex items-center gap-1 h-8 px-3 text-body-sm border rounded-lg transition-colors bg-white ${
          count > 0
            ? 'border-[#111] text-[#111]'
            : 'border-[#E5E5E5] text-[#555] hover:border-[#CCC]'
        }`}
      >
        {display}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="max-h-64 overflow-y-auto">
          {options.map(opt => {
            const checked = selected.has(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-body-sm text-[#333] hover:bg-[#F2F2F2] rounded transition-colors text-left"
              >
                <span className="w-4 h-4 inline-flex items-center justify-center border border-[#DDD] rounded shrink-0">
                  {checked && <Check className="w-3 h-3 text-[#111]" />}
                </span>
                <span className="flex-1 truncate">{opt.label}</span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function statusLabel(s: string) {
  if (s === 'partially_returned') return 'Partial return'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [paymentFilter, setPaymentFilter] = useState<Set<PaymentMode>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<OrderStatus>>(new Set())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const filtersActive =
    paymentFilter.size > 0 ||
    statusFilter.size > 0 ||
    dateFrom !== '' ||
    dateTo !== ''

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const sortKey = `${sortField}_${sortDir}` as
      | 'date_asc'
      | 'date_desc'
      | 'total_asc'
      | 'total_desc'
    try {
      const res = await api.listOrders(q, page, PAGE_SIZE, {
        payment: Array.from(paymentFilter),
        status: Array.from(statusFilter),
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sort: sortKey,
      })
      setOrders(res.orders ?? [])
      setTotal(Number(res.total) ?? 0)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load orders'
      setLoadError(message)
      toast.error(message, {
        description: 'Tap retry to try again.',
        action: { label: 'Retry', onClick: () => load() },
      })
    } finally {
      setLoading(false)
    }
  }, [q, page, paymentFilter, statusFilter, dateFrom, dateTo, sortField, sortDir])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [q, paymentFilter, statusFilter, dateFrom, dateTo, sortField, sortDir])

  function clearFilters() {
    setPaymentFilter(new Set())
    setStatusFilter(new Set())
    setDateFrom('')
    setDateTo('')
  }

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
      <div>
        <h1 className="text-heading-xl font-bold tracking-tight text-[#111]">Orders</h1>
        <p className="text-body text-[#999] mt-0.5">
          {loading ? 'Loading…' : `${total.toLocaleString()} orders`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CCCCCC]" />
          <input
            className="w-72 h-8 pl-9 pr-3 text-body-sm bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCCCCC] transition-colors placeholder:text-[#CCCCCC]"
            placeholder="Search bill no, name, phone…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>

        <MultiSelectFilter<PaymentMode>
          label="Payment"
          options={PAYMENT_OPTIONS}
          selected={paymentFilter}
          onChange={setPaymentFilter}
        />
        <MultiSelectFilter<OrderStatus>
          label="Status"
          options={STATUS_OPTIONS}
          selected={statusFilter}
          onChange={setStatusFilter}
        />

        <div className="flex items-center gap-1">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            aria-label="Date from"
            className="h-8 px-2 text-body-sm bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCC] text-[#555]"
          />
          <span className="text-body-sm text-[#AAA]">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            aria-label="Date to"
            className="h-8 px-2 text-body-sm bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCC] text-[#555]"
          />
        </div>

        <button
          type="button"
          onClick={clearFilters}
          disabled={!filtersActive}
          className="h-8 px-3 text-body-sm text-[#888] hover:text-[#111] disabled:text-[#CCC] disabled:cursor-not-allowed transition-colors"
        >
          Clear filters
        </button>

        <div className="ml-auto flex items-center gap-1">
          <span className="text-body-sm text-[#888]">Sort</span>
          <select
            value={sortField}
            onChange={e => setSortField(e.target.value as SortField)}
            className="h-8 px-2 text-body-sm bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCC] transition-colors"
          >
            <option value="date">Date</option>
            <option value="total">Total</option>
          </select>
          <Tooltip content={sortDir === 'asc' ? 'Ascending' : 'Descending'}>
            <button
              type="button"
              onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
              className="h-8 w-8 inline-flex items-center justify-center border border-[#E5E5E5] rounded-lg text-[#555] hover:border-[#CCC] hover:text-[#111] transition-colors"
            >
              {sortDir === 'asc' ? (
                <ArrowUp className="w-3.5 h-3.5" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5" />
              )}
            </button>
          </Tooltip>
        </div>
      </div>

      {loadError && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-body-sm text-red-600">Couldn’t load orders: {loadError}</p>
          <button
            type="button"
            onClick={() => load()}
            className="text-body-sm font-medium text-red-700 hover:text-red-900 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <TableSkeleton cols={8} />
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#EBEBEB] py-20 text-center">
          <p className="text-body text-[#AAAAAA]">
            {q || filtersActive ? 'No orders match the current filters.' : 'No orders yet.'}
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
                      <span
                        className={`text-body-sm font-medium ${
                          o.status === 'active'
                            ? 'text-emerald-600'
                            : o.status === 'returned'
                              ? 'text-amber-500'
                              : o.status === 'partially_returned'
                                ? 'text-amber-500'
                                : 'text-[#CCCCCC]'
                        }`}
                      >
                        {'●'} {statusLabel(o.status)}
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
                        {o.status === 'active' && (
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
                        )}
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
            onChange={p => {
              setPage(p)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          />
        </>
      )}
    </div>
  )
}
