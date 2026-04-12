'use client'

import { useState, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { api } from '@/lib/api'
import type { GSTRate } from '@/types'
import { GST_RATES, calcLineTotal, fmtCurrency, fmtDate } from '@/lib/gst'
import { addItem, updateQty, updateSalePrice, updateGstRate, removeItem } from '@/store/cartSlice'

interface Batch {
  batch_id: string
  batch_no: string
  expiry_date: string
  mrp: number
  selling_price: number
  available_stock: number
}

interface Product {
  product_id: string
  name: string
  company_name: string
}

interface LineItemProps {
  batchId: string | null
  productName: string
  batchNo: string
  expiryDate: string
  mrp: number
  availableStock: number
  qty: number
  salePrice: number
  gstRate: GSTRate
  isInState: boolean
}

const cellInput = "h-7 px-2 text-body-sm border border-[#E8E8E8] rounded-md bg-white focus:outline-none focus:border-[#AAAAAA] transition-colors w-full"
const cellSelect = "h-7 px-2 text-body-sm border border-[#E8E8E8] rounded-md bg-white focus:outline-none focus:border-[#AAAAAA] transition-colors w-full cursor-pointer"

export function NewLineItem({ onAdd, isInState }: { onAdd: () => void; isInState: boolean }) {
  const dispatch = useDispatch()
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [batches, setBatches] = useState<Batch[]>([])
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null)
  const [qty, setQty] = useState(1)
  const [salePrice, setSalePrice] = useState(0)
  const [gstRate, setGstRate] = useState<GSTRate>(0)
  const [searching, setSearching] = useState(false)
  const [focused, setFocused] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleQueryChange(val: string) {
    setQuery(val)
    setSelectedProduct(null)
    setSelectedBatch(null)
    setBatches([])
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (val.trim().length >= 1) {
      setSearching(true)
      searchTimer.current = setTimeout(async () => {
        try {
          const res = await api.searchProducts(val)
          setProducts(res ?? [])
        } finally {
          setSearching(false)
        }
      }, 150)
    } else {
      setProducts([])
      setSearching(false)
    }
  }

  async function selectProduct(p: Product) {
    setSelectedProduct(p)
    setQuery(p.name)
    setProducts([])
    setFocused(false)
    const bs = await api.listActiveBatches(p.product_id)
    setBatches(bs ?? [])
    if (bs?.length === 1) selectBatch(bs[0])
  }

  function selectBatch(b: Batch) {
    setSelectedBatch(b)
    setSalePrice(b.selling_price)
  }

  function addToCart() {
    if (!selectedProduct || !selectedBatch) return
    dispatch(addItem({
      batchId: selectedBatch.batch_id,
      productId: selectedProduct.product_id,
      productName: selectedProduct.name,
      batchNo: selectedBatch.batch_no,
      expiryDate: selectedBatch.expiry_date,
      mrp: selectedBatch.mrp,
      availableStock: selectedBatch.available_stock,
      qty,
      salePrice,
      gstRate,
    }))
    onAdd()
  }

  const lineTotal = selectedBatch ? calcLineTotal(salePrice, qty, gstRate) : 0
  const dropdownOpen = focused && (products.length > 0 || searching)

  return (
    <tr className="border-t border-[#EBEBEB] bg-[#FAFAFA]">
      <td colSpan={10} className="px-3 py-2.5">
        <div className="flex items-center gap-2 relative">

          {/* Product search */}
          <div className="relative flex-shrink-0">
            <input
              className="h-8 px-3 text-body border border-[#E0E0E0] rounded-lg bg-white focus:outline-none focus:border-[#AAAAAA] transition-colors w-52 placeholder:text-[#CCCCCC]"
              placeholder="Search product…"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => { if (e.key === 'Enter' && selectedBatch) addToCart() }}
            />
            {dropdownOpen && (
              <div className="absolute z-30 top-full left-0 mt-1 w-64 bg-white border border-[#EBEBEB] rounded-lg shadow-lg overflow-hidden">
                {searching && products.length === 0 && (
                  <div className="px-3 py-2.5 text-body-sm text-[#BBBBBB]">Searching…</div>
                )}
                {products.map(p => (
                  <button
                    key={p.product_id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-[#F5F5F5] transition-colors border-b border-[#F5F5F5] last:border-0"
                    onMouseDown={e => { e.preventDefault(); selectProduct(p) }}
                  >
                    <p className="text-body font-medium text-[#111]">{p.name}</p>
                    <p className="text-caption text-[#999]">{p.company_name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Batch — appears after product selected */}
          {batches.length > 0 && (
            <select
              className="h-8 px-2 text-body-sm border border-[#E0E0E0] rounded-lg bg-white focus:outline-none focus:border-[#AAAAAA] transition-colors w-44 flex-shrink-0"
              value={selectedBatch?.batch_id ?? ''}
              onChange={e => {
                const b = batches.find(b => b.batch_id === e.target.value)
                if (b) selectBatch(b)
              }}
            >
              <option value="">Select batch…</option>
              {batches.map(b => (
                <option key={b.batch_id} value={b.batch_id}>
                  {b.batch_no} · {fmtDate(b.expiry_date)}
                </option>
              ))}
            </select>
          )}

          {/* Fields — appear after batch selected */}
          {selectedBatch && (
            <>
              <span className="text-body-sm text-[#AAAAAA] flex-shrink-0">
                MRP {fmtCurrency(selectedBatch.mrp)}
              </span>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-caption text-[#BBBBBB]">₹</span>
                <input
                  type="number" min={0} step={0.01}
                  className="h-8 w-20 px-2 text-body text-right border border-[#E0E0E0] rounded-lg bg-white focus:outline-none focus:border-[#AAAAAA] transition-colors"
                  value={salePrice || ''}
                  placeholder="price"
                  onChange={e => setSalePrice(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-caption text-[#BBBBBB]">Qty</span>
                <input
                  type="number" min={1} max={selectedBatch.available_stock}
                  className="h-8 w-14 px-2 text-body text-right border border-[#E0E0E0] rounded-lg bg-white focus:outline-none focus:border-[#AAAAAA] transition-colors"
                  value={qty}
                  onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                  onKeyDown={e => { if (e.key === 'Enter') addToCart() }}
                />
              </div>

              <select
                className="h-8 px-2 text-body-sm border border-[#E0E0E0] rounded-lg bg-white focus:outline-none w-16 flex-shrink-0"
                value={String(gstRate)}
                onChange={e => setGstRate(parseInt(e.target.value) as GSTRate)}
              >
                {GST_RATES.map(r => (
                  <option key={r} value={String(r)}>{r}%</option>
                ))}
              </select>

              <span className="text-caption text-[#AAAAAA] flex-shrink-0">
                stock: {selectedBatch.available_stock}
              </span>

              <span className="text-body font-semibold text-[#111] flex-shrink-0 ml-1">
                {fmtCurrency(lineTotal)}
              </span>
            </>
          )}

          {/* Add button — right side */}
          <div className="ml-auto flex-shrink-0">
            <button
              disabled={!selectedBatch}
              onClick={addToCart}
              className="h-8 px-4 text-body-sm font-medium bg-[#111] text-white rounded-lg disabled:bg-[#E5E5E5] disabled:text-[#BBBBBB] hover:bg-[#333] transition-colors"
            >
              + Add
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

export default function LineItem({
  batchId, productName, batchNo, expiryDate, mrp,
  availableStock, qty, salePrice, gstRate,
}: LineItemProps) {
  const dispatch = useDispatch()
  const lineTotal = calcLineTotal(salePrice, qty, gstRate)

  if (!batchId) return null
  const id = batchId as string

  return (
    <tr className="border-b border-[#F7F7F7] group hover:bg-[#FAFAFA] transition-colors">
      <td className="py-2.5 px-3">
        <p className="text-body font-medium text-[#111] truncate">{productName}</p>
        <p className="text-caption text-[#AAAAAA]">{batchNo}</p>
      </td>
      <td className="py-2.5 px-3 text-body-sm text-[#888] truncate">{batchNo}</td>
      <td className="py-2.5 px-3 text-body-sm text-[#888] whitespace-nowrap">{fmtDate(expiryDate)}</td>
      <td className="py-2.5 px-3 text-body-sm text-[#888]">{fmtCurrency(mrp)}</td>
      <td className="py-2.5 px-3">
        <input
          type="number" min={0} step={0.01}
          className={`${cellInput} text-right`}
          value={salePrice}
          onChange={e => dispatch(updateSalePrice({ batchId: id, salePrice: parseFloat(e.target.value) || 0 }))}
        />
      </td>
      <td className="py-2.5 px-3">
        <input
          type="number" min={1} max={availableStock}
          className={`${cellInput} text-right`}
          value={qty}
          onChange={e => dispatch(updateQty({ batchId: id, qty: Math.max(1, parseInt(e.target.value) || 1) }))}
        />
      </td>
      <td className="py-2.5 px-3">
        <select
          className={cellSelect}
          value={String(gstRate)}
          onChange={e => dispatch(updateGstRate({ batchId: id, gstRate: parseInt(e.target.value) as GSTRate }))}
        >
          {GST_RATES.map(r => (
            <option key={r} value={String(r)}>{r}%</option>
          ))}
        </select>
      </td>
      <td className="py-2.5 px-3 text-body-sm text-[#555] text-center font-medium">{availableStock}</td>
      <td className="py-2.5 px-3 text-right text-body font-semibold text-[#111]">{fmtCurrency(lineTotal)}</td>
      <td className="py-2.5 px-3 text-center">
        <button
          className="text-body text-[#DDDDDD] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
          onClick={() => dispatch(removeItem(id))}
        >
          ✕
        </button>
      </td>
    </tr>
  )
}
