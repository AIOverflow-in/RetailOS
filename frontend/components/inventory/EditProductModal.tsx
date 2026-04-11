'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

interface Product {
  product_id: string
  name: string
  company_name: string
  sku: string | null
  hsn_code: string | null
}

interface Props {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const fieldCls =
  'w-full h-8 px-3 text-[13px] bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCCCCC] transition-colors'

export default function EditProductModal({ product, open, onOpenChange, onSaved }: Props) {
  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [sku, setSku] = useState('')
  const [hsnCode, setHsnCode] = useState('')
  const [saving, setSaving] = useState(false)

  // Populate fields when modal opens with a product
  useEffect(() => {
    if (open && product) {
      setName(product.name)
      setCompanyName(product.company_name)
      setSku(product.sku ?? '')
      setHsnCode(product.hsn_code ?? '')
    }
  }, [open, product])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!product) return
    setSaving(true)
    try {
      await api.updateProduct(product.product_id, {
        name: name.trim(),
        company_name: companyName.trim(),
        sku: sku.trim() || null,
        hsn_code: hsnCode.trim() || null,
      })
      toast.success('Product updated')
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
          <DialogTitle className="text-[14px] font-semibold">Edit Product</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-[#BBBBBB]">Product name</p>
            <input className={fieldCls} value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-[#BBBBBB]">Company</p>
            <input className={fieldCls} value={companyName} onChange={e => setCompanyName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-[#BBBBBB]">SKU (optional)</p>
            <input className={fieldCls} value={sku} onChange={e => setSku(e.target.value)} />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-[#BBBBBB]">HSN Code (optional)</p>
            <input className={fieldCls} value={hsnCode} onChange={e => setHsnCode(e.target.value)} />
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
