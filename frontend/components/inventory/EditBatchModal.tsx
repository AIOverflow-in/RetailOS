'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

interface BatchInfo {
  batch_id: string
  batch_no: string
  buying_price: number
  selling_price: number
  mrp: number
  expiry_date: string
  purchase_qty: number
  sold_qty: number
  box_no: string | null
  purchase_gst_rate: number | null
  landing_price: number | null
  distributor_details: {
    name?: string
    location?: string
    phone?: string
    invoice_no?: string
  } | null
}

interface Props {
  batch: BatchInfo | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const fieldCls =
  'w-full h-8 px-3 text-body bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCCCCC] transition-colors'

export default function EditBatchModal({ batch, open, onOpenChange, onSaved }: Props) {
  const [buyingPrice, setBuyingPrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [mrp, setMrp] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [purchaseQty, setPurchaseQty] = useState('')
  const [boxNo, setBoxNo] = useState('')
  const [purchaseGSTRate, setPurchaseGSTRate] = useState<number | ''>('')
  const [distributorName, setDistributorName] = useState('')
  const [distributorLocation, setDistributorLocation] = useState('')
  const [distributorPhone, setDistributorPhone] = useState('')
  const [distributorInvoiceNo, setDistributorInvoiceNo] = useState('')
  const [showDistributorDetails, setShowDistributorDetails] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && batch) {
      setBuyingPrice(String(batch.buying_price))
      setSellingPrice(String(batch.selling_price))
      setMrp(String(batch.mrp))
      setExpiryDate(batch.expiry_date?.slice(0, 10) ?? '')
      setPurchaseQty(String(batch.purchase_qty))
      setBoxNo(batch.box_no ?? '')
      setPurchaseGSTRate(batch.purchase_gst_rate ?? '')
      setDistributorName(batch.distributor_details?.name ?? '')
      setDistributorLocation(batch.distributor_details?.location ?? '')
      setDistributorPhone(batch.distributor_details?.phone ?? '')
      setDistributorInvoiceNo(batch.distributor_details?.invoice_no ?? '')
      setShowDistributorDetails(!!(batch.distributor_details && Object.values(batch.distributor_details).some(v => v)))
    }
  }, [open, batch])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!batch) return

    const bp = parseFloat(buyingPrice)
    const sp = parseFloat(sellingPrice)
    const m = parseFloat(mrp)
    const pq = parseInt(purchaseQty, 10)
    const gstRate = typeof purchaseGSTRate === 'number' ? purchaseGSTRate : 0
    const landingPrice = bp * (1 + gstRate / 100)
    const costPrice = gstRate > 0 ? landingPrice : bp

    if (costPrice >= sp) {
      toast.error('Selling price must be greater than landing price')
      return
    }
    if (sp >= m) {
      toast.error('MRP must be greater than selling price')
      return
    }
    if (pq < batch.sold_qty) {
      toast.error(`Purchase qty cannot be less than sold qty (${batch.sold_qty})`)
      return
    }

    const distributorDetails = (distributorName || distributorLocation || distributorPhone || distributorInvoiceNo)
      ? {
          name: distributorName || undefined,
          location: distributorLocation || undefined,
          phone: distributorPhone || undefined,
          invoice_no: distributorInvoiceNo || undefined,
        }
      : null

    setSaving(true)
    try {
      await api.updateBatch(batch.batch_id, {
        buying_price: bp,
        selling_price: sp,
        mrp: m,
        expiry_date: expiryDate,
        purchase_qty: pq,
        box_no: boxNo.trim() || null,
        purchase_gst_rate: typeof purchaseGSTRate === 'number' ? purchaseGSTRate : undefined,
        distributor_details: distributorDetails,
      })
      toast.success('Batch updated')
      onOpenChange(false)
      onSaved()
    } catch (err: any) {
      toast.error(err.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-subtitle font-semibold">
            Edit Batch {batch?.batch_no}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <p className="text-caption font-medium text-[#BBBBBB]">Buying Price</p>
              <input type="number" step="0.01" min="0" className={fieldCls} value={buyingPrice} onChange={e => setBuyingPrice(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <p className="text-caption font-medium text-[#BBBBBB]">Selling Price</p>
              <input type="number" step="0.01" min="0" className={fieldCls} value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <p className="text-caption font-medium text-[#BBBBBB]">MRP</p>
              <input type="number" step="0.01" min="0" className={fieldCls} value={mrp} onChange={e => setMrp(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-caption font-medium text-[#BBBBBB]">Expiry Date</p>
            <input type="date" className={fieldCls} value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-caption font-medium text-[#BBBBBB]">Purchase Qty</p>
              <input type="number" min="0" className={fieldCls} value={purchaseQty} onChange={e => setPurchaseQty(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <p className="text-caption font-medium text-[#999]">
                Sold Qty <span className="text-[#CCCCCC]">(read-only)</span>
              </p>
              <input className={fieldCls + ' bg-[#F7F7F7] text-[#999] cursor-not-allowed'} value={batch?.sold_qty ?? 0} disabled />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-caption font-medium text-[#BBBBBB]">Box No (optional)</p>
            <input className={fieldCls} value={boxNo} onChange={e => setBoxNo(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-caption font-medium text-[#BBBBBB]">Purchase GST Rate (%)</p>
              <select
                className={fieldCls}
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
                <p className="text-caption font-medium text-[#BBBBBB]">Landing Price (₹)</p>
                <div className={fieldCls + ' bg-[#F7F7F7] text-[#666] flex items-center'}>
                  {buyingPrice ? (parseFloat(buyingPrice) * (1 + (typeof purchaseGSTRate === 'number' ? purchaseGSTRate : 0) / 100)).toFixed(2) : '—'}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowDistributorDetails(!showDistributorDetails)}
              className="flex items-center gap-2 text-caption font-medium text-[#BBBBBB] hover:text-[#111] transition-colors"
            >
              <span className="text-lg">{showDistributorDetails ? '▼' : '▶'}</span>
              Distributor Details (Optional)
            </button>
            {showDistributorDetails && (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <p className="text-caption font-medium text-[#BBBBBB]">Name</p>
                  <input className={fieldCls} placeholder="e.g., ABC Pharma" value={distributorName} onChange={e => setDistributorName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <p className="text-caption font-medium text-[#BBBBBB]">Location</p>
                  <input className={fieldCls} placeholder="e.g., Mumbai" value={distributorLocation} onChange={e => setDistributorLocation(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <p className="text-caption font-medium text-[#BBBBBB]">Phone</p>
                  <input className={fieldCls} placeholder="e.g., 9876543210" value={distributorPhone} onChange={e => setDistributorPhone(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <p className="text-caption font-medium text-[#BBBBBB]">Invoice No.</p>
                  <input className={fieldCls} placeholder="e.g., INV-2026-001" value={distributorInvoiceNo} onChange={e => setDistributorInvoiceNo(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full h-8 text-body font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors mt-1"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
