'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { GSTRate } from '@/types'
import { useProductSearch } from '@/lib/useProductSearch'
import { GST_RATES, calcLineTotal, fmtCurrency, fmtDate } from '@/lib/gst'
import type { BillingRow } from './BillingTable'

interface Batch {
  batch_id: string
  batch_no: string
  expiry_date: string
  mrp: number
  selling_price: number
  available_stock: number
  box_no?: string | null
  purchase_gst_rate?: number | null
}

interface Props {
  row: BillingRow
  updateRow: (rowId: string, patch: Partial<BillingRow>) => void
  removeRow: (rowId: string) => void
  canRemove: boolean
}

const cellInput =
  'h-7 px-2 text-body-sm border border-[#E8E8E8] rounded-md bg-white focus:outline-none focus:border-[#AAAAAA] transition-colors w-full'
const cellSelect =
  'h-7 px-2 text-body-sm border border-[#E8E8E8] rounded-md bg-white focus:outline-none focus:border-[#AAAAAA] transition-colors w-full cursor-pointer'

export default function BillingRowItem({ row, updateRow, removeRow, canRemove }: Props) {
  const [batches, setBatches] = useState<Batch[]>([])
  const [focused, setFocused] = useState(false)
  const [qtyText, setQtyText] = useState<string>(String(row.qty))
  const [salePriceText, setSalePriceText] = useState<string>(
    row.salePrice ? String(row.salePrice) : '',
  )
  const {
    query, suggestions, loading,
    handleQuery, triggerPreload, setQuery, setSuggestions,
    allProducts, catalogExceedsCap,
  } = useProductSearch()

  // Sync local input text with external row changes (e.g., batch prefill)
  useEffect(() => { setQtyText(String(row.qty)) }, [row.qty])
  useEffect(() => {
    setSalePriceText(row.salePrice ? String(row.salePrice) : '')
  }, [row.salePrice])

  // When focused and the catalog cache is loaded, seed the dropdown with the
  // top suggestions so the user sees options immediately on click.
  useEffect(() => {
    if (!focused) return
    if (!allProducts || catalogExceedsCap) return
    if (query.trim().length > 0) return
    setSuggestions(allProducts.slice(0, 20))
  }, [focused, allProducts, catalogExceedsCap, query, setSuggestions])

  function handleProductInput(val: string) {
    if (row.productId) {
      updateRow(row.rowId, {
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
      })
      setBatches([])
    }
    if (val.trim().length === 0 && allProducts && !catalogExceedsCap) {
      setQuery('')
      setSuggestions(allProducts.slice(0, 20))
      return
    }
    handleQuery(val)
  }

  function onProductFocus(e: React.FocusEvent<HTMLInputElement>) {
    setFocused(true)
    triggerPreload()
    e.target.select()
  }

  function onProductBlur() {
    setFocused(false)
    const expected = row.productName ?? ''
    if (query !== expected) setQuery(expected)
  }

  async function selectProduct(p: { product_id: string; name: string }) {
    setQuery(p.name)
    setSuggestions([])
    setFocused(false)

    const bs = (await api.listActiveBatches(p.product_id)) ?? []
    setBatches(bs)

    const patch: Partial<BillingRow> = {
      productId: p.product_id,
      productName: p.name,
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
    if (bs.length === 1) Object.assign(patch, batchPatch(bs[0]))
    updateRow(row.rowId, patch)
  }

  function batchPatch(b: Batch): Partial<BillingRow> {
    return {
      batchId: b.batch_id,
      batchNo: b.batch_no,
      expiryDate: b.expiry_date,
      mrp: b.mrp,
      boxNo: b.box_no ?? null,
      availableStock: b.available_stock,
      salePrice: b.selling_price,
      gstRate: ((b.purchase_gst_rate ?? 0) as GSTRate),
      qty: 1,
    }
  }

  function onPickBatch(batchId: string) {
    const b = batches.find(x => x.batch_id === batchId)
    if (b) updateRow(row.rowId, batchPatch(b))
  }

  const lineTotal = row.batchId
    ? calcLineTotal(row.salePrice, row.qty, row.gstRate)
    : 0

  const dropdownOpen =
    focused && (suggestions.length > 0 || loading || (!allProducts && !catalogExceedsCap))

  return (
    <tr className="border-b border-[#F7F7F7] last:border-0 group hover:bg-[#FAFAFA] transition-colors">
      {/* Product — searchable picker */}
      <td className="py-2 px-3 align-middle">
        <div className="relative w-56">
          <input
            className={`${cellInput}`}
            placeholder="Search product…"
            value={query}
            onFocus={onProductFocus}
            onBlur={onProductBlur}
            onChange={e => handleProductInput(e.target.value)}
          />
          {dropdownOpen && (
            <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white border border-[#EBEBEB] rounded-lg shadow-xl overflow-hidden">
              {loading && suggestions.length === 0 && (
                <p className="px-3 py-2 text-body-sm text-label">Searching…</p>
              )}
              {!loading && suggestions.length === 0 && !allProducts && (
                <p className="px-3 py-2 text-body-sm text-label">Loading products…</p>
              )}
              {!loading && suggestions.length === 0 && allProducts && query.trim().length > 0 && (
                <p className="px-3 py-2 text-body-sm text-label">No matches</p>
              )}
              <div className="max-h-64 overflow-y-auto">
                {suggestions.map(p => (
                  <button
                    key={p.product_id}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); selectProduct(p) }}
                    className="w-full text-left px-3 py-2 hover:bg-[#F7F7F7] transition-colors border-b border-[#F5F5F5] last:border-0"
                  >
                    <p className="text-body-sm font-medium text-[#111]">{p.name}</p>
                    <p className="text-caption text-[#999]">{p.company_name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </td>

      {/* Batch */}
      <td className="py-2 align-middle">
        {batches.length > 0 ? (
          <select
            className={`${cellSelect} w-32`}
            value={row.batchId ?? ''}
            onChange={e => onPickBatch(e.target.value)}
          >
            <option value="">Select…</option>
            {batches.map(b => (
              <option key={b.batch_id} value={b.batch_id}>
                {b.batch_no}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-body-sm text-[#AAAAAA]">—</span>
        )}
      </td>

      {/* Expiry */}
      <td className="py-2 px-3 align-middle text-body-sm text-[#888] whitespace-nowrap">
        {row.expiryDate ? fmtDate(row.expiryDate) : '—'}
      </td>

      {/* MRP */}
      <td className="py-2 px-3 align-middle text-body-sm text-[#888] whitespace-nowrap">
        {row.mrp != null ? fmtCurrency(row.mrp) : '—'}
      </td>

      {/* Box No */}
      <td className="py-2 px-3 align-middle text-body-sm text-[#888] whitespace-nowrap">
        {row.boxNo ?? '—'}
      </td>

      {/* Sale Price */}
      <td className="py-2 px-1 align-middle">
        <input
          type="number"
          min={0}
          step={0.01}
          className={`${cellInput} text-right w-24`}
          value={salePriceText}
          disabled={!row.batchId}
          onChange={e => {
            const v = e.target.value
            setSalePriceText(v)
            if (v === '') return
            const n = parseFloat(v)
            if (!isNaN(n)) updateRow(row.rowId, { salePrice: n })
          }}
          onBlur={() => {
            if (salePriceText === '' || isNaN(parseFloat(salePriceText))) {
              setSalePriceText(row.salePrice ? String(row.salePrice) : '0')
              if (row.salePrice === 0) updateRow(row.rowId, { salePrice: 0 })
            }
          }}
        />
      </td>

      {/* Qty */}
      <td className="py-2  align-middle">
        <input
          type="number"
          min={1}
          max={row.availableStock ?? undefined}
          className={`${cellInput} text-right`}
          value={qtyText}
          disabled={!row.batchId}
          onChange={e => {
            const v = e.target.value
            setQtyText(v)
            if (v === '') return
            const n = parseInt(v)
            if (isNaN(n) || n < 1) return
            const capped = row.availableStock != null ? Math.min(n, row.availableStock) : n
            updateRow(row.rowId, { qty: capped })
          }}
          onBlur={() => {
            const n = parseInt(qtyText)
            if (isNaN(n) || n < 1) {
              setQtyText('1')
              updateRow(row.rowId, { qty: 1 })
            }
          }}
        />
      </td>

      {/* GST */}
      <td className="py-2 px-1 align-middle">
        <select
          className={`${cellSelect}`}
          value={String(row.gstRate)}
          disabled={!row.batchId}
          onChange={e =>
            updateRow(row.rowId, { gstRate: parseInt(e.target.value) as GSTRate })
          }
        >
          {GST_RATES.map(r => (
            <option key={r} value={String(r)}>{r}%</option>
          ))}
        </select>
      </td>

      {/* Stock */}
      <td className="py-2 px-1 align-middle text-body-sm text-[#555] text-center font-medium">
        {row.availableStock ?? '—'}
      </td>

      {/* Total */}
      <td className="py-2 px-3 align-middle text-right text-body font-semibold text-[#111] whitespace-nowrap">
        {row.batchId ? fmtCurrency(lineTotal) : '—'}
      </td>

      {/* Remove */}
      <td className="py-2 px-3 align-middle text-center">
        <span
          title={canRemove ? 'Remove row' : 'Atleast 1 row'}
          className={canRemove ? undefined : 'cursor-not-allowed'}
        >
          <button
            type="button"
            onClick={() => removeRow(row.rowId)}
            disabled={!canRemove}
            className="inline-flex items-center justify-center w-7 h-7 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            aria-label="Remove row"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </span>
      </td>
    </tr>
  )
}
