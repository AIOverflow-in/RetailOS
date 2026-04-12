'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import type { Customer } from '@/types'

interface Props {
  customer: Customer | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const fieldCls =
  'w-full h-8 px-3 text-body bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCCCCC] transition-colors'

export default function EditCustomerModal({ customer, open, onOpenChange, onSaved }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [age, setAge] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && customer) {
      setName(customer.name)
      setPhone(customer.phone)
      setAge(customer.age != null ? String(customer.age) : '')
    }
  }, [open, customer])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customer) return

    if (phone.length !== 10) {
      toast.error('Phone must be exactly 10 digits')
      return
    }

    setSaving(true)
    try {
      await api.updateCustomer(customer.customer_id, {
        name: name.trim(),
        phone: phone.trim(),
        age: age ? parseInt(age, 10) : null,
      })
      toast.success('Customer updated')
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
          <DialogTitle className="text-subtitle font-semibold">Edit Customer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <p className="text-caption font-medium text-[#BBBBBB]">Name</p>
            <input className={fieldCls} value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <p className="text-caption font-medium text-[#BBBBBB]">Phone (10 digits)</p>
            <input className={fieldCls} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} required maxLength={10} />
          </div>
          <div className="space-y-1">
            <p className="text-caption font-medium text-[#BBBBBB]">Age (optional)</p>
            <input type="number" min="0" max="150" className={fieldCls} value={age} onChange={e => setAge(e.target.value)} />
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
