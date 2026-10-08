'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { fmtCurrency, fmtDate } from '@/lib/gst'
import type { Distributor, Product } from '@/types'
import { useProductSearch } from '@/lib/useProductSearch'
import { getCachedDistributors, setCachedDistributors } from '@/lib/distributorCache'
import { Tooltip } from '@/components/ui/tooltip'
import { ArrowLeft, Info } from 'lucide-react'

function LabelWithInfo({ text, tip }: { text: string; tip: string }) {
  return (
    <div className="flex items-center gap-1">
      <p className="text-caption text-label">{text}</p>
      <Tooltip content={tip}>
        <button
          type="button"
          tabIndex={-1}
          aria-label="More info"
          className="text-[#BBBBBB] hover:text-[#666] transition-colors leading-none"
        >
          <Info className="w-3 h-3" />
        </button>
      </Tooltip>
    </div>
  )
}

interface ExistingBatch {
  batch_id: string
  batch_no: string
  expiry_date: string
  mrp: number
  selling_price: number
  available_stock: number
}

// useSearchParams needs a Suspense boundary (Next 16).
export default function AddStockPage() {
  return (
    <Suspense fallback={null}>
      <AddStockForm />
    </Suspense>
  )
}

function AddStockForm() {
  const router = useRouter()
  const presetProductId = useSearchParams().get('product_id')

  const {
    query, suggestions, loading: searching, handleQuery, triggerPreload, setQuery, setSuggestions,
    allProducts, catalogExceedsCap,
  } = useProductSearch()
  // Offer "add new" only once a search has actually run, so an existing product
  // can't be missed and re-created while results are still loading.
  const serverSearch = allProducts === null || catalogExceedsCap
  const searchSettled = !searching && !(serverSearch && query.trim().length < 3)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isNewProduct, setIsNewProduct] = useState(false)
  const [newProductName, setNewProductName] = useState('')
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newSku, setNewSku] = useState('')
  const [newHsn, setNewHsn] = useState('')
  const [focused, setFocused] = useState(false)

  const [batchNo, setBatchNo] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [mrp, setMrp] = useState('')
  const [buyingPrice, setBuyingPrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [purchaseQty, setPurchaseQty] = useState('')
  const [boxNo, setBoxNo] = useState('')
  const [purchaseGSTRate, setPurchaseGSTRate] = useState<number | ''>('')
  const [distributorId, setDistributorId] = useState('')
  const [purchaseInvoiceNo, setPurchaseInvoiceNo] = useState('')
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [loading, setLoading] = useState(false)
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null)
  const [companies, setCompanies] = useState<string[]>([])
  const [existingBatch, setExistingBatch] = useState<ExistingBatch | null>(null)

  useEffect(() => {
    const cached = getCachedDistributors()
    if (cached) { setDistributors(cached); return }
    api.listDistributors().then(list => {
      setDistributors(list ?? [])
      setCachedDistributors(list ?? [])
    }).catch(() => {})
  }, [])

  // Opened from Inventory → "Add batch": start with that product selected.
  useEffect(() => {
    if (!presetProductId) return
    api.getProduct(presetProductId)
      .then(selectProduct)
      .catch(() => toast.error('Could not load product'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetProductId])

  // Carry over what usually stays the same between purchases. Batch no., expiry,
  // qty, buying price and invoice are always new, so they are never pre-filled.
  async function prefillFromLastBatch(productId: string) {
    const [last] = (await api.listBatches(productId).catch(() => null)) ?? []
    if (!last) {
      if (prefilledFrom) {
        setMrp(''); setSellingPrice(''); setPurchaseGSTRate(''); setDistributorId(''); setBoxNo('')
      }
      setPrefilledFrom(null)
      return
    }
    setMrp(String(last.mrp))
    setSellingPrice(String(last.selling_price))
    setPurchaseGSTRate(last.purchase_gst_rate != null ? Number(last.purchase_gst_rate) : '')
    setDistributorId(last.distributor_id ?? '')
    setBoxNo(last.box_no ?? '')
    setPrefilledFrom(last.batch_no)
  }

  function selectProduct(p: Product) {
    setSelectedProduct(p)
    setQuery(p.name)
    setSuggestions([])
    setIsNewProduct(false)
    setFocused(false)
    setExistingBatch(null)
    prefillFromLastBatch(p.product_id)
  }

  function startNewProduct() {
    setIsNewProduct(true)
    setSelectedProduct(null)
    setNewProductName(query)
    setSuggestions([])
    setFocused(false)
    setExistingBatch(null)
    if (companies.length === 0) api.listCompanyNames().then(c => setCompanies(c ?? [])).catch(() => {})
  }

  function handleInputChange(val: string) {
    setSelectedProduct(null)
    setIsNewProduct(false)
    setExistingBatch(null)
    handleQuery(val)
  }

  const b = parseFloat(buyingPrice), s = parseFloat(sellingPrice), m = parseFloat(mrp)
  const gstRate = typeof purchaseGSTRate === 'number' ? purchaseGSTRate : 0
  // Buying price is GST-inclusive; landing price is the pre-GST cost basis.
  const landingPrice = gstRate > 0 ? b / (1 + gstRate / 100) : b
  const costPrice = gstRate > 0 ? landingPrice : b
  const priceError =
    buyingPrice && sellingPrice && costPrice >= s ? `Selling price must be > ${gstRate > 0 ? 'landing' : 'buying'} price` :
    sellingPrice && mrp && s >= m ? 'MRP must be > selling price' : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProduct && !isNewProduct) { toast.error('Select or create a product'); return }
    if (priceError) { toast.error(priceError); return }
    setLoading(true)
    try {
      let productId = selectedProduct?.product_id ?? ''
      if (isNewProduct) {
        const p = await api.createProduct({
          name: newProductName, company_name: newCompanyName,
          sku: newSku || undefined, hsn_code: newHsn || undefined,
        }) as { product_id: string }
        productId = p.product_id
      }
      await api.createBatch({
        product_id: productId, batch_no: batchNo, expiry_date: expiryDate,
        mrp: parseFloat(mrp), buying_price: parseFloat(buyingPrice),
        selling_price: parseFloat(sellingPrice), purchase_qty: parseInt(purchaseQty),
        box_no: boxNo || null,
        purchase_gst_rate: typeof purchaseGSTRate === 'number' ? purchaseGSTRate : undefined,
        distributor_id: distributorId || null,
        purchase_invoice_no: purchaseInvoiceNo.trim() || null,
      })
      toast.success('Stock added')
      router.push('/inventory')
    } catch (err: unknown) {
      if (err instanceof ApiError && err.data?.code === 'batch_exists' && err.data.batch) {
        setExistingBatch(err.data.batch as ExistingBatch)
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to add stock')
      }
    } finally {
      setLoading(false)
    }
  }

  // Same batch no. already on this product: record the new units as a restock
  // adjustment, keeping this purchase's invoice / distributor / price in the notes.
  async function addToExistingBatch() {
    if (!existingBatch) return
    const qty = parseInt(purchaseQty)
    const distributor = distributors.find(d => d.distributor_id === distributorId)?.name
    const notes = [
      purchaseInvoiceNo.trim() && `Invoice ${purchaseInvoiceNo.trim()}`,
      distributor,
      buyingPrice && `Buying ₹${buyingPrice}`,
      purchaseGSTRate !== '' && `GST ${purchaseGSTRate}%`,
    ].filter(Boolean).join(' · ')
    setLoading(true)
    try {
      await api.createStockAdjustment({
        batch_id: existingBatch.batch_id, qty_change: qty, reason: 'restock', notes: notes || null,
      })
      toast.success(`Added ${qty} units to batch ${existingBatch.batch_no}`)
      router.push('/inventory')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add stock')
    } finally {
      setLoading(false)
    }
  }

  const existingExpired = existingBatch ? new Date(existingBatch.expiry_date) <= new Date() : false
  const keptFields = existingBatch ? [
    expiryDate && expiryDate !== existingBatch.expiry_date && 'expiry',
    mrp && parseFloat(mrp) !== Number(existingBatch.mrp) && 'MRP',
    sellingPrice && parseFloat(sellingPrice) !== Number(existingBatch.selling_price) && 'selling price',
  ].filter(Boolean) : []

  const productReady = selectedProduct || (isNewProduct && newProductName && newCompanyName)
  const inp = "w-full h-10 md:h-8 px-3 text-body border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#CCCCCC] transition-colors placeholder:text-[#CCCCCC]"
  const errInp = `${inp} !border-red-300 focus:!border-red-400`

  return (
    <div className="max-w-3xl space-y-6">

      <div>
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-body-sm text-[#AAAAAA] hover:text-[#111] transition-colors mb-3">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <h1 className="text-heading-lg font-bold tracking-tight text-[#111]">Add Stock</h1>
        <p className="text-body text-[#999] mt-0.5">Add a new batch to inventory</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

          {/* Left column: Product + Batch Details */}
          <div className="space-y-4">

            {/* Product */}
            <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 space-y-3">
              <p className="text-caption font-medium text-label">Product</p>
              <div className="relative">
                <input
                  className={inp}
                  placeholder="Search product name…"
                  value={query}
                  onChange={e => handleInputChange(e.target.value)}
                  onFocus={() => { setFocused(true); triggerPreload() }}
                  onBlur={() => setFocused(false)}
                  autoFocus
                />
                {focused && (suggestions.length > 0 || query.trim().length > 0) && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-[#EBEBEB] rounded-lg shadow-md overflow-hidden">
                    {suggestions.map(p => (
                      <button key={p.product_id} type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-[#F5F5F5] transition-colors"
                        onMouseDown={e => { e.preventDefault(); selectProduct(p) }}
                      >
                        <p className="text-body font-medium text-[#111]">{p.name}</p>
                        <p className="text-caption text-[#999]">{p.company_name}</p>
                      </button>
                    ))}
                    {query.trim().length > 0 && !searchSettled && (
                      <p className="px-3 py-2.5 text-body text-[#AAAAAA]">
                        {searching ? 'Searching…' : 'Type at least 3 letters to search'}
                      </p>
                    )}
                    {query.trim().length > 0 && searchSettled && (
                      <button type="button"
                        className="w-full text-left px-3 py-2.5 text-body text-[#111] hover:bg-[#F5F5F5] transition-colors"
                        style={suggestions.length > 0 ? { borderTopWidth: '1px', borderTopColor: '#F0F0F0' } : {}}
                        onMouseDown={e => { e.preventDefault(); startNewProduct() }}
                      >
                        + Add &ldquo;{query}&rdquo; as new product
                      </button>
                    )}
                  </div>
                )}

                {!selectedProduct && query && !isNewProduct && (
                  <div className="bg-[#FFF8E6] border border-[#FFE5B4] rounded-lg px-3 py-2 mt-1">
                    <p className="text-caption text-[#999]">Click &ldquo;+ Add as new product&rdquo; to create <strong>{query}</strong></p>
                  </div>
                )}
              </div>

              {selectedProduct && (
                <div className="bg-[#F7F7F7] rounded-lg px-3 py-2">
                  <p className="text-body font-medium text-[#111]">{selectedProduct.name}</p>
                  <p className="text-caption text-[#999] mt-0.5">{selectedProduct.company_name}</p>
                </div>
              )}

              {isNewProduct && (
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {[
                    { label: 'Product name *', val: newProductName, set: setNewProductName },
                    { label: 'Company *', val: newCompanyName, set: setNewCompanyName, list: 'company-names' },
                    { label: 'SKU', val: newSku, set: setNewSku },
                    { label: 'HSN Code', val: newHsn, set: setNewHsn },
                  ].map(({ label, val, set, list }) => (
                    <div key={label} className="space-y-1">
                      <p className="text-caption text-label">{label}</p>
                      <input className={inp} value={val} onChange={e => set(e.target.value)} required={label.includes('*')} list={list} />
                    </div>
                  ))}
                  {/* Suggest existing spellings so "Knoll" and "Knoll Healthcare" don't both appear */}
                  <datalist id="company-names">
                    {companies.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              )}
            </div>

            {/* Batch Details */}
            <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 space-y-3">
              <p className="text-caption font-medium text-label">Batch Details</p>
              {prefilledFrom && (
                <p className="text-caption text-[#999]">
                  MRP, prices, GST, distributor and box filled from last batch <span className="font-mono">{prefilledFrom}</span>. Check them against this invoice.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <LabelWithInfo text="Batch no. *" tip="Manufacturer batch identifier printed on the pack." />
                  <input className={inp} value={batchNo} onChange={e => { setBatchNo(e.target.value); setExistingBatch(null) }} required />
                </div>
                <div className="space-y-1">
                  <LabelWithInfo text="Expiry date *" tip="Expiry date printed on the pack." />
                  <input type="date" className={inp} value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <LabelWithInfo text="Buying price (incl. GST, ₹) *" tip="Per-unit price you paid the distributor, including GST. Enter the figure on the invoice." />
                  <input type="number" min={0} step={0.01} className={inp} value={buyingPrice} onChange={e => setBuyingPrice(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <LabelWithInfo text="Purchase GST Rate (%)" tip="GST rate charged by the distributor on this purchase." />
                  <select
                    className={inp}
                    value={purchaseGSTRate}
                    onChange={e => setPurchaseGSTRate(e.target.value ? parseFloat(e.target.value) : '')}
                  >
                    <option value="">None</option>
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                {purchaseGSTRate !== '' && (
                  <div className="space-y-1">
                    <LabelWithInfo text="Landing Price (excl. GST, ₹)" tip="Buying price net of GST. Auto-calculated, not editable." />
                    <div className="w-full h-10 md:h-8 px-3 py-1.5 text-body bg-[#F7F7F7] border border-[#E5E5E5] rounded-lg text-[#666] flex items-center">
                      {buyingPrice && typeof purchaseGSTRate === 'number' && purchaseGSTRate > 0
                        ? (parseFloat(buyingPrice) / (1 + purchaseGSTRate / 100)).toFixed(2)
                        : buyingPrice && purchaseGSTRate === 0
                          ? parseFloat(buyingPrice).toFixed(2)
                          : '—'}
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <LabelWithInfo text="Selling price (incl. GST, ₹) *" tip="Per-unit price (incl. GST) shown to customers at checkout." />
                  <input type="number" min={0} step={0.01}
                    className={priceError?.includes('Selling') ? errInp : inp}
                    value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} required />
                </div>
                {purchaseGSTRate !== '' && (
                  <div className="space-y-1">
                    <LabelWithInfo text="Selling price (excl. GST, ₹)" tip="Selling price net of GST. Auto-calculated, not editable." />
                    <div className="w-full h-10 md:h-8 px-3 py-1.5 text-body bg-[#F7F7F7] border border-[#E5E5E5] rounded-lg text-[#666] flex items-center">
                      {sellingPrice && typeof purchaseGSTRate === 'number' && purchaseGSTRate > 0
                        ? (parseFloat(sellingPrice) / (1 + purchaseGSTRate / 100)).toFixed(2)
                        : sellingPrice && purchaseGSTRate === 0
                          ? parseFloat(sellingPrice).toFixed(2)
                          : '—'}
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <LabelWithInfo text="MRP (₹) *" tip="Maximum retail price printed on the pack." />
                  <input type="number" min={0} step={0.01}
                    className={priceError?.includes('MRP') ? errInp : inp}
                    value={mrp} onChange={e => setMrp(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <LabelWithInfo text="Purchase qty *" tip="Number of units received in this batch." />
                  <input type="number" min={1} className={inp} value={purchaseQty} onChange={e => setPurchaseQty(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <LabelWithInfo text="Box no." tip="Storage box or shelf identifier for locating stock." />
                  <input className={inp} value={boxNo} onChange={e => setBoxNo(e.target.value)} />
                </div>
              </div>
              {priceError && <p className="text-body-sm text-red-500">{priceError}</p>}
            </div>

          </div>

          {/* Right column: Distributor + Submit */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 space-y-3">
              <p className="text-caption font-medium text-label">Distributor <span className="font-normal text-[#DDDDDD]">(optional)</span></p>
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <LabelWithInfo text="Distributor" tip="Supplier this batch was purchased from." />
                  <select className={inp} value={distributorId} onChange={e => setDistributorId(e.target.value)}>
                    <option value="">None</option>
                    {distributors.filter(d => d.is_active).map(d => (
                      <option key={d.distributor_id} value={d.distributor_id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <LabelWithInfo text="Purchase Invoice No." tip="Invoice number from the distributor for this purchase." />
                  <input className={inp} placeholder="e.g., INV-2026-001" value={purchaseInvoiceNo} onChange={e => setPurchaseInvoiceNo(e.target.value)} />
                </div>
              </div>
            </div>

            {existingBatch ? (
              <div className="bg-[#FFF8E6] border border-[#FFE5B4] rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-body font-medium text-[#111]">
                    Batch <span className="font-mono">{existingBatch.batch_no}</span> already exists for this product
                  </p>
                  <p className="text-caption text-[#888] mt-0.5">
                    In stock {existingBatch.available_stock} · Exp {fmtDate(existingBatch.expiry_date)} · MRP {fmtCurrency(Number(existingBatch.mrp))} · Selling {fmtCurrency(Number(existingBatch.selling_price))}
                  </p>
                </div>
                {existingExpired && (
                  <p className="text-caption text-red-600">
                    This batch has expired, so stock can&apos;t be added to it. Check the batch no. on the pack.
                  </p>
                )}
                {!existingExpired && keptFields.length > 0 && (
                  <p className="text-caption text-[#996600]">
                    The {keptFields.join(', ')} you entered differ{keptFields.length === 1 ? 's' : ''} from this batch. The batch keeps its current values. Use Edit batch in Inventory to change them.
                  </p>
                )}
                <div className="flex gap-2">
                  {!existingExpired && <button
                    type="button"
                    onClick={addToExistingBatch}
                    disabled={loading || !(parseInt(purchaseQty) > 0)}
                    className="flex-1 h-9 text-body font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] disabled:opacity-40 transition-colors"
                  >
                    {loading ? 'Adding…' : `Add ${parseInt(purchaseQty) || 0} units to this batch`}
                  </button>}
                  <button
                    type="button"
                    onClick={() => setExistingBatch(null)}
                    className="h-9 px-3 text-body text-[#555] border border-[#E5E5E5] rounded-lg bg-white hover:border-[#CCC] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="submit"
                disabled={loading || !productReady}
                className="w-full h-9 text-body font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] disabled:opacity-40 transition-colors"
              >
                {loading ? 'Adding…' : 'Add Stock'}
              </button>
            )}
          </div>

        </div>
      </form>
    </div>
  )
}
