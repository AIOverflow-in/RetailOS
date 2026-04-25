'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { OrderItem } from '@/types'
import { fmtCurrency } from '@/lib/gst'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

export default function EditQuantityDialog({
  open, onOpenChange, orderId, item, onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  orderId: string
  item: OrderItem | null
  onSuccess: () => void
}) {
  const [qty, setQty] = useState<string>('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && item) {
      setQty(String(item.qty - item.returned_qty))
      setNote('')
      setError(null)
    }
  }, [open, item])

  if (!item) return null

  const active = item.qty - item.returned_qty
  const activeLineTotal = item.qty > 0
    ? Number(((item.line_total * active) / item.qty).toFixed(2))
    : 0

  async function submit() {
    if (!item) return
    const n = parseInt(qty)
    if (isNaN(n) || n < 0) {
      setError('Enter a valid quantity (0 or more)')
      return
    }
    if (n === active) {
      onOpenChange(false)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.editOrder(orderId, {
        edits: [{ item_id: item.item_id, new_qty: n }],
        additions: [],
        comment: note,
      })
      toast.success('Quantity updated')
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Quantity</DialogTitle>
        </DialogHeader>

        <div className="bg-[#FAFAFA] rounded-lg border border-[#EBEBEB] divide-y divide-[#EFEFEF]">
          <Row label="Medicine Name" value={<span className="text-blue-600 font-medium">{item.product_name}</span>} />
          <Row label="Quantity" value={<span className="text-blue-600 font-medium">{active}</span>} />
          <Row label="Price Per Unit" value={<span className="text-blue-600 font-medium">{fmtCurrency(item.sale_price)}</span>} />
          <Row label="Sub Total" value={<span className="text-blue-600 font-medium">{fmtCurrency(activeLineTotal)}</span>} />
          <Row label="GST" value={<span className="text-blue-600 font-medium">{item.gst_rate.toFixed(2)}%</span>} />
        </div>

        <div className="space-y-1">
          <label className="text-caption font-medium text-label">Quantity</label>
          <input
            type="number"
            min={0}
            className="w-full h-10 px-3 text-body border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#999] transition-colors"
            value={qty}
            onChange={e => { setQty(e.target.value); setError(null) }}
            autoFocus
          />
        </div>

        <div className="space-y-1">
          <label className="text-caption font-medium text-label">Note (optional)</label>
          <input
            type="text"
            className="w-full h-10 px-3 text-body border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#999] transition-colors"
            placeholder="Reason for change"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>

        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-body-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 px-5 text-body font-medium bg-[#888] text-white rounded-lg hover:bg-[#666] transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="h-9 px-5 text-body font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Updating…' : 'Update Quantity'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-body text-[#555]">{label}</span>
      <span className="text-body">{value}</span>
    </div>
  )
}
