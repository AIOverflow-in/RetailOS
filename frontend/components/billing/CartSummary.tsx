'use client'

import { useSelector } from 'react-redux'
import { selectCartTotals } from '@/store/cartSlice'
import type { RootState } from '@/store'
import { fmtCurrency } from '@/lib/gst'

export default function CartSummary() {
  const totals = useSelector(selectCartTotals)
  const isInState = useSelector((s: RootState) => s.cart.isInState)
  const itemCount = useSelector((s: RootState) => s.cart.items.length)

  if (itemCount === 0) return null

  return (
    <div className="bg-white rounded-lg border border-[#EBEBEB] p-4 space-y-1.5 min-w-52">
      {isInState ? (
        <>
          <Row label="CGST" value={fmtCurrency(totals.cgst)} />
          <Row label="SGST" value={fmtCurrency(totals.sgst)} />
        </>
      ) : (
        <Row label="IGST" value={fmtCurrency(totals.igst)} />
      )}
      <div className="border-t border-[#F0F0F0] pt-1.5">
        <Row label="Total" value={fmtCurrency(totals.total)} bold />
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-8 ${bold ? 'font-semibold text-subtitle text-foreground' : 'text-body-sm text-[#888]'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
