'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Plus,
  Search,
  Pencil,
  SlidersHorizontal,
  PackageMinus,
  ArrowUp,
  ArrowDown,
  Check,
} from 'lucide-react'
import { api } from '@/lib/api'
import type { InventoryRow } from '@/types'
import { fmtCurrency, fmtDate } from '@/lib/gst'
import TableSkeleton from '@/components/shared/TableSkeleton'
import Pagination from '@/components/shared/Pagination'
import EditProductModal from '@/components/inventory/EditProductModal'
import EditBatchModal from '@/components/inventory/EditBatchModal'
import StockAdjustmentModal from '@/components/inventory/StockAdjustmentModal'
import { Tooltip } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const PAGE_SIZE = 20
const NO_BOX = '__no_box__'
const NO_DIST = '__no_dist__'

type StockStatus = 'in' | 'low' | 'out' | 'expired'
type SortField = 'expiry' | 'stock' | 'created'
type SortDir = 'asc' | 'desc'

const STOCK_STATUS_OPTIONS: { value: StockStatus; label: string }[] = [
  { value: 'in', label: 'In stock' },
  { value: 'low', label: 'Low stock (≤5)' },
  { value: 'out', label: 'Out of stock' },
  { value: 'expired', label: 'Expired' },
]

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'expiry', label: 'Expiry date' },
  { value: 'stock', label: 'Available stock' },
  { value: 'created', label: 'Date added' },
]

function isExpired(date: string) {
  return new Date(date) <= new Date()
}

function isExpiringSoon(date: string) {
  const diff = new Date(date).getTime() - Date.now()
  return diff > 0 && diff < 60 * 24 * 60 * 60 * 1000
}

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
          {options.length === 0 ? (
            <p className="px-2 py-1.5 text-body-sm text-[#999]">No options</p>
          ) : (
            options.map(opt => {
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
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const [hideExpired, setHideExpired] = useState(true)
  const [companyFilter, setCompanyFilter] = useState<Set<string>>(new Set())
  const [boxFilter, setBoxFilter] = useState<Set<string>>(new Set())
  const [distributorFilter, setDistributorFilter] = useState<Set<string>>(new Set())
  const [stockStatusFilter, setStockStatusFilter] = useState<Set<StockStatus>>(new Set())
  const [sortField, setSortField] = useState<SortField>('expiry')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [editProduct, setEditProduct] = useState<{
    product_id: string; name: string; company_name: string; sku: string | null; hsn_code: string | null
  } | null>(null)
  const [editProductOpen, setEditProductOpen] = useState(false)

  const [editBatch, setEditBatch] = useState<{
    batch_id: string; batch_no: string; buying_price: number; selling_price: number;
    mrp: number; expiry_date: string; purchase_qty: number; sold_qty: number; box_no: string | null;
    purchase_gst_rate: number | null; landing_price: number | null;
    distributor_id: string | null; purchase_invoice_no: string | null;
  } | null>(null)
  const [editBatchOpen, setEditBatchOpen] = useState(false)

  const [adjustBatch, setAdjustBatch] = useState<{
    batch_id: string; batch_no: string; name: string;
    purchase_qty: number; sold_qty: number; available_stock: number
  } | null>(null)
  const [adjustOpen, setAdjustOpen] = useState(false)

  const fetchInventory = useCallback(() => {
    setLoading(true)
    api
      .listInventory()
      .then(d => setRows(d ?? []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  const companyOptions = useMemo(
    () =>
      Array.from(new Set(rows.map(r => r.company_name)))
        .sort()
        .map(c => ({ value: c, label: c })),
    [rows],
  )

  const boxOptions = useMemo(() => {
    const boxes = new Set<string>()
    let hasNull = false
    for (const r of rows) {
      if (r.box_no) boxes.add(r.box_no)
      else hasNull = true
    }
    const opts = Array.from(boxes)
      .sort()
      .map(v => ({ value: v, label: v }))
    if (hasNull) opts.push({ value: NO_BOX, label: '(no box)' })
    return opts
  }, [rows])

  const distributorOptions = useMemo(() => {
    const dists = new Set<string>()
    let hasNull = false
    for (const r of rows) {
      if (r.distributor_name) dists.add(r.distributor_name)
      else hasNull = true
    }
    const opts = Array.from(dists)
      .sort()
      .map(v => ({ value: v, label: v }))
    if (hasNull) opts.push({ value: NO_DIST, label: '(no distributor)' })
    return opts
  }, [rows])

  const displayed = useMemo(() => {
    let items = rows
    if (hideExpired) items = items.filter(r => !isExpired(r.expiry_date))
    if (companyFilter.size > 0) items = items.filter(r => companyFilter.has(r.company_name))
    if (boxFilter.size > 0) items = items.filter(r => boxFilter.has(r.box_no ?? NO_BOX))
    if (distributorFilter.size > 0)
      items = items.filter(r => distributorFilter.has(r.distributor_name ?? NO_DIST))
    if (stockStatusFilter.size > 0) {
      items = items.filter(r => {
        const expired = isExpired(r.expiry_date)
        const avail = r.available_stock
        if (stockStatusFilter.has('expired') && expired) return true
        if (stockStatusFilter.has('out') && !expired && avail === 0) return true
        if (stockStatusFilter.has('low') && !expired && avail > 0 && avail <= 5) return true
        if (stockStatusFilter.has('in') && !expired && avail > 5) return true
        return false
      })
    }
    if (q !== '') {
      const ql = q.toLowerCase()
      items = items.filter(
        r =>
          r.name.toLowerCase().includes(ql) ||
          r.company_name.toLowerCase().includes(ql) ||
          (r.batch_no ?? '').toLowerCase().includes(ql),
      )
    }
    const sorted = [...items]
    sorted.sort((a, b) => {
      let cmp = 0
      if (sortField === 'expiry') cmp = +new Date(a.expiry_date) - +new Date(b.expiry_date)
      else if (sortField === 'stock') cmp = a.available_stock - b.available_stock
      else cmp = +new Date(a.created_at) - +new Date(b.created_at)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [
    rows,
    hideExpired,
    companyFilter,
    boxFilter,
    distributorFilter,
    stockStatusFilter,
    q,
    sortField,
    sortDir,
  ])

  useEffect(() => {
    setPage(1)
  }, [
    hideExpired,
    companyFilter,
    boxFilter,
    distributorFilter,
    stockStatusFilter,
    q,
    sortField,
    sortDir,
  ])

  const paginated = displayed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtersActive =
    companyFilter.size + boxFilter.size + distributorFilter.size + stockStatusFilter.size > 0

  function clearFilters() {
    setCompanyFilter(new Set())
    setBoxFilter(new Set())
    setDistributorFilter(new Set())
    setStockStatusFilter(new Set())
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-heading-xl font-bold tracking-tight text-[#111]">Inventory</h1>
          <p className="text-body text-[#999] mt-0.5">
            {loading ? 'Loading…' : `Showing ${displayed.length} of ${rows.length} batches`}
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

      {/* Filter / sort bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CCCCCC]" />
          <input
            className="w-72 h-8 pl-9 pr-3 text-body-sm bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCCCCC] transition-colors placeholder:text-[#CCCCCC]"
            placeholder="Search product, company, batch…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>

        <MultiSelectFilter
          label="Company"
          options={companyOptions}
          selected={companyFilter}
          onChange={setCompanyFilter}
        />
        <MultiSelectFilter
          label="Box"
          options={boxOptions}
          selected={boxFilter}
          onChange={setBoxFilter}
        />
        <MultiSelectFilter
          label="Distributor"
          options={distributorOptions}
          selected={distributorFilter}
          onChange={setDistributorFilter}
        />
        <MultiSelectFilter<StockStatus>
          label="Stock"
          options={STOCK_STATUS_OPTIONS}
          selected={stockStatusFilter}
          onChange={setStockStatusFilter}
        />

        <button
          type="button"
          onClick={clearFilters}
          disabled={!filtersActive}
          className="h-8 px-3 text-body-sm text-[#888] hover:text-[#111] disabled:text-[#CCC] disabled:cursor-not-allowed transition-colors"
        >
          Clear filters
        </button>

        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-body-sm text-[#555] select-none cursor-pointer">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 accent-[#111]"
              checked={hideExpired}
              onChange={e => setHideExpired(e.target.checked)}
            />
            Hide expired
          </label>

          <div className="flex items-center gap-1">
            <span className="text-body-sm text-[#888]">Sort</span>
            <select
              value={sortField}
              onChange={e => setSortField(e.target.value as SortField)}
              className="h-8 px-2 text-body-sm bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCC] transition-colors"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
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
      </div>

      {loading ? (
        <TableSkeleton cols={10} />
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#EBEBEB] py-20 text-center">
          <p className="text-body text-[#AAAAAA]">
            {rows.length === 0
              ? 'No stock yet. Add your first batch.'
              : 'No batches match the current filters.'}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-[#EBEBEB] overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F2F2F2]">
                  {['Product', 'Company', 'Batch', 'Box', 'Expiry', 'MRP', 'Selling', 'Stock', 'HSN', ''].map(h => (
                    <th
                      key={h || 'actions'}
                      className="text-left py-2.5 px-4 text-caption font-medium text-label whitespace-nowrap"
                    >
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
                      <td className="py-3 px-4 text-body-sm text-[#999] font-mono">{r.box_no ?? '—'}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-body-sm ${expired ? 'text-red-500' : expiring ? 'text-amber-500' : 'text-[#999]'}`}
                        >
                          {(expired || expiring) && <span className="mr-1">{'●'}</span>}
                          {fmtDate(r.expiry_date)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-body text-[#888]">{fmtCurrency(r.mrp)}</td>
                      <td className="py-3 px-4 text-body font-medium text-[#111]">{fmtCurrency(r.selling_price)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-body-sm font-medium ${
                            r.available_stock === 0
                              ? 'text-red-500'
                              : r.available_stock <= 5
                                ? 'text-amber-500'
                                : 'text-[#555]'
                          }`}
                        >
                          {r.available_stock}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-body-sm text-[#CCCCCC] font-mono">{r.hsn_code ?? '—'}</td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-0.5">
                          <Tooltip content="Edit product">
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
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                          <Tooltip content="Edit batch">
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
                                  distributor_id: r.distributor_id ?? null,
                                  purchase_invoice_no: r.purchase_invoice_no ?? null,
                                })
                                setEditBatchOpen(true)
                              }}
                              className="p-1.5 rounded-md text-[#CCCCCC] hover:text-[#555] hover:bg-[#F2F2F2] transition-colors"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                          <Tooltip content="Adjust stock">
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
                            >
                              <PackageMinus className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
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
            total={displayed.length}
            limit={PAGE_SIZE}
            onChange={p => {
              setPage(p)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
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
