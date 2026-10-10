'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { api } from '@/lib/api'
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

interface ProductBatch {
  batch_id: string
  batch_no: string
  expiry_date: string
  created_at: string
  mrp: number
  buying_price: number
  selling_price: number
  available_stock: number
  purchase_gst_rate: number | null
  distributor_id: string | null
  box_no: string | null
  purchase_invoice_no: string | null
}

// Fields carried over from a product's latest batch.
type Carried = { mrp: string; sellingPrice: string; gst: number | ''; distributorId: string; boxNo: string }
const NOTHING_CARRIED: Carried = { mrp: '', sellingPrice: '', gst: '', distributorId: '', boxNo: '' }

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
  const [productBatches, setProductBatches] = useState<ProductBatch[]>([])
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null)
  const carried = useRef<Carried>(NOTHING_CARRIED)
  const prefillRequest = useRef(0)
  const autoExpiry = useRef('')

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
  // A field is only replaced if the user hasn't typed over it (empty, or still the
  // value carried in last time), and a slower response for an earlier product is ignored.
  async function prefillFromLastBatch(productId: string) {
    const request = ++prefillRequest.current
    const batches: ProductBatch[] = (await api.listBatches(productId).catch(() => null)) ?? []
    if (request !== prefillRequest.current) return
    setProductBatches(batches)

    const last = batches[0]
    const next: Carried = last ? {
      mrp: String(last.mrp),
      sellingPrice: String(last.selling_price),
      gst: last.purchase_gst_rate != null ? Number(last.purchase_gst_rate) : '',
      distributorId: last.distributor_id ?? '',
      boxNo: last.box_no ?? '',
    } : NOTHING_CARRIED
    applyCarried(next)
    setPrefilledFrom(last?.batch_no ?? null)
  }

  // Swap carried-over values for `next`, leaving anything the user typed alone.
  function applyCarried(next: Carried) {
    const prev = carried.current
    const untouched = <T,>(cur: T, old: T) => cur === '' || cur === old
    setMrp(cur => untouched(cur, prev.mrp) ? next.mrp : cur)
    setSellingPrice(cur => untouched(cur, prev.sellingPrice) ? next.sellingPrice : cur)
    setPurchaseGSTRate(cur => untouched(cur, prev.gst) ? next.gst : cur)
    setDistributorId(cur => untouched(cur, prev.distributorId) ? next.distributorId : cur)
    setBoxNo(cur => untouched(cur, prev.boxNo) ? next.boxNo : cur)
    carried.current = next
  }

  // Leaving a selected product: its carried-over values must not follow into the
  // next product (they'd end up on bills), and any in-flight prefill is dropped.
  function dropCarried() {
    prefillRequest.current++
    applyCarried(NOTHING_CARRIED)
    setPrefilledFrom(null)
    setProductBatches([])
    clearAutoExpiry()
  }

  function selectProduct(p: Product) {
    setSelectedProduct(p)
    setQuery(p.name)
    setSuggestions([])
    setIsNewProduct(false)
    setFocused(false)
    setMatchedProduct(null)
    prefillFromLastBatch(p.product_id)
  }

  function startNewProduct() {
    setIsNewProduct(true)
    setSelectedProduct(null)
    setNewProductName(query)
    setSuggestions([])
    setFocused(false)
    dropCarried()
    if (companies.length === 0) api.listCompanyNames().then(c => setCompanies(c ?? [])).catch(() => {})
  }

  function handleInputChange(val: string) {
    setSelectedProduct(null)
    setIsNewProduct(false)
    setMatchedProduct(null)
    dropCarried()
    handleQuery(val)
  }

  // Earlier purchases of the batch no. being entered. Same batch no. means the same
  // physical lot, so its expiry is filled in when the field is empty. An auto-filled
  // expiry only lives while the batch no. still matches (e.g. "2301" matching on the
  // way to typing "23015" must not leave 2301's expiry behind); a typed one is kept.
  const sameBatchKey = (v: string) => v.trim().toLowerCase()
  const sameBatch = batchNo.trim()
    ? productBatches.filter(pb => sameBatchKey(pb.batch_no) === sameBatchKey(batchNo))
    : []
  function onBatchNoChange(v: string) {
    setBatchNo(v)
    const earlier = v.trim() && productBatches.find(pb => sameBatchKey(pb.batch_no) === sameBatchKey(v))
    if (earlier && (!expiryDate || expiryDate === autoExpiry.current)) {
      setExpiryDate(earlier.expiry_date)
      autoExpiry.current = earlier.expiry_date
    } else if (!earlier) {
      clearAutoExpiry()
    }
  }
  function clearAutoExpiry() {
    if (autoExpiry.current && expiryDate === autoExpiry.current) setExpiryDate('')
    autoExpiry.current = ''
  }
  const expiryDiffers = sameBatch.length > 0 && !!expiryDate && expiryDate !== sameBatch[0].expiry_date
  const distributorName = (id: string | null) => distributors.find(d => d.distributor_id === id)?.name

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
        })
        // The name matched a product already in the catalog: confirm before using it.
        if (p.existing) { setMatchedProduct(p); return }
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
      toast.error(err instanceof Error ? err.message : 'Failed to add stock')
    } finally {
      setLoading(false)
    }
  }

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
                  <input className={inp} value={batchNo} onChange={e => onBatchNoChange(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <LabelWithInfo text="Expiry date *" tip="Expiry date printed on the pack." />
                  <input type="date" className={expiryDiffers ? errInp : inp} value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
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

              {sameBatch.length > 0 && (
                <div className="bg-[#FFF8E6] border border-[#FFE5B4] rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-body-sm font-medium text-[#111]">
                      Batch <span className="font-mono">{sameBatch[0].batch_no}</span> was already added
                      {sameBatch.length > 1 ? ` ${sameBatch.length} times` : ''}
                    </p>
                    <a
                      href={`/inventory?q=${encodeURIComponent(batchNo.trim())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-body-sm text-[#555] underline underline-offset-2 hover:text-[#111]"
                    >
                      View batch ↗
                    </a>
                  </div>
                  <ul className="space-y-1">
                    {sameBatch.map(pb => (
                      <li key={pb.batch_id} className="text-caption text-[#777]">
                        {fmtDate(pb.created_at)} · buying {fmtCurrency(Number(pb.buying_price))} · selling {fmtCurrency(Number(pb.selling_price))} · MRP {fmtCurrency(Number(pb.mrp))} · {pb.available_stock} in stock
                        {pb.purchase_invoice_no && ` · Invoice ${pb.purchase_invoice_no}`}
                        {distributorName(pb.distributor_id) && ` · ${distributorName(pb.distributor_id)}`}
                      </li>
                    ))}
                  </ul>
                  {expiryDiffers && (
                    <p className="text-caption text-red-600">
                      Expiry differs from the earlier entry ({fmtDate(sameBatch[0].expiry_date)}). The same batch no. normally has the same expiry, so check the batch no. on the pack.
                    </p>
                  )}
                  <p className="text-caption text-[#996600]">
                    This purchase will be saved as a separate entry. If the earlier entry has a mistake (e.g. wrong quantity), fix it with Edit batch instead.
                  </p>
                </div>
              )}
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

            {matchedProduct ? (
              <div className="bg-[#FFF8E6] border border-[#FFE5B4] rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-body font-medium text-[#111]">This product is already in your catalog</p>
                  <p className="text-body-sm text-[#555] mt-1">
                    <span className="font-medium">{matchedProduct.name}</span> · {matchedProduct.company_name}
                  </p>
                  {(newSku || newHsn) && (
                    <p className="text-caption text-[#888] mt-1">The SKU / HSN you typed won&apos;t be applied. Use Edit product to change them.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => selectProduct(matchedProduct)}
                    className="flex-1 h-9 text-body font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] transition-colors"
                  >
                    Use this product
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatchedProduct(null)}
                    className="h-9 px-3 text-body text-[#555] border border-[#E5E5E5] rounded-lg bg-white hover:border-[#CCC] transition-colors"
                  >
                    Edit name
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
