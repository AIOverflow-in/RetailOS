'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { DashboardData } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'

function fmtCurrency(n: number) {
  return '\u20B9' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getDashboard().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48 bg-[#F2F2F2]" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-lg bg-[#F2F2F2]" />)}
      </div>
    </div>
  )

  const sales = data ? Number(data.total_sales) : 0
  const orders = data?.order_count ?? 0
  const lowStock = data?.low_stock ?? 0
  const expiring = data?.expiring_soon ?? 0
  const paymentSplit = data?.payment_split ?? []

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-heading-xl font-bold tracking-tight text-[#111]">Dashboard</h1>
        <p className="text-body text-[#999] mt-0.5">Today's overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        <div className="bg-white rounded-lg border border-[#EBEBEB] p-5">
          <p className="text-caption font-medium text-[#BBBBBB] uppercase tracking-wide">Today's Sales</p>
          <p className="text-heading font-bold text-[#111] mt-2">{fmtCurrency(sales)}</p>
        </div>

        <div className="bg-white rounded-lg border border-[#EBEBEB] p-5">
          <p className="text-caption font-medium text-[#BBBBBB] uppercase tracking-wide">Orders Today</p>
          <p className="text-heading font-bold text-[#111] mt-2">{orders}</p>
        </div>

        <Link href="/inventory" className="bg-white rounded-lg border border-[#EBEBEB] p-5 hover:border-amber-300 transition-colors">
          <p className="text-caption font-medium text-[#BBBBBB] uppercase tracking-wide">Low Stock</p>
          <p className={`text-heading font-bold mt-2 ${lowStock > 0 ? 'text-amber-500' : 'text-[#111]'}`}>{lowStock}</p>
          <p className="text-caption text-[#CCCCCC] mt-1">batches below 10 units</p>
        </Link>

        <Link href="/inventory" className="bg-white rounded-lg border border-[#EBEBEB] p-5 hover:border-amber-300 transition-colors">
          <p className="text-caption font-medium text-[#BBBBBB] uppercase tracking-wide">Expiring Soon</p>
          <p className={`text-heading font-bold mt-2 ${expiring > 0 ? 'text-amber-500' : 'text-[#111]'}`}>{expiring}</p>
          <p className="text-caption text-[#CCCCCC] mt-1">within 60 days</p>
        </Link>

      </div>

      {/* Payment Mode Breakdown */}
      {paymentSplit.length > 0 && (
        <div className="bg-white rounded-lg border border-[#EBEBEB] p-5">
          <p className="text-caption font-medium text-[#BBBBBB] uppercase tracking-wide mb-4">Payment Breakdown (Today)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {paymentSplit.map(p => (
              <div key={p.payment_mode} className="space-y-1">
                <p className="text-body font-medium text-[#111] capitalize">{p.payment_mode}</p>
                <p className="text-heading-xs font-bold text-[#111]">{fmtCurrency(Number(p.total))}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
