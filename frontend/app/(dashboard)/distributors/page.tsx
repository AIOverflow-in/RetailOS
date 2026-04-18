'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, Plus, Pencil, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { clearDistributorCache, setCachedDistributors } from '@/lib/distributorCache'
import type { Distributor, DistributorBatchRow } from '@/types'
import TableSkeleton from '@/components/shared/TableSkeleton'
import AddDistributorModal from '@/components/distributors/AddDistributorModal'
import EditDistributorModal from '@/components/distributors/EditDistributorModal'

function fmtCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function DistributorsPage() {
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  // Stock view
  const [selectedId, setSelectedId] = useState<string>('')
  const [batches, setBatches] = useState<DistributorBatchRow[]>([])
  const [batchesLoading, setBatchesLoading] = useState(false)

  // Modals
  const [addOpen, setAddOpen] = useState(false)
  const [editDistributor, setEditDistributor] = useState<Distributor | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  // Delete confirmation
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchDistributors = useCallback(() => {
    setLoading(true)
    api.listDistributors()
      .then(list => {
        setDistributors(list ?? [])
        setCachedDistributors(list ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchDistributors() }, [fetchDistributors])

  useEffect(() => {
    if (!selectedId) { setBatches([]); return }
    setBatchesLoading(true)
    api.listBatchesByDistributor(selectedId)
      .then(rows => setBatches(rows ?? []))
      .catch(() => setBatches([]))
      .finally(() => setBatchesLoading(false))
  }, [selectedId])

  async function handleDelete(d: Distributor) {
    if (!confirm(`Delete "${d.name}"?\n\nCannot delete if batches are linked — reassign them first.\n\nThis cannot be undone.`)) return
    setDeleting(d.distributor_id)
    try {
      await api.deleteDistributor(d.distributor_id)
      toast.success('Distributor deleted')
      clearDistributorCache()
      if (selectedId === d.distributor_id) setSelectedId('')
      fetchDistributors()
    } catch (err: any) {
      toast.error(err.message || 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  const filtered = distributors.filter(d =>
    !q || d.name.toLowerCase().includes(q.toLowerCase())
  )

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-heading-xl font-bold tracking-tight text-[#111]">Distributors</h1>
          <p className="text-body text-[#999] mt-0.5">
            {loading ? 'Loading…' : `${distributors.length} distributor${distributors.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 h-8 px-3 text-body font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Distributor
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CCCCCC]" />
        <input
          className="w-full h-9 pl-9 pr-4 text-body bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCCCCC] transition-colors placeholder:text-[#CCCCCC]"
          placeholder="Search distributors…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      {/* Distributors table */}
      {loading ? (
        <TableSkeleton cols={5} />
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#EBEBEB] py-20 text-center">
          <p className="text-body text-[#AAAAAA]">
            {q ? 'No distributors match your search.' : 'No distributors yet. Add one to get started.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-[#EBEBEB] overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F2F2F2]">
                {['Name', 'Phone', 'Email', 'Address', 'Status', ''].map(h => (
                  <th key={h || 'actions'} className="text-left py-2.5 px-4 text-caption font-medium text-[#BBBBBB] whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr
                  key={d.distributor_id}
                  className="border-b border-[#F7F7F7] last:border-0 hover:bg-[#FAFAFA] transition-colors"
                >
                  <td className="py-3 px-4 text-body font-medium text-[#111]">{d.name}</td>
                  <td className="py-3 px-4 text-body text-[#888] font-mono">{d.phone ?? '—'}</td>
                  <td className="py-3 px-4 text-body text-[#888]">{d.email ?? '—'}</td>
                  <td className="py-3 px-4 text-body text-[#999]">{d.address ?? '—'}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-caption font-medium ${d.is_active ? 'bg-green-50 text-green-700' : 'bg-[#F5F5F5] text-[#AAAAAA]'}`}>
                      {d.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditDistributor(d); setEditOpen(true) }}
                        className="p-1.5 rounded-md text-[#CCCCCC] hover:text-[#555] hover:bg-[#F2F2F2] transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(d)}
                        disabled={deleting === d.distributor_id}
                        className="p-1.5 rounded-md text-[#CCCCCC] hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stock view by distributor */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-subtitle font-semibold text-[#111]">Stock by Distributor</h2>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="h-8 px-3 text-body bg-white border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#CCCCCC] transition-colors text-[#555]"
          >
            <option value="">Select a distributor…</option>
            {distributors.filter(d => d.is_active).map(d => (
              <option key={d.distributor_id} value={d.distributor_id}>{d.name}</option>
            ))}
          </select>
        </div>

        {selectedId && (
          batchesLoading ? (
            <TableSkeleton cols={6} />
          ) : batches.length === 0 ? (
            <div className="bg-white rounded-lg border border-[#EBEBEB] py-12 text-center">
              <p className="text-body text-[#AAAAAA]">No batches linked to this distributor.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-[#EBEBEB] overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F2F2F2]">
                    {['Product', 'Batch No', 'Expiry', 'MRP', 'Selling', 'Available', 'Invoice No'].map(h => (
                      <th key={h} className="text-left py-2.5 px-4 text-caption font-medium text-[#BBBBBB] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {batches.map(b => {
                    const isExpired = new Date(b.expiry_date) < new Date()
                    const isLow = b.available_stock > 0 && b.available_stock < 10
                    return (
                      <tr key={b.batch_id} className="border-b border-[#F7F7F7] last:border-0 hover:bg-[#FAFAFA] transition-colors">
                        <td className="py-3 px-4 text-body font-medium text-[#111]">
                          {b.product_name}
                          <span className="block text-caption text-[#AAAAAA]">{b.company_name}</span>
                        </td>
                        <td className="py-3 px-4 text-body font-mono text-[#888]">{b.batch_no}</td>
                        <td className="py-3 px-4 text-body text-[#888]">
                          <span className={isExpired ? 'text-red-500' : ''}>
                            {new Date(b.expiry_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-body text-[#888]">{fmtCurrency(b.mrp)}</td>
                        <td className="py-3 px-4 text-body text-[#888]">{fmtCurrency(b.selling_price)}</td>
                        <td className="py-3 px-4 text-body">
                          <span className={isLow ? 'text-amber-600 font-medium' : isExpired ? 'text-[#AAAAAA]' : 'text-[#111]'}>
                            {b.available_stock}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-body text-[#888] font-mono">{b.purchase_invoice_no ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <AddDistributorModal open={addOpen} onOpenChange={setAddOpen} onSaved={fetchDistributors} />
      <EditDistributorModal
        distributor={editDistributor}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={fetchDistributors}
      />
    </div>
  )
}
