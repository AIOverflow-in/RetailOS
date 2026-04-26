import type { GSTRate } from '@/types'

interface TaxableLine {
  salePrice: number
  qty: number
  gstRate: GSTRate
}

export const GST_RATES: GSTRate[] = [0, 5, 12, 18, 28]

// salePrice is GST-inclusive (matches the price shown to the customer at checkout
// and the value entered in inventory). Tax is extracted from the inclusive total.
export function calcLineTotal(
  salePrice: number,
  qty: number,
  _gstRate: GSTRate
): number {
  return parseFloat((salePrice * qty).toFixed(2))
}

export function calcGST(
  salePrice: number,
  qty: number,
  gstRate: GSTRate,
  isInState: boolean
) {
  const lineTotal = salePrice * qty
  const taxable = gstRate > 0 ? lineTotal / (1 + gstRate / 100) : lineTotal
  const totalTax = parseFloat((lineTotal - taxable).toFixed(2))

  if (isInState) {
    const half = parseFloat((totalTax / 2).toFixed(2))
    return { cgst: half, sgst: half, igst: 0 }
  }
  return { cgst: 0, sgst: 0, igst: totalTax }
}

export function calcCartTotals(items: TaxableLine[], isInState: boolean) {
  let cgst = 0
  let sgst = 0
  let igst = 0
  let total = 0

  for (const item of items) {
    const tax = calcGST(item.salePrice, item.qty, item.gstRate, isInState)
    const lineTotal = calcLineTotal(item.salePrice, item.qty, item.gstRate)
    cgst += tax.cgst
    sgst += tax.sgst
    igst += tax.igst
    total += lineTotal
  }

  return {
    cgst: parseFloat(cgst.toFixed(2)),
    sgst: parseFloat(sgst.toFixed(2)),
    igst: parseFloat(igst.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  }
}

export function fmtCurrency(n: number): string {
  return '₹' + n.toFixed(2)
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}
