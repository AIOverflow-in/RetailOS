'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { api } from '@/lib/api'
import type { GSTReport } from '@/types'
import { fmtCurrency } from '@/lib/gst'
import { Skeleton } from '@/components/ui/skeleton'

function currentFY() {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return { from: `${year}-04-01`, to: `${year + 1}-03-31` }
}

export default function ReportsPage() {
  const fy = currentFY()
  const [from, setFrom] = useState(fy.from)
  const [to, setTo] = useState(fy.to)
  const [report, setReport] = useState<GSTReport | null>(null)
  const [loading, setLoading] = useState(false)

  async function fetchReport() {
    setLoading(true)
    try { setReport(await api.gstReport(from, to)) }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed') }
    finally { setLoading(false) }
  }

  function downloadCSV() {
    const url = api.gstReportExportURL(from, to)
    const token = localStorage.getItem('token')
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `gst-report-${from}-to-${to}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
      })
      .catch(() => toast.error('Export failed'))
  }

  const s = report?.summary
  const dateInput = "h-8 px-3 text-body border border-[#E5E5E5] rounded-lg bg-white focus:outline-none focus:border-[#CCCCCC] transition-colors"

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-heading-xl font-bold tracking-tight text-[#111]">GST Report</h1>
        <p className="text-body text-[#999] mt-0.5">Tax summary by date range</p>
      </div>

      {/* Date range controls */}
      <div className="bg-white rounded-lg border border-[#EBEBEB] p-5 flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <p className="text-caption font-medium text-[#BBBBBB]">From</p>
          <input type="date" className={`${dateInput} w-40`} value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <p className="text-caption font-medium text-[#BBBBBB]">To</p>
          <input type="date" className={`${dateInput} w-40`} value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchReport}
            disabled={loading}
            className="h-8 px-4 text-body-sm font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Loading…' : 'Generate'}
          </button>
          {report && (
            <button
              onClick={downloadCSV}
              className="h-8 px-3 text-body-sm border border-[#E5E5E5] rounded-lg text-[#888] hover:text-[#111] hover:border-[#CCCCCC] flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-lg bg-[#F2F2F2]" />)}
          </div>
          <Skeleton className="h-48 rounded-lg bg-[#F2F2F2]" />
        </div>
      ) : report ? (
        <>
          {/* Sales GST Section */}
          <div className="space-y-4">
            <h2 className="text-subtitle font-semibold text-[#111]">Output Tax (Sales)</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard label="Total Orders" value={String(s!.total_orders)} />
              <StatCard label="Total Sales" value={fmtCurrency(s!.total_sales)} />
              <StatCard label="Taxable Value" value={fmtCurrency(s!.taxable_value)} />
              <StatCard label="CGST" value={fmtCurrency(s!.total_cgst)} />
              <StatCard label="SGST" value={fmtCurrency(s!.total_sgst)} />
              <StatCard label="IGST" value={fmtCurrency(s!.total_igst)} />
            </div>

            {report?.slabs?.length > 0 && (
              <div className="bg-white rounded-lg border border-[#EBEBEB] overflow-x-auto">
                <div className="px-5 py-3 border-b border-[#F2F2F2]">
                  <p className="text-body font-semibold text-[#111]">Slab Breakdown</p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#F2F2F2]">
                      {['GST Rate', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total'].map(h => (
                        <th key={h} className="text-left py-2.5 px-4 text-caption font-medium text-[#BBBBBB]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.slabs.map(slab => (
                      <tr key={slab.gst_rate} className="border-b border-[#F7F7F7] last:border-0 hover:bg-[#FAFAFA]">
                        <td className="py-2.5 px-4 text-body font-medium text-[#111]">{slab.gst_rate}%</td>
                        <td className="py-2.5 px-4 text-body text-[#555]">{fmtCurrency(slab.taxable_value)}</td>
                        <td className="py-2.5 px-4 text-body text-[#555]">{fmtCurrency(slab.cgst)}</td>
                        <td className="py-2.5 px-4 text-body text-[#555]">{fmtCurrency(slab.sgst)}</td>
                        <td className="py-2.5 px-4 text-body text-[#555]">{fmtCurrency(slab.igst)}</td>
                        <td className="py-2.5 px-4 text-body font-medium text-[#111]">{fmtCurrency(slab.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Purchase GST Section */}
          {report?.purchase && (
            <div className="space-y-4">
              <h2 className="text-subtitle font-semibold text-[#111]">Input Tax (Purchases)</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Total Batches" value={String(report.purchase.summary.total_batches)} />
                <StatCard label="Buying Value" value={fmtCurrency(report.purchase.summary.total_buying_value)} />
                <StatCard label="Input GST" value={fmtCurrency(report.purchase.summary.total_input_gst)} />
                <StatCard label="Landing Value" value={fmtCurrency(report.purchase.summary.total_landing_value)} />
              </div>

              {report?.purchase?.slabs?.length > 0 && (
                <div className="bg-white rounded-lg border border-[#EBEBEB] overflow-x-auto">
                  <div className="px-5 py-3 border-b border-[#F2F2F2]">
                    <p className="text-body font-semibold text-[#111]">Slab Breakdown</p>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#F2F2F2]">
                        {['GST Rate', 'Buying Value', 'Input GST', 'Landing Value'].map(h => (
                          <th key={h} className="text-left py-2.5 px-4 text-caption font-medium text-[#BBBBBB]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.purchase.slabs.map(slab => (
                        <tr key={slab.gst_rate} className="border-b border-[#F7F7F7] last:border-0 hover:bg-[#FAFAFA]">
                          <td className="py-2.5 px-4 text-body font-medium text-[#111]">{slab.gst_rate}%</td>
                          <td className="py-2.5 px-4 text-body text-[#555]">{fmtCurrency(slab.buying_value)}</td>
                          <td className="py-2.5 px-4 text-body text-[#555]">{fmtCurrency(slab.input_gst)}</td>
                          <td className="py-2.5 px-4 text-body font-medium text-[#111]">{fmtCurrency(slab.landing_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-lg border border-[#EBEBEB] py-20 text-center">
          <p className="text-body text-[#AAAAAA]">Select a date range and click Generate.</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-[#EBEBEB] p-4">
      <p className="text-caption font-medium text-[#BBBBBB] mb-2">{label}</p>
      <p className="text-heading-sm font-bold tracking-tight text-[#111]">{value}</p>
    </div>
  )
}
