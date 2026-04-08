'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Shield, Plus, LogOut, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

interface Tenant {
  tenant_id: string
  shop_name: string
  username: string
  order_prefix: string
  is_active: boolean
  created_at: string
}

function saRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sa_token') : null
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string>),
    },
  }).then(async res => {
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
    return data as T
  })
}

export default function SuperAdminPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ shop_name: '', username: '', password: '', order_prefix: 'INV' })

  const load = useCallback(async () => {
    try {
      const data = await saRequest<Tenant[]>('/super-admin/tenants')
      setTenants(data ?? [])
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('401')) {
        router.replace('/super-admin-login')
      } else {
        toast.error('Failed to load shops')
      }
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const token = localStorage.getItem('sa_token')
    if (!token) { router.replace('/super-admin-login'); return }
    load()
  }, [load, router])

  async function createShop(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      await saRequest('/super-admin/tenants', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      toast.success(`Shop "${form.shop_name}" created`)
      setShowCreate(false)
      setForm({ shop_name: '', username: '', password: '', order_prefix: 'INV' })
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create shop')
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(id: string, current: boolean) {
    try {
      await saRequest(`/super-admin/tenants/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !current }),
      })
      setTenants(t => t.map(x => x.tenant_id === id ? { ...x, is_active: !current } : x))
    } catch {
      toast.error('Update failed')
    }
  }

  function logout() {
    localStorage.removeItem('sa_token')
    router.replace('/super-admin-login')
  }

  const inp = "w-full h-9 px-3 text-[13px] border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#AAAAAA] transition-colors placeholder:text-[#DDDDDD]"

  return (
    <div className="min-h-screen bg-[#F4F4F4]">
      {/* Header */}
      <div className="bg-white border-b border-[#EBEBEB] px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#111] flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#111]">RetailOS</p>
            <p className="text-[11px] text-[#999]">Super Admin</p>
          </div>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-[12px] text-[#AAAAAA] hover:text-[#111] transition-colors">
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8 space-y-6">
        {/* Title */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#111]">Shops</h1>
            <p className="text-[13px] text-[#999] mt-0.5">
              {loading ? 'Loading…' : `${tenants.length} registered`}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(v => !v)}
            className="mt-1 flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Create Shop
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <form onSubmit={createShop} className="bg-white rounded-xl border border-[#EBEBEB] p-5 space-y-4">
            <p className="text-[12px] font-medium text-[#BBBBBB]">New Shop</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Shop name *', key: 'shop_name', placeholder: 'Sri Lakshmi Medical' },
                { label: 'Username *', key: 'username', placeholder: 'srilakshmi' },
                { label: 'Password *', key: 'password', placeholder: '••••••••', type: 'password' },
                { label: 'Order prefix', key: 'order_prefix', placeholder: 'INV' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key} className="space-y-1">
                  <p className="text-[11px] text-[#BBBBBB]">{label}</p>
                  <input
                    type={type || 'text'}
                    className={inp}
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    required={label.includes('*')}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={creating}
                className="h-8 px-4 text-[12px] font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors flex items-center gap-1.5">
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Create
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                className="h-8 px-4 text-[12px] text-[#AAAAAA] hover:text-[#111] transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Shops table */}
        {loading ? (
          <div className="bg-white rounded-xl border border-[#EBEBEB] p-8 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-[#CCCCCC] mx-auto" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#EBEBEB] py-20 text-center">
            <p className="text-[13px] text-[#AAAAAA]">No shops yet. Create the first one.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#EBEBEB] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F2F2F2]">
                  {['Shop', 'Username', 'Prefix', 'Created', 'Status', ''].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-[11px] font-medium text-[#BBBBBB]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.tenant_id} className="border-b border-[#F7F7F7] last:border-0 hover:bg-[#FAFAFA]">
                    <td className="py-3 px-4 text-[13px] font-medium text-[#111]">{t.shop_name}</td>
                    <td className="py-3 px-4 text-[13px] text-[#888] font-mono">{t.username}</td>
                    <td className="py-3 px-4 text-[12px] text-[#999] font-mono">{t.order_prefix}</td>
                    <td className="py-3 px-4 text-[12px] text-[#999]">
                      {new Date(t.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[12px] font-medium ${t.is_active ? 'text-emerald-600' : 'text-[#CCCCCC]'}`}>
                        ● {t.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button onClick={() => toggleActive(t.tenant_id, t.is_active)}
                        className="flex items-center gap-1 text-[12px] text-[#CCCCCC] hover:text-[#111] transition-colors">
                        {t.is_active
                          ? <><ToggleRight className="w-4 h-4 text-emerald-500" /> Deactivate</>
                          : <><ToggleLeft className="w-4 h-4" /> Activate</>
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
