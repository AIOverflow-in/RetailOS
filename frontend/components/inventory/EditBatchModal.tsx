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
}

interface Props {
  batch: BatchInfo | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const fieldCls =
  'w-full h-8 px-3 text-[13px] bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCCCCC] transition-colors'

export default function EditBatchModal({ batch, open, onOpenChange, onSaved }: Props) {
  const [buyingPrice, setBuyingPrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [mrp, setMrp] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [purchaseQty, setPurchaseQty] = useState('')
  const [boxNo, setBoxNo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && batch) {
      setBuyingPrice(String(batch.buying_price))
      setSellingPrice(String(batch.selling_price))
      setMrp(String(batch.mrp))
      setExpiryDate(batch.expiry_date?.slice(0, 10) ?? '')
      setPurchaseQty(String(batch.purchase_qty))
      setBoxNo(batch.box_no ?? '')
    }
  }, [open, batch])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!batch) return

    const bp = parseFloat(buyingPrice)
    const sp = parseFloat(sellingPrice)
    const m = parseFloat(mrp)
    const pq = parseInt(purchaseQty, 10)

    if (bp >= sp) {
      toast.error('Selling price must be greater than buying price')
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

    setSaving(true)
    try {
      await api.updateBatch(batch.batch_id, {
        buying_price: bp,
        selling_price: sp,
        mrp: m,
        expiry_date: expiryDate,
        purchase_qty: pq,
        box_no: boxNo.trim() || null,
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
          <DialogTitle className="text-[14px] font-semibold">
            Edit Batch {batch?.batch_no}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-[#BBBBBB]">Buying Price</p>
              <input type="number" step="0.01" min="0" className={fieldCls} value={buyingPrice} onChange={e => setBuyingPrice(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-[#BBBBBB]">Selling Price</p>
              <input type="number" step="0.01" min="0" className={fieldCls} value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-[#BBBBBB]">MRP</p>
              <input type="number" step="0.01" min="0" className={fieldCls} value={mrp} onChange={e => setMrp(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-[#BBBBBB]">Expiry Date</p>
            <input type="date" className={fieldCls} value={expiryDate} onChange={e => setExpiryDate(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-[#BBBBBB]">Purchase Qty</p>
              <input type="number" min="0" className={fieldCls} value={purchaseQty} onChange={e => setPurchaseQty(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-[#999]">
                Sold Qty <span className="text-[#CCCCCC]">(read-only)</span>
              </p>
              <input className={fieldCls + ' bg-[#F7F7F7] text-[#999] cursor-not-allowed'} value={batch?.sold_qty ?? 0} disabled />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-[#BBBBBB]">Box No (optional)</p>
            <input className={fieldCls} value={boxNo} onChange={e => setBoxNo(e.target.value)} />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full h-8 text-[13px] font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors mt-1"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
