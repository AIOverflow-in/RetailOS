'use client'

import { useState, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { Search } from 'lucide-react'
import { api } from '@/lib/api'
import type { GSTRate } from '@/types'
import { GST_RATES, calcLineTotal, fmtCurrency, fmtDate } from '@/lib/gst'
import { addItem } from '@/store/cartSlice'

interface Product { product_id: string; name: string; company_name: string }
interface Batch {
  batch_id: string; batch_no: string; expiry_date: string
  mrp: number; selling_price: number; available_stock: number
}

const inp = "h-9 px-3 text-body border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#999] transition-colors"

export default function AddItemBar({ onAdd, isInState }: { onAdd: () => void; isInState: boolean }) {
  const dispatch = useDispatch()

  const [query, setQuery]               = useState('')
  const [products, setProducts]         = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [batches, setBatches]           = useState<Batch[]>([])
  const [selectedBatch, setSelectedBatch]     = useState<Batch | null>(null)
  const [qty, setQty]                   = useState(1)
  const [salePrice, setSalePrice]       = useState(0)
  const [gstRate, setGstRate]           = useState<GSTRate>(0)
  const [focused, setFocused]           = useState(false)
  const [searching, setSearching]       = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleQuery(val: string) {
    setQuery(val)
    setSelectedProduct(null)
    setSelectedBatch(null)
    setBatches([])
    if (timer.current) clearTimeout(timer.current)
    if (val.trim().length >= 1) {
      setSearching(true)
      timer.current = setTimeout(async () => {
        try {
          const res = await api.searchProducts(val)
          setProducts(res ?? [])
        } finally { setSearching(false) }
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
    const list = bs ?? []
    setBatches(list)
    if (list.length === 1) selectBatch(list[0])
  }

  function selectBatch(b: Batch) {
    setSelectedBatch(b)
    setSalePrice(b.selling_price)
    setGstRate(0)
    setQty(1)
  }

  function addToCart() {
    if (!selectedProduct || !selectedBatch) return
    dispatch(addItem({
      batchId:        selectedBatch.batch_id,
      productId:      selectedProduct.product_id,
      productName:    selectedProduct.name,
      batchNo:        selectedBatch.batch_no,
      expiryDate:     selectedBatch.expiry_date,
      mrp:            selectedBatch.mrp,
      availableStock: selectedBatch.available_stock,
      qty, salePrice, gstRate,
    }))
    // reset
    setQuery(''); setSelectedProduct(null); setSelectedBatch(null)
    setBatches([]); setQty(1); setSalePrice(0); setGstRate(0)
    onAdd()
  }

  const dropdownOpen = focused && (products.length > 0 || searching)
  const lineTotal    = selectedBatch ? calcLineTotal(salePrice, qty, gstRate) : 0

  return (
    <div className="bg-white rounded-lg border border-[#EBEBEB] p-4">
      <p className="text-caption font-medium text-[#BBBBBB] mb-3">Add Item</p>

      <div className="flex flex-wrap items-end gap-3">

        {/* ── Product search ── */}
        <div className="flex flex-col gap-1">
          <span className="text-caption text-[#BBBBBB]">Product</span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CCCCCC] pointer-events-none" />
            <input
              className={`${inp} pl-9 w-56`}
              placeholder="Search product…"
              value={query}
              onChange={e => handleQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => { if (e.key === 'Enter' && selectedBatch) addToCart() }}
              autoFocus
            />
            {/* Dropdown — fully outside any overflow container */}
            {dropdownOpen && (
              <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white border border-[#EBEBEB] rounded-lg shadow-xl overflow-hidden">
                {searching && products.length === 0 && (
                  <p className="px-4 py-3 text-body-sm text-[#BBBBBB]">Searching…</p>
                )}
                {products.map(p => (
                  <button
                    key={p.product_id}
                    type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-[#F7F7F7] transition-colors border-b border-[#F5F5F5] last:border-0"
                    onMouseDown={e => { e.preventDefault(); selectProduct(p) }}
                  >
                    <p className="text-body font-medium text-[#111]">{p.name}</p>
                    <p className="text-caption text-[#999]">{p.company_name}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Batch ── */}
        {batches.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-caption text-[#BBBBBB]">Batch</span>
            <select
              className={`${inp} w-48`}
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
          </div>
        )}

        {/* ── Fields after batch selected ── */}
        {selectedBatch && (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-caption text-[#BBBBBB]">Sale Price (₹)</span>
              <input
                type="number" min={0} step={0.01}
                className={`${inp} w-24 text-right`}
                value={salePrice || ''}
                onChange={e => setSalePrice(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-caption text-[#BBBBBB]">Qty</span>
              <input
                type="number" min={1} max={selectedBatch.available_stock}
                className={`${inp} w-16 text-right`}
                value={qty}
                onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                onKeyDown={e => { if (e.key === 'Enter') addToCart() }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-caption text-[#BBBBBB]">GST</span>
              <select
                className={`${inp} w-20`}
                value={String(gstRate)}
                onChange={e => setGstRate(parseInt(e.target.value) as GSTRate)}
              >
                {GST_RATES.map(r => (
                  <option key={r} value={String(r)}>{r}%</option>
                ))}
              </select>
            </div>

            {/* Info pills */}
            <div className="flex flex-col gap-1">
              <span className="text-caption text-[#BBBBBB]">MRP</span>
              <div className="h-9 flex items-center px-3 bg-[#F7F7F7] rounded-lg text-body text-[#888]">
                {fmtCurrency(selectedBatch.mrp)}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-caption text-[#BBBBBB]">Stock</span>
              <div className={`h-9 flex items-center px-3 rounded-lg text-body font-medium ${
                selectedBatch.available_stock < 10 ? 'bg-amber-50 text-amber-600' : 'bg-[#F7F7F7] text-[#555]'
              }`}>
                {selectedBatch.available_stock}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-caption text-[#BBBBBB]">Total</span>
              <div className="h-9 flex items-center px-3 bg-[#F7F7F7] rounded-lg text-body font-semibold text-[#111]">
                {fmtCurrency(lineTotal)}
              </div>
            </div>
          </>
        )}

        {/* ── Add button ── */}
        <div className="flex flex-col gap-1">
          <span className="text-caption text-transparent select-none">·</span>
          <button
            disabled={!selectedBatch}
            onClick={addToCart}
            className="h-9 px-5 text-body font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] disabled:bg-[#E5E5E5] disabled:text-[#BBBBBB] transition-colors"
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  )
}
