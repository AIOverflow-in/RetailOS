'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { superAdminApi } from '@/lib/super-admin-api'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import TableSkeleton from '@/components/shared/TableSkeleton'
import { fmtDate } from '@/lib/gst'

interface Tenant {
  tenant_id: string
  shop_name: string
  username: string
  is_active: boolean
  created_at: string
}

export default function SuperAdminDashboard() {
  const router = useRouter()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [shopName, setShopName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [orderPrefix, setOrderPrefix] = useState('')
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    try { setTenants((await superAdminApi.listTenants() as Tenant[]) ?? []) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function createTenant(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      await superAdminApi.createTenant({ shop_name: shopName, username, password, order_prefix: orderPrefix })
      toast.success(`Shop "${shopName}" created`)
      setOpen(false)
      setShopName(''); setUsername(''); setPassword(''); setOrderPrefix('')
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create shop')
    } finally {
      setCreating(false)
    }
  }

  async function toggleActive(id: string, current: boolean) {
    try {
      await superAdminApi.setTenantActive(id, !current)
      setTenants(ts => ts.map(t => t.tenant_id === id ? { ...t, is_active: !current } : t))
    } catch { toast.error('Update failed') }
  }

  function logout() {
    localStorage.removeItem('sa_token')
    router.replace('/super-admin/login')
  }

  const fieldCls = "w-full h-8 px-3 text-body border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#CCCCCC] transition-colors"

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-heading-xl font-bold tracking-tight text-[#111]">Super Admin</h1>
            <p className="text-body text-[#999] mt-0.5">{tenants.length} shops</p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                render={
                  <Button size="sm" className="gap-1.5 h-8 text-body-sm bg-[#111] hover:bg-[#333]">
                    <Plus className="w-3.5 h-3.5" /> Create Shop
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-subtitle font-semibold">Create new shop</DialogTitle>
                </DialogHeader>
                <form onSubmit={createTenant} className="space-y-3 pt-1">
                  {[
                    { label: 'Shop name', val: shopName, set: setShopName, type: 'text' },
                    { label: 'Username', val: username, set: setUsername, type: 'text' },
                    { label: 'Password', val: password, set: setPassword, type: 'password' },
                    { label: 'Order prefix (e.g. INV)', val: orderPrefix, set: (v: string) => setOrderPrefix(v.toUpperCase()), type: 'text' },
                  ].map(({ label, val, set, type }) => (
                    <div key={label} className="space-y-1">
                      <p className="text-caption font-medium text-[#BBBBBB]">{label}</p>
                      <input type={type} className={fieldCls} value={val} onChange={e => set(e.target.value)} required />
                    </div>
                  ))}
                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full h-8 text-body font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors mt-1"
                  >
                    {creating ? 'Creating...' : 'Create Shop'}
                  </button>
                </form>
              </DialogContent>
            </Dialog>
            <button
              onClick={logout}
              className="h-8 px-3 flex items-center gap-1.5 text-body-sm text-[#999] hover:text-[#111] border border-[#E5E5E5] rounded-lg hover:border-[#CCC] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>

        {loading ? (
          <TableSkeleton cols={5} />
        ) : tenants.length === 0 ? (
          <div className="bg-white rounded-lg border border-[#EBEBEB] py-20 text-center">
            <p className="text-body text-[#AAAAAA]">No shops yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-[#EBEBEB] overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F2F2F2]">
                  {['Shop', 'Username', 'Created', 'Status', ''].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-caption font-medium text-[#BBBBBB]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.tenant_id} className="border-b border-[#F7F7F7] last:border-0 hover:bg-[#FAFAFA] transition-colors">
                    <td className="py-3 px-4 text-body font-medium text-[#111]">{t.shop_name}</td>
                    <td className="py-3 px-4 text-body text-[#888]">{t.username}</td>
                    <td className="py-3 px-4 text-body text-[#888]">{fmtDate(t.created_at)}</td>
                    <td className="py-3 px-4">
                      <span className={`text-body-sm font-medium ${t.is_active ? 'text-emerald-600' : 'text-[#CCCCCC]'}`}>
                        {t.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        className="text-body-sm text-[#CCCCCC] hover:text-[#111] transition-colors"
                        onClick={() => toggleActive(t.tenant_id, t.is_active)}
                      >
                        {t.is_active ? 'Deactivate' : 'Activate'}
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
