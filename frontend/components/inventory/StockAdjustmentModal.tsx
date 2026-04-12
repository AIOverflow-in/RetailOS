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
  name: string
  purchase_qty: number
  sold_qty: number
  available_stock: number
}

interface Props {
  batch: BatchInfo | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const fieldCls =
  'w-full h-8 px-3 text-body bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCCCCC] transition-colors'

const REASONS = [
  { value: 'damage', label: 'Damage' },
  { value: 'theft', label: 'Theft' },
  { value: 'miscount', label: 'Miscount' },
  { value: 'physical_count', label: 'Physical Count' },
  { value: 'other', label: 'Other' },
]

export default function StockAdjustmentModal({ batch, open, onOpenChange, onSaved }: Props) {
  const [qtyChange, setQtyChange] = useState('')
  const [reason, setReason] = useState('miscount')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setQtyChange('')
      setReason('miscount')
      setNotes('')
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!batch) return

    const qty = parseInt(qtyChange, 10)
    if (isNaN(qty) || qty === 0) {
      toast.error('Qty change must be a non-zero number')
      return
    }

    setSaving(true)
    try {
      await api.createStockAdjustment({
        batch_id: batch.batch_id,
        qty_change: qty,
        reason,
        notes: notes.trim() || null,
      })
      toast.success(`Stock adjusted by ${qty > 0 ? '+' : ''}${qty}`)
      onOpenChange(false)
      onSaved()
    } catch (err: any) {
      toast.error(err.message || 'Adjustment failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-subtitle font-semibold">Adjust Stock</DialogTitle>
        </DialogHeader>

        {batch && (
          <div className="bg-[#F7F7F7] rounded-lg px-3 py-2.5 text-body-sm space-y-1">
            <p className="font-medium text-[#111]">{batch.name} &mdash; {batch.batch_no}</p>
            <p className="text-[#888]">
              Current stock: <span className="font-medium text-[#555]">{batch.available_stock}</span>
              {' '}(purchased: {batch.purchase_qty}, sold: {batch.sold_qty})
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <p className="text-caption font-medium text-[#BBBBBB]">Qty Change (+ to add, - to remove)</p>
            <input
              type="number"
              className={fieldCls}
              value={qtyChange}
              onChange={e => setQtyChange(e.target.value)}
              placeholder="e.g. -5 or +10"
              required
            />
          </div>
          <div className="space-y-1">
            <p className="text-caption font-medium text-[#BBBBBB]">Reason</p>
            <select
              className={fieldCls}
              value={reason}
              onChange={e => setReason(e.target.value)}
            >
              {REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <p className="text-caption font-medium text-[#BBBBBB]">Notes (optional)</p>
            <textarea
              className={fieldCls + ' h-16 py-2 resize-none'}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional details..."
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full h-8 text-body font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors mt-1"
          >
            {saving ? 'Adjusting...' : 'Apply Adjustment'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
