'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { GSTRate } from '@/types'
import { useProductSearch } from '@/lib/useProductSearch'
import { filterCatalog } from '@/lib/productCatalog'
import { GST_RATES, calcLineTotal, fmtCurrency } from '@/lib/gst'
import type { BillingRow } from './BillingTable'

interface Batch {
  batch_id: string
  batch_no: string
  expiry_date: string
  mrp: number
  buying_price: number
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
  const [batchError, setBatchError] = useState(false)
  // Dropdown open: on focus/typing, closed by Esc, picking or leaving the box.
  const [focused, setFocused] = useState(false)
  const [qtyText, setQtyText] = useState<string>(String(row.qty))
  const [salePriceText, setSalePriceText] = useState<string>(
    row.salePrice ? String(row.salePrice) : '',
  )
  const {
    query, suggestions, loading,
    handleQuery, triggerPreload, setQuery, setSuggestions,
    allProducts, catalogExceedsCap, error: searchError,
  } = useProductSearch()

  // Clicking into a row that already has a product shows the whole list too;
  // the text is selected, so typing replaces it and filters.
  const filterText = query === (row.productName ?? '') ? '' : query
  // Every match from the cached list, A–Z; server results if the list isn't loaded.
  const matches = useMemo(
    () => (allProducts ? filterCatalog(allProducts, filterText) : suggestions),
    [allProducts, filterText, suggestions],
  )
  // Rendered in pages of PAGE as the list is scrolled or arrowed through.
  const PAGE = 20
  const [visible, setVisible] = useState(PAGE)
  const listRef = useRef<HTMLDivElement>(null)
  const pickable = (i: number) => i >= 0 && i < matches.length && matches[i].has_active_stock !== false
  // The highlight follows the product, not its position: a background refresh can
  // insert products above it, and Enter must never pick a neighbour. If the
  // product drops out of the list (or out of stock), the first pickable one is used.
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = useMemo(() => {
    const i = matches.findIndex(p => p.product_id === activeId)
    return pickable(i) ? i : matches.findIndex(p => p.has_active_stock !== false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, activeId])
  const setActive = (i: number) => setActiveId(matches[i]?.product_id ?? null)

  // New search text: back to the top, first pickable product highlighted. Not on
  // a background refresh of the list, so browsing isn't thrown back to the top.
  useEffect(() => {
    setVisible(PAGE)
    setActiveId(null)
    listRef.current?.scrollTo({ top: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterText, suggestions])

  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function onProductKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setFocused(false); return }
    if (e.key === 'Enter') {
      if (focused && pickable(active)) { e.preventDefault(); selectProduct(matches[active]) }
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    if (!focused) { setFocused(true); return }
    const step = e.key === 'ArrowDown' ? 1 : -1
    let i = active + step
    while (i >= 0 && i < matches.length && !pickable(i)) i += step
    if (!pickable(i)) return
    setActive(i)
    if (i >= visible - 1) setVisible(v => v + PAGE)
  }

  function onListScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 80 && visible < matches.length) {
      setVisible(v => v + PAGE)
    }
  }

  // Sync local input text with external row changes (e.g., batch prefill)
  useEffect(() => { setQtyText(String(row.qty)) }, [row.qty])
  useEffect(() => {
    setSalePriceText(row.salePrice ? String(row.salePrice) : '')
  }, [row.salePrice])

  // A row restored from a saved bill draft has a product but no batch list yet.
  useEffect(() => {
    if (row.productName) setQuery(row.productName)
    if (row.productId) loadBatches(row.productId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Returns null when the batch list couldn't be loaded; the batch cell then
  // offers a retry instead of wrongly saying "Out of stock".
  async function loadBatches(productId: string): Promise<Batch[] | null> {
    try {
      const bs = (await api.listActiveBatches(productId)) ?? []
      setBatches(bs)
      setBatchError(false)
      return bs
    } catch (err) {
      setBatches([])
      setBatchError(true)
      toast.error(err instanceof Error ? err.message : "Couldn't load batches")
      return null
    }
  }

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
      setBatchError(false)
    }
    setFocused(true)
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

    const bs = (await loadBatches(p.product_id)) ?? []

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
    if (bs.length === 1) {
      Object.assign(patch, batchPatch(bs[0]))
      warnIfNoGst(bs[0], p.name)
    }
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

  // A batch no. bought more than once shows as separate entries; tell them apart
  // by cost, selling price and stock. Unique batch nos. keep the plain label.
  function batchLabel(b: Batch) {
    const repeated = batches.filter(x => x.batch_no === b.batch_no).length > 1
    if (!repeated) return b.batch_no
    return `${b.batch_no} · cost ${fmtCurrency(Number(b.buying_price))} · sells ${fmtCurrency(Number(b.selling_price))} · ${b.available_stock} left`
  }

  function onPickBatch(batchId: string) {
    const b = batches.find(x => x.batch_id === batchId)
    if (!b) return
    updateRow(row.rowId, batchPatch(b))
    warnIfNoGst(b, row.productName ?? '')
  }

  // A batch saved without a GST rate would otherwise bill silently at 0%.
  function warnIfNoGst(b: Batch, productName: string) {
    if (b.purchase_gst_rate == null) {
      toast.warning(`${productName}: this batch has no GST rate saved, so GST is set to 0%. Check the GST % before billing.`)
    }
  }

  // Shown until a GST % is picked for a batch that has none saved.
  const gstMissing = !!row.batchId && row.gstRate === 0
    && batches.find(b => b.batch_id === row.batchId)?.purchase_gst_rate == null

  const lineTotal = row.batchId
    ? calcLineTotal(row.salePrice, row.qty, row.gstRate)
    : 0

  const discountPct = row.batchId && row.mrp != null && row.mrp > 0
    ? ((row.mrp - row.salePrice) / row.mrp) * 100
    : 0

  const dropdownOpen = focused

  // The table scrolls sideways, which also clips anything that overflows it
  // vertically, so the dropdown is fixed to the viewport under the input instead.
  const inputRef = useRef<HTMLInputElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null)
  useLayoutEffect(() => {
    if (!dropdownOpen) return
    const place = () => {
      const r = inputRef.current?.getBoundingClientRect()
      if (r) setDropdownPos({ top: r.bottom + 4, left: r.left, maxHeight: Math.max(120, Math.min(256, window.innerHeight - r.bottom - 16)) })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [dropdownOpen])

  return (
    <tr className="border-b border-[#F7F7F7] last:border-0 group hover:bg-[#FAFAFA] transition-colors">
      {/* Product — searchable picker */}
      <td className="py-2 px-3 align-middle">
        <div className="relative w-56">
          <input
            ref={inputRef}
            className={`${cellInput}`}
            placeholder="Search product…"
            value={query}
            onFocus={onProductFocus}
            onBlur={onProductBlur}
            onKeyDown={onProductKeyDown}
            onClick={() => setFocused(true)}
            onChange={e => handleProductInput(e.target.value)}
          />
          {dropdownOpen && dropdownPos && (
            <div
              style={{ top: dropdownPos.top, left: dropdownPos.left }}
              className="fixed z-50 w-72 bg-white border border-[#EBEBEB] rounded-lg shadow-xl overflow-hidden"
            >
              {loading && matches.length === 0 && (
                <p className="px-3 py-2 text-body-sm text-label">Searching…</p>
              )}
              {searchError && !loading && (
                <p className="px-3 py-2 text-body-sm text-red-600">Search failed: {searchError} Keep typing to retry.</p>
              )}
              {!loading && matches.length === 0 && !allProducts && !catalogExceedsCap && (
                <p className="px-3 py-2 text-body-sm text-label">Loading products…</p>
              )}
              {!loading && !searchError && matches.length === 0 && catalogExceedsCap && query.trim().length < 3 && (
                <p className="px-3 py-2 text-body-sm text-label">Type 3 or more letters to search</p>
              )}
              {!loading && !searchError && matches.length === 0 && (allProducts || query.trim().length >= 3) && (
                <p className="px-3 py-2 text-body-sm text-label">No matches</p>
              )}
              <div style={{ maxHeight: dropdownPos.maxHeight }} className="overflow-y-auto overscroll-contain"
                ref={listRef}
                onScroll={onListScroll}
              >
                {matches.slice(0, Math.max(visible, active + 1)).map((p, i) => {
                  const outOfStock = p.has_active_stock === false
                  if (outOfStock) {
                    return (
                      <button
                        key={p.product_id}
                        type="button"
                        disabled
                        aria-disabled="true"
                        aria-label={`${p.name} — out of stock`}
                        title="No active batches — product is out of stock"
                        className="w-full px-3 py-2 border-b border-[#F5F5F5] last:border-0 opacity-60 cursor-not-allowed select-none text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-body-sm font-medium text-[#111] truncate">{p.name}</p>
                            <p className="text-caption text-[#999] truncate">{p.company_name}</p>
                          </div>
                          <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-600">
                            Out of stock
                          </span>
                        </div>
                      </button>
                    )
                  }
                  return (
                    <button
                      key={p.product_id}
                      type="button"
                      data-i={i}
                      tabIndex={-1}
                      onMouseDown={e => { e.preventDefault(); selectProduct(p) }}
                      onMouseMove={() => { if (active !== i) setActive(i) }}
                      className={`w-full text-left px-3 py-2 transition-colors border-b border-[#F5F5F5] last:border-0 ${i === active ? 'bg-sky-100 shadow-[inset_3px_0_0_#0EA5E9]' : ''}`}
                    >
                      <p className="text-body-sm font-medium text-[#111]">{p.name}</p>
                      <p className="text-caption text-[#999]">{p.company_name}</p>
                    </button>
                  )
                })}
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
                {batchLabel(b)}
              </option>
            ))}
          </select>
        ) : row.productId && batchError ? (
          <button
            type="button"
            onClick={() => row.productId && loadBatches(row.productId)}
            className="text-body-sm font-medium text-[#B45309] underline underline-offset-2"
          >
            Couldn&apos;t load · Retry
          </button>
        ) : row.productId ? (
          <span className="text-body-sm font-medium text-red-600">Out of stock</span>
        ) : (
          <span className="text-body-sm text-[#AAAAAA]">—</span>
        )}
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
          className={`${cellInput} text-right${row.batchId && !(row.salePrice > 0) ? ' border-red-500! bg-red-50!' : ''}`}
          title={row.batchId && !(row.salePrice > 0) ? 'Enter a selling price above ₹0' : undefined}
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
            // Show what will actually be billed (capped to stock, whole units).
            if (String(capped) !== v) setQtyText(String(capped))
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
          className={`${cellSelect}${gstMissing ? ' border-amber-500! bg-amber-50! text-amber-800!' : ''}`}
          title={gstMissing ? 'This batch has no GST rate saved. Check the GST %.' : undefined}
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
        {gstMissing && <p className="text-[10px] leading-tight text-amber-700 mt-0.5">No GST saved · check</p>}
      </td>

      {/* Stock */}
      <td className="py-2 px-1 align-middle text-body-sm text-[#555] text-center font-medium">
        {row.availableStock ?? '—'}
      </td>

      {/* Total */}
      <td className="py-2 px-3 align-middle text-right text-body font-semibold text-[#111] whitespace-nowrap">
        {row.batchId ? fmtCurrency(lineTotal) : '—'}
      </td>

      {/* Discount */}
      <td className="py-2 px-3 align-middle text-right text-body-sm text-[#555] whitespace-nowrap">
        {row.batchId && row.mrp != null && row.mrp > 0 ? `${discountPct.toFixed(1)}%` : '—'}
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
