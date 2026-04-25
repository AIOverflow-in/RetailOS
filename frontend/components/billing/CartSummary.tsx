'use client'

import { calcCartTotals, fmtCurrency } from '@/lib/gst'
import type { BillingRow } from './BillingTable'
import { isCompleteRow } from './BillingTable'

interface Props {
  rows: BillingRow[]
  isInState: boolean
}

export default function CartSummary({ rows, isInState }: Props) {
  const completeRows = rows.filter(isCompleteRow)
  if (completeRows.length === 0) return null
  const totals = calcCartTotals(completeRows, isInState)

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
