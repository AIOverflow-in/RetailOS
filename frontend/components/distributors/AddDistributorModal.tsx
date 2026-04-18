'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { clearDistributorCache } from '@/lib/distributorCache'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const fieldCls =
  'w-full h-8 px-3 text-body bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCCCCC] transition-colors'

export default function AddDistributorModal({ open, onOpenChange, onSaved }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  function reset() {
    setName(''); setPhone(''); setAddress(''); setEmail('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Name is required'); return }

    setSaving(true)
    try {
      await api.createDistributor({
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        email: email.trim() || null,
      })
      toast.success('Distributor added')
      clearDistributorCache()
      onOpenChange(false)
      reset()
      onSaved()
    } catch (err: any) {
      toast.error(err.message || 'Failed to add distributor')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-subtitle font-semibold">Add Distributor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <p className="text-caption font-medium text-[#BBBBBB]">Name <span className="text-red-400">*</span></p>
            <input className={fieldCls} value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Medico Distributors" />
          </div>
          <div className="space-y-1">
            <p className="text-caption font-medium text-[#BBBBBB]">Phone (optional)</p>
            <input className={fieldCls} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 15))} placeholder="10-digit phone" />
          </div>
          <div className="space-y-1">
            <p className="text-caption font-medium text-[#BBBBBB]">Address (optional)</p>
            <input className={fieldCls} value={address} onChange={e => setAddress(e.target.value)} placeholder="City or full address" />
          </div>
          <div className="space-y-1">
            <p className="text-caption font-medium text-[#BBBBBB]">Email (optional)</p>
            <input type="email" className={fieldCls} value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@distributor.com" />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full h-8 text-body font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors mt-1"
          >
            {saving ? 'Adding...' : 'Add Distributor'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
