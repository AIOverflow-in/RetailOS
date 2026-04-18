'use client'

import { useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { setCustomer } from '@/store/cartSlice'
import type { RootState } from '@/store'

const inputClass = "h-8 px-3 text-body border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#CCCCCC] transition-colors placeholder:text-[#CCCCCC]"

export default function CustomerLookup() {
  const dispatch = useDispatch()
  const customer = useSelector((s: RootState) => s.cart.customer)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handlePhone(val: string) {
    dispatch(setCustomer({ ...customer, phone: val, name: '', age: '' }))
    if (timerRef.current) clearTimeout(timerRef.current)
    if (val.length === 10) {
      timerRef.current = setTimeout(() => lookup(val), 300)
    }
  }

  async function lookup(phone: string) {
    setLoading(true)
    try {
      const c = await api.lookupCustomer(phone)
      if (c) {
        dispatch(setCustomer({ phone, name: c.name, age: c.age ? String(c.age) : '' }))
        toast.success(`${c.name} — visit #${c.visit_count + 1}`)
      }
    } catch {
      // new customer — fine
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex gap-3 flex-wrap items-end">
      <div className="space-y-1.5">
        <p className="text-caption text-label font-medium">Phone</p>
        <div className="relative">
          <input
            className={`${inputClass} w-36`}
            maxLength={10}
            placeholder="9876543210"
            value={customer.phone}
            onChange={e => handlePhone(e.target.value.replace(/\D/g, ''))}
          />
          {loading && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-caption text-label">…</span>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-caption text-label font-medium">Name</p>
        <input
          className={`${inputClass} w-48`}
          placeholder="Patient name"
          value={customer.name}
          onChange={e => dispatch(setCustomer({ ...customer, name: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-caption text-label font-medium">Age</p>
        <input
          className={`${inputClass} w-16`}
          placeholder="—"
          value={customer.age}
          onChange={e => dispatch(setCustomer({ ...customer, age: e.target.value.replace(/\D/g, '') }))}
        />
      </div>
    </div>
  )
}
