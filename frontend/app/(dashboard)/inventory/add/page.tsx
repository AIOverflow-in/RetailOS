'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { Product } from '@/types'
import { useProductSearch } from '@/lib/useProductSearch'
import { ArrowLeft } from 'lucide-react'

export default function AddStockPage() {
  const router = useRouter()

  const { query, suggestions, handleQuery, triggerPreload, setQuery, setSuggestions } = useProductSearch()
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
  const [distributorName, setDistributorName] = useState('')
  const [distributorLocation, setDistributorLocation] = useState('')
  const [distributorPhone, setDistributorPhone] = useState('')
  const [distributorInvoiceNo, setDistributorInvoiceNo] = useState('')
  const [loading, setLoading] = useState(false)

  function selectProduct(p: Product) {
    setSelectedProduct(p)
    setQuery(p.name)
    setSuggestions([])
    setIsNewProduct(false)
    setFocused(false)
  }

  function startNewProduct() {
    setIsNewProduct(true)
    setSelectedProduct(null)
    setNewProductName(query)
    setSuggestions([])
    setFocused(false)
  }

  function handleInputChange(val: string) {
    setSelectedProduct(null)
    setIsNewProduct(false)
    handleQuery(val)
  }

  const b = parseFloat(buyingPrice), s = parseFloat(sellingPrice), m = parseFloat(mrp)
  const gstRate = typeof purchaseGSTRate === 'number' ? purchaseGSTRate : 0
  const landingPrice = b * (1 + gstRate / 100)
  const costPrice = gstRate > 0 ? landingPrice : b
  const priceError =
    buyingPrice && sellingPrice && costPrice >= s ? 'Selling price must be > landing price' :
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
      const distributorDetails = (distributorName || distributorLocation || distributorPhone || distributorInvoiceNo)
        ? {
            name: distributorName || undefined,
            location: distributorLocation || undefined,
            phone: distributorPhone || undefined,
            invoice_no: distributorInvoiceNo || undefined,
          }
        : null

      await api.createBatch({
        product_id: productId, batch_no: batchNo, expiry_date: expiryDate,
        mrp: parseFloat(mrp), buying_price: parseFloat(buyingPrice),
        selling_price: parseFloat(sellingPrice), purchase_qty: parseInt(purchaseQty),
        box_no: boxNo || null,
        purchase_gst_rate: typeof purchaseGSTRate === 'number' ? purchaseGSTRate : undefined,
        distributor_details: distributorDetails,
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
  const inp = "w-full h-8 px-3 text-body border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#CCCCCC] transition-colors placeholder:text-[#CCCCCC]"
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
        <div className="grid grid-cols-2 gap-4 items-start">

          {/* Left column: Product + Batch Details */}
          <div className="space-y-4">

            {/* Product */}
            <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 space-y-3">
              <p className="text-caption font-medium text-[#BBBBBB]">Product</p>
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
                    {query.trim().length > 0 && (
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
                    { label: 'Company *', val: newCompanyName, set: setNewCompanyName },
                    { label: 'SKU', val: newSku, set: setNewSku },
                    { label: 'HSN Code', val: newHsn, set: setNewHsn },
                  ].map(({ label, val, set }) => (
                    <div key={label} className="space-y-1">
                      <p className="text-caption text-[#BBBBBB]">{label}</p>
                      <input className={inp} value={val} onChange={e => set(e.target.value)} required={label.includes('*')} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Batch Details */}
            <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 space-y-3">
              <p className="text-caption font-medium text-[#BBBBBB]">Batch Details</p>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <p className="text-caption text-[#BBBBBB]">Batch no. *</p>
                  <input className={inp} value={batchNo} onChange={e => setBatchNo(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <p className="text-caption text-[#BBBBBB]">Expiry date *</p>
                  <input type="date" className={inp} value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <p className="text-caption text-[#BBBBBB]">Buying price (₹) *</p>
                  <input type="number" min={0} step={0.01} className={inp} value={buyingPrice} onChange={e => setBuyingPrice(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <p className="text-caption text-[#BBBBBB]">Purchase GST Rate (%)</p>
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
                    <p className="text-caption text-[#BBBBBB]">Landing Price (₹)</p>
                    <div className="w-full h-8 px-3 py-1.5 text-body bg-[#F7F7F7] border border-[#E5E5E5] rounded-lg text-[#666] flex items-center">
                      {buyingPrice ? (parseFloat(buyingPrice) * (1 + (typeof purchaseGSTRate === 'number' ? purchaseGSTRate : 0) / 100)).toFixed(2) : '—'}
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-caption text-[#BBBBBB]">Selling price (₹) *</p>
                  <input type="number" min={0} step={0.01}
                    className={priceError?.includes('Selling') ? errInp : inp}
                    value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <p className="text-caption text-[#BBBBBB]">MRP (₹) *</p>
                  <input type="number" min={0} step={0.01}
                    className={priceError?.includes('MRP') ? errInp : inp}
                    value={mrp} onChange={e => setMrp(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <p className="text-caption text-[#BBBBBB]">Purchase qty *</p>
                  <input type="number" min={1} className={inp} value={purchaseQty} onChange={e => setPurchaseQty(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <p className="text-caption text-[#BBBBBB]">Box no.</p>
                  <input className={inp} value={boxNo} onChange={e => setBoxNo(e.target.value)} />
                </div>
              </div>
              {priceError && <p className="text-body-sm text-red-500">{priceError}</p>}
            </div>

          </div>

          {/* Right column: Distributor Details + Submit */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 space-y-3">
              <p className="text-caption font-medium text-[#BBBBBB]">Distributor Details <span className="font-normal text-[#DDDDDD]">(optional)</span></p>
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <p className="text-caption text-[#BBBBBB]">Distributor name</p>
                  <input className={inp} placeholder="e.g., ABC Pharma" value={distributorName} onChange={e => setDistributorName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <p className="text-caption text-[#BBBBBB]">Location</p>
                  <input className={inp} placeholder="e.g., Mumbai" value={distributorLocation} onChange={e => setDistributorLocation(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <p className="text-caption text-[#BBBBBB]">Phone</p>
                  <input className={inp} placeholder="e.g., 9876543210" value={distributorPhone} onChange={e => setDistributorPhone(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <p className="text-caption text-[#BBBBBB]">Invoice no.</p>
                  <input className={inp} placeholder="e.g., INV-2026-001" value={distributorInvoiceNo} onChange={e => setDistributorInvoiceNo(e.target.value)} />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !productReady}
              className="w-full h-9 text-body font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] disabled:opacity-40 transition-colors"
            >
              {loading ? 'Adding…' : 'Add Stock'}
            </button>
          </div>

        </div>
      </form>
    </div>
  )
}
