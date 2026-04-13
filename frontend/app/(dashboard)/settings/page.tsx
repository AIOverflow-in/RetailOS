'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { ShopSettings } from '@/types'

const fieldCls =
  'w-full h-9 px-3 text-body bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCCCCC] transition-colors'

const textareaCls =
  'w-full px-3 py-2 text-body bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCCCCC] transition-colors resize-none'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [storeAddress, setStoreAddress] = useState('')
  const [gstin, setGstin] = useState('')
  const [drugLicense, setDrugLicense] = useState('')
  const [foodLicense, setFoodLicense] = useState('')
  const [otherLicenses, setOtherLicenses] = useState('')
  const [storePolicies, setStorePolicies] = useState('')

  useEffect(() => {
    api.getSettings()
      .then(s => {
        setStoreAddress(s.store_address ?? '')
        setGstin(s.gstin ?? '')
        setDrugLicense(s.drug_license ?? '')
        setFoodLicense(s.food_license ?? '')
        setOtherLicenses(s.other_licenses ?? '')
        setStorePolicies(s.store_policies ?? '')
      })
      .catch(err => toast.error(err.message || 'Could not load settings'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload: ShopSettings = {
      store_address: storeAddress.trim(),
      gstin: gstin.trim(),
      drug_license: drugLicense.trim(),
      food_license: foodLicense.trim(),
      other_licenses: otherLicenses.trim(),
      store_policies: storePolicies.trim(),
    }
    try {
      await api.updateSettings(payload)
      toast.success('Settings saved')
    } catch (err: any) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-heading-xl font-bold tracking-tight text-[#111]">Settings</h1>
        <p className="text-body text-[#999] mt-0.5">
          Shop details, GSTIN and license information
        </p>
      </div>

      {loading ? (
        <p className="text-body text-[#999]">Loading…</p>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">

          <div className="space-y-1.5">
            <p className="text-caption font-medium text-[#BBBBBB] uppercase tracking-wide">
              Store Address
            </p>
            <textarea
              className={textareaCls}
              rows={3}
              value={storeAddress}
              onChange={e => setStoreAddress(e.target.value)}
              placeholder="Full store address including pincode"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-caption font-medium text-[#BBBBBB] uppercase tracking-wide">
              GSTIN
            </p>
            <input
              className={fieldCls}
              value={gstin}
              onChange={e => setGstin(e.target.value.toUpperCase())}
              placeholder="e.g. 33AABCU9603R1ZM"
              maxLength={15}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-caption font-medium text-[#BBBBBB] uppercase tracking-wide">
              Drug License Number
            </p>
            <input
              className={fieldCls}
              value={drugLicense}
              onChange={e => setDrugLicense(e.target.value)}
              placeholder="e.g. TN/25/20/1234"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-caption font-medium text-[#BBBBBB] uppercase tracking-wide">
              Food License Number (FSSAI)
            </p>
            <input
              className={fieldCls}
              value={foodLicense}
              onChange={e => setFoodLicense(e.target.value)}
              placeholder="FSSAI number"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-caption font-medium text-[#BBBBBB] uppercase tracking-wide">
              Other License Details
            </p>
            <textarea
              className={textareaCls}
              rows={3}
              value={otherLicenses}
              onChange={e => setOtherLicenses(e.target.value)}
              placeholder="Any additional license or registration details"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-caption font-medium text-[#BBBBBB] uppercase tracking-wide">
              Store Policies
            </p>
            <textarea
              className={textareaCls}
              rows={4}
              value={storePolicies}
              onChange={e => setStorePolicies(e.target.value)}
              placeholder="Return, exchange or refund policies to show on bills"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="h-9 px-6 text-body font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      )}
    </div>
  )
}
