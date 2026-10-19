import type { OrderItem } from '@/types'
import type { BillItem } from '@/components/bill/BillDocument'

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Bill lines for printing a saved order: the quantities the customer kept.
 * Returned units are left out and fully returned lines dropped, scaled the same
 * way the server nets the order total, so lines, tax and Total all agree.
 * Shared by the print page and the WhatsApp PDF.
 */
export function orderItemsToBillItems(items: OrderItem[]): BillItem[] {
  return items.flatMap(item => {
    const kept = item.qty - (item.returned_qty ?? 0)
    if (kept <= 0) return []
    const f = kept / item.qty
    return [{
      productName: item.product_name,
      batchNo: item.batch_no,
      expiryDate: item.expiry_date ?? '',
      mrp: item.mrp ?? 0,
      qty: kept,
      salePrice: item.sale_price,
      gstRate: item.gst_rate,
      cgstAmount: round2(item.cgst_amount * f),
      sgstAmount: round2(item.sgst_amount * f),
      igstAmount: round2(item.igst_amount * f),
      lineTotal: round2(item.line_total * f),
    }]
  })
}
