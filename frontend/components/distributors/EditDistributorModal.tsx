'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { clearDistributorCache } from '@/lib/distributorCache'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import type { Distributor } from '@/types'

interface Props {
  distributor: Distributor | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const fieldCls =
  'w-full h-8 px-3 text-body bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCCCCC] transition-colors'

export default function EditDistributorModal({ distributor, open, onOpenChange, onSaved }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && distributor) {
      setName(distributor.name)
      setPhone(distributor.phone ?? '')
      setAddress(distributor.address ?? '')
      setEmail(distributor.email ?? '')
      setIsActive(distributor.is_active)
    }
  }, [open, distributor])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!distributor) return
    if (!name.trim()) { toast.error('Name is required'); return }

    setSaving(true)
    try {
      await api.updateDistributor(distributor.distributor_id, {
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        email: email.trim() || null,
        is_active: isActive,
      })
      toast.success('Distributor updated')
      clearDistributorCache()
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
          <DialogTitle className="text-subtitle font-semibold">Edit Distributor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <p className="text-caption font-medium text-label">Name <span className="text-red-400">*</span></p>
            <input className={fieldCls} value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <p className="text-caption font-medium text-label">Phone (optional)</p>
            <input className={fieldCls} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 15))} />
          </div>
          <div className="space-y-1">
            <p className="text-caption font-medium text-label">Address (optional)</p>
            <input className={fieldCls} value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1">
            <p className="text-caption font-medium text-label">Email (optional)</p>
            <input type="email" className={fieldCls} value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded accent-[#111]"
            />
            <span className="text-body text-[#555]">Active</span>
          </label>
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
