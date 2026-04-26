'use client'

import type { GSTRate } from '@/types'
import BillingRowItem from './BillingRowItem'

export interface BillingRow {
  rowId: string
  productId: string | null
  productName: string | null
  batchId: string | null
  batchNo: string | null
  expiryDate: string | null
  mrp: number | null
  boxNo: string | null
  availableStock: number | null
  qty: number
  salePrice: number
  gstRate: GSTRate
}

export function emptyRow(): BillingRow {
  return {
    rowId: crypto.randomUUID(),
    productId: null,
    productName: null,
    batchId: null,
    batchNo: null,
    expiryDate: null,
    mrp: null,
    boxNo: null,
    availableStock: null,
    qty: 1,
    salePrice: 0,
    gstRate: 0,
  }
}

export function isCompleteRow(r: BillingRow): boolean {
  return !!r.productId && !!r.batchId
}

const HEADERS: { label: React.ReactNode; nowrap?: boolean }[] = [
  { label: 'Product', nowrap: true },
  { label: 'Batch', nowrap: true },
  { label: 'MRP', nowrap: true },
  { label: 'Box', nowrap: true },
  {
    label: (
      <>
        Sale Price
        <br />
        <span className="text-[#AAAAAA]">(incl. GST)</span>
      </>
    ),
  },
  { label: 'Qty', nowrap: true },
  { label: 'GST', nowrap: true },
  { label: 'Stock', nowrap: true },
  { label: 'Total', nowrap: true },
  { label: 'Discount', nowrap: true },
  { label: '', nowrap: true },
]

interface Props {
  rows: BillingRow[]
  setRows: React.Dispatch<React.SetStateAction<BillingRow[]>>
}

export default function BillingTable({ rows, setRows }: Props) {
  function updateRow(rowId: string, patch: Partial<BillingRow>) {
    setRows(prev => prev.map(r => (r.rowId === rowId ? { ...r, ...patch } : r)))
  }

  function removeRow(rowId: string) {
    setRows(prev => (prev.length > 1 ? prev.filter(r => r.rowId !== rowId) : prev))
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow()])
  }

  return (
    <div className="bg-white rounded-lg border border-[#EBEBEB]">
      <div>
        <table className="w-full table-fixed">
          <colgroup>
            <col />
            <col className="w-32" />
            <col className="w-20" />
            <col className="w-14" />
            <col className="w-24" />
            <col className="w-16" />
            <col className="w-20" />
            <col className="w-14" />
            <col className="w-20" />
            <col className="w-20" />
            <col className="w-12" />
          </colgroup>
          <thead>
            <tr className="border-b border-[#F2F2F2]">
              {HEADERS.map((h, i) => (
                <th
                  key={i}
                  className={`text-left py-2.5 px-3 text-caption font-medium text-label${h.nowrap ? ' whitespace-nowrap' : ''}`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <BillingRowItem
                key={row.rowId}
                row={row}
                updateRow={updateRow}
                removeRow={removeRow}
                canRemove={rows.length > 1}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[#F2F2F2] px-3 py-2.5">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-body-sm font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] transition-colors"
        >
          <span aria-hidden>+</span> Add Item
        </button>
      </div>
    </div>
  )
}
