'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { getCachedSettings, setCachedSettings } from '@/lib/settingsCache'
import type { ShopSettings } from '@/types'

const fieldCls =
  'w-full h-9 px-3 text-body bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCCCCC] transition-colors'

const textareaCls =
  'w-full px-3 py-2 text-body bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCCCCC] transition-colors resize-none'

export default function SettingsPage() {
  const cached = typeof window !== 'undefined' ? getCachedSettings() : null

  const [loading, setLoading] = useState(!cached)
  const [saving, setSaving] = useState(false)

  const [storeAddress, setStoreAddress] = useState(cached?.store_address ?? '')
  const [gstin, setGstin] = useState(cached?.gstin ?? '')
  const [drugLicense, setDrugLicense] = useState(cached?.drug_license ?? '')
  const [foodLicense, setFoodLicense] = useState(cached?.food_license ?? '')
  const [otherLicenses, setOtherLicenses] = useState(cached?.other_licenses ?? '')
  const [storePolicies, setStorePolicies] = useState(cached?.store_policies ?? '')
  const [googleReviewLink, setGoogleReviewLink] = useState(cached?.google_review_link ?? '')

  useEffect(() => {
    api.getSettings()
      .then(s => {
        const fresh: ShopSettings = {
          store_address: s.store_address ?? '',
          gstin: s.gstin ?? '',
          drug_license: s.drug_license ?? '',
          food_license: s.food_license ?? '',
          other_licenses: s.other_licenses ?? '',
          store_policies: s.store_policies ?? '',
          google_review_link: s.google_review_link ?? '',
        }
        const prev = getCachedSettings()
        if (!prev || JSON.stringify(prev) !== JSON.stringify(fresh)) {
          setStoreAddress(fresh.store_address!)
          setGstin(fresh.gstin!)
          setDrugLicense(fresh.drug_license!)
          setFoodLicense(fresh.food_license!)
          setOtherLicenses(fresh.other_licenses!)
          setStorePolicies(fresh.store_policies!)
          setGoogleReviewLink(fresh.google_review_link ?? '')
          setCachedSettings(fresh)
        }
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
      google_review_link: googleReviewLink.trim() || undefined,
    }
    try {
      await api.updateSettings(payload)
      setCachedSettings(payload)
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
            <p className="text-caption font-medium text-label uppercase tracking-wide">
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
            <p className="text-caption font-medium text-label uppercase tracking-wide">
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
            <p className="text-caption font-medium text-label uppercase tracking-wide">
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
            <p className="text-caption font-medium text-label uppercase tracking-wide">
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
            <p className="text-caption font-medium text-label uppercase tracking-wide">
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
            <p className="text-caption font-medium text-label uppercase tracking-wide">
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

          <div className="space-y-1.5">
            <p className="text-caption font-medium text-label uppercase tracking-wide">
              Google Review Link
            </p>
            <input
              className={fieldCls}
              value={googleReviewLink}
              onChange={e => setGoogleReviewLink(e.target.value)}
              placeholder="https://g.page/r/..."
              type="url"
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
