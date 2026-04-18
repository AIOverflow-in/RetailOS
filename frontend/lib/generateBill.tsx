import type { OrderDetail, ShopSettings } from '@/types'
import type { BillData, BillItem } from '@/components/bill/BillDocument'

export type { BillData, BillItem }

export function buildBillData(
  detail: OrderDetail,
  settings: ShopSettings,
  shopName: string,
): BillData {
  const { order, items } = detail
  const isInState = order.cgst_total > 0 || order.sgst_total > 0

  const billItems: BillItem[] = items.map(item => ({
    productName: item.product_name,
    batchNo: item.batch_no,
    expiryDate: item.expiry_date ?? '',
    mrp: item.mrp ?? 0,
    qty: item.qty,
    salePrice: item.sale_price,
    gstRate: item.gst_rate,
    cgstAmount: item.cgst_amount,
    sgstAmount: item.sgst_amount,
    igstAmount: item.igst_amount,
    lineTotal: item.line_total,
  }))

  return {
    orderNumber: order.order_number,
    orderDate: order.created_at,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    customerAge: order.customer_age ?? null,
    paymentMode: order.payment_mode,
    isInState,
    items: billItems,
    cgstTotal: order.cgst_total,
    sgstTotal: order.sgst_total,
    igstTotal: order.igst_total,
    totalAmount: order.total_amount,
    settings,
    shopName,
  }
}

async function buildPdfBlob(data: BillData): Promise<Blob> {
  let googleReviewQr: string | undefined
  if (data.settings.google_review_link) {
    const QRCode = await import('qrcode')
    googleReviewQr = await QRCode.default.toDataURL(
      data.settings.google_review_link,
      { width: 120, margin: 1 },
    )
  }
  const { pdf } = await import('@react-pdf/renderer')
  const { BillDocument } = await import('@/components/bill/BillDocument')
  return pdf(<BillDocument data={{ ...data, googleReviewQr }} />).toBlob()
}

export async function generateBill(data: BillData): Promise<void> {
  const blob = await buildPdfBlob(data)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function sendBillViaWhatsApp(data: BillData): Promise<void> {
  const blob = await buildPdfBlob(data)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Bill-${data.orderNumber}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)

  const digits = (data.customerPhone ?? '').replace(/\D/g, '')
  const waPhone = digits.startsWith('91') ? digits : `91${digits}`
  const text = encodeURIComponent(
    `Hi ${data.customerName ?? 'there'}, your bill for order ${data.orderNumber} from ${data.shopName} is ₹${data.totalAmount}. Please find the PDF attached.`,
  )
  window.open(`https://wa.me/${waPhone}?text=${text}`, '_blank')
}
