import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { ShopSettings } from '@/types'

export interface BillItem {
  productName: string
  batchNo: string
  expiryDate: string
  mrp: number
  qty: number
  salePrice: number
  gstRate: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  lineTotal: number
}

export interface BillData {
  orderNumber: string
  orderDate: string
  customerName: string | null
  customerPhone: string | null
  customerAge: number | null
  paymentMode: string
  isInState: boolean
  items: BillItem[]
  cgstTotal: number
  sgstTotal: number
  igstTotal: number
  totalAmount: number
  settings: ShopSettings
  shopName: string
  googleReviewQr?: string
}

const s = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: 'Helvetica', color: '#111' },

  // Header
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  storeName: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  headerMeta: { fontSize: 6, color: '#444', marginBottom: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#CCCCCC', marginVertical: 6 },

  // Info grid
  infoGrid: { borderWidth: 1, borderColor: '#CCCCCC', marginBottom: 6 },
  infoRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#CCCCCC' },
  infoRowLast: { flexDirection: 'row' },
  infoCell: { flex: 1, paddingVertical: 3, paddingHorizontal: 5 },
  infoCellBorder: { flex: 1, paddingVertical: 3, paddingHorizontal: 5, borderRightWidth: 1, borderRightColor: '#CCCCCC' },
  infoLabel: { fontFamily: 'Helvetica-Bold', fontSize: 7, marginBottom: 1 },
  infoValue: { fontSize: 7.5 },

  // Table
  table: { borderWidth: 1, borderColor: '#CCCCCC', marginBottom: 6 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderBottomWidth: 1, borderBottomColor: '#CCCCCC' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  tableRowLast: { flexDirection: 'row' },
  th: { paddingVertical: 3, paddingHorizontal: 3, fontFamily: 'Helvetica-Bold', fontSize: 7 },
  td: { paddingVertical: 3, paddingHorizontal: 3, fontSize: 7.5 },
  tdSub: { fontSize: 6.5, color: '#666', marginTop: 1 },

  // Column widths
  colSNo: { width: 18 },
  colMed: { flex: 1 },
  colMRP: { width: 44, textAlign: 'right' },
  colQty: { width: 22, textAlign: 'center' },
  colPrice: { width: 48, textAlign: 'right' },
  colGstPct: { width: 30, textAlign: 'center' },
  colGstAmt: { width: 38, textAlign: 'right' },
  colTotal: { width: 48, textAlign: 'right' },

  // Totals
  totalsSection: { alignItems: 'flex-end', marginBottom: 6 },
  totalRow: { flexDirection: 'row', marginBottom: 2 },
  totalLabel: { width: 80, textAlign: 'right', fontSize: 7.5, color: '#555' },
  totalValue: { width: 60, textAlign: 'right', fontSize: 7.5 },
  grandTotalLabel: { width: 80, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 9 },
  grandTotalValue: { width: 60, textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 9 },

  // GST Summary
  gstSummaryTitle: { fontFamily: 'Helvetica-Bold', fontSize: 8, marginBottom: 3 },
  gstTable: { borderWidth: 1, borderColor: '#CCCCCC', marginBottom: 8, width: 280 },

  // Footer
  savingsText: { fontSize: 7.5, color: '#333', marginBottom: 8 },
  signRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
  signText: { fontSize: 7.5, color: '#555' },
  policiesTitle: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, marginBottom: 2 },
  policiesText: { fontSize: 7, color: '#555', lineHeight: 1.4 },
})

function fmt(n: number) {
  return 'Rs. ' + n.toFixed(2)
}

function fmtExpiry(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}

function fmtBillDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

interface GSTSlab {
  rate: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
}

function buildGSTSlabs(items: BillItem[], isInState: boolean): GSTSlab[] {
  const map: Record<number, GSTSlab> = {}
  for (const item of items) {
    if (!map[item.gstRate]) {
      map[item.gstRate] = { rate: item.gstRate, taxable: 0, cgst: 0, sgst: 0, igst: 0 }
    }
    map[item.gstRate].taxable += item.salePrice * item.qty
    if (isInState) {
      map[item.gstRate].cgst += item.cgstAmount
      map[item.gstRate].sgst += item.sgstAmount
    } else {
      map[item.gstRate].igst += item.igstAmount
    }
  }
  return Object.values(map).map(s => ({
    ...s,
    taxable: parseFloat(s.taxable.toFixed(2)),
    cgst: parseFloat(s.cgst.toFixed(2)),
    sgst: parseFloat(s.sgst.toFixed(2)),
    igst: parseFloat(s.igst.toFixed(2)),
  }))
}

export function BillDocument({ data }: { data: BillData }) {
  const { orderNumber, orderDate, customerName, customerPhone, customerAge,
    paymentMode, isInState, items, totalAmount, settings, shopName, googleReviewQr } = data

  const totalMRP = parseFloat(items.reduce((s, i) => s + i.mrp * i.qty, 0).toFixed(2))
  const discount = parseFloat((totalMRP - totalAmount).toFixed(2))
  const gstSlabs = buildGSTSlabs(items, isInState)

  const savings = discount > 0
    ? `Congratulations! You have saved Rs ${discount.toFixed(2)} on this order.`
    : null

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.storeName}>{shopName || 'Store'}</Text>
            {settings.store_address && (
              <Text style={s.headerMeta}>Address : {settings.store_address}</Text>
            )}
            {settings.gstin && (
              <Text style={s.headerMeta}>GST No: {settings.gstin}</Text>
            )}
            {settings.drug_license && (
              <Text style={s.headerMeta}>Drug License Number : {settings.drug_license}</Text>
            )}
            {settings.food_license && (
              <Text style={s.headerMeta}>Food License : {settings.food_license}</Text>
            )}
          </View>
          {googleReviewQr && (
            <View style={{ alignItems: 'center', width: 68 }}>
              <Image src={googleReviewQr} style={{ width: 60, height: 60 }} />
              <Text style={{ fontSize: 6, textAlign: 'center', marginTop: 2, color: '#555' }}>
                Review Us on Google
              </Text>
            </View>
          )}
        </View>

        <View style={s.divider} />

        {/* Bill info grid */}
        <View style={s.infoGrid}>
          <View style={s.infoRow}>
            <View style={s.infoCellBorder}>
              <Text style={s.infoLabel}>Bill No.</Text>
              <Text style={s.infoValue}>{orderNumber}</Text>
            </View>
            <View style={s.infoCell}>
              <Text style={s.infoLabel}>Order Date</Text>
              <Text style={s.infoValue}>{fmtBillDate(orderDate)}</Text>
            </View>
          </View>
          <View style={s.infoRow}>
            <View style={s.infoCellBorder}>
              <Text style={s.infoLabel}>Patient Name</Text>
              <Text style={s.infoValue}>{customerName || '—'}</Text>
            </View>
            <View style={s.infoCell}>
              <Text style={s.infoLabel}>Patient Contact Number</Text>
              <Text style={s.infoValue}>{customerPhone || '—'}</Text>
            </View>
          </View>
          <View style={s.infoRowLast}>
            <View style={s.infoCellBorder}>
              <Text style={s.infoLabel}>Patient Age</Text>
              <Text style={s.infoValue}>{customerAge != null ? String(customerAge) : '—'}</Text>
            </View>
            <View style={s.infoCell}>
              <Text style={s.infoLabel}>Payment Mode</Text>
              <Text style={s.infoValue}>{paymentMode.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Line items table */}
        <View style={s.table}>
          {/* Header */}
          <View style={s.tableHeaderRow}>
            <Text style={[s.th, s.colSNo]}>S No</Text>
            <Text style={[s.th, s.colMed]}>Medicine Name</Text>
            <Text style={[s.th, s.colMRP, { textAlign: 'right' }]}>MRP</Text>
            <Text style={[s.th, s.colQty, { textAlign: 'center' }]}>Qty</Text>
            <Text style={[s.th, s.colPrice, { textAlign: 'right' }]}>Price Per Strip</Text>
            {isInState ? (
              <>
                <Text style={[s.th, s.colGstPct, { textAlign: 'center' }]}>CGST %</Text>
                <Text style={[s.th, s.colGstAmt, { textAlign: 'right' }]}>CGST Amt</Text>
                <Text style={[s.th, s.colGstPct, { textAlign: 'center' }]}>SGST %</Text>
                <Text style={[s.th, s.colGstAmt, { textAlign: 'right' }]}>SGST Amt</Text>
              </>
            ) : (
              <>
                <Text style={[s.th, s.colGstPct, { textAlign: 'center' }]}>IGST %</Text>
                <Text style={[s.th, s.colGstAmt, { textAlign: 'right' }]}>IGST Amt</Text>
              </>
            )}
            <Text style={[s.th, s.colTotal, { textAlign: 'right' }]}>Sub Total</Text>
          </View>

          {/* Rows */}
          {items.map((item, idx) => (
            <View key={idx} style={idx === items.length - 1 ? s.tableRowLast : s.tableRow}>
              <Text style={[s.td, s.colSNo]}>{idx + 1}</Text>
              <View style={[s.colMed, { paddingVertical: 3, paddingHorizontal: 3 }]}>
                <Text style={{ fontSize: 7.5 }}>{item.productName}</Text>
                <Text style={s.tdSub}>
                  Batch No: {item.batchNo}
                  {item.expiryDate ? ` | Expiry Date: ${fmtExpiry(item.expiryDate)}` : ''}
                </Text>
              </View>
              <Text style={[s.td, s.colMRP]}>{fmt(item.mrp)}</Text>
              <Text style={[s.td, s.colQty]}>{item.qty}</Text>
              <Text style={[s.td, s.colPrice]}>{fmt(item.salePrice)}</Text>
              {isInState ? (
                <>
                  <Text style={[s.td, s.colGstPct]}>{item.gstRate / 2}</Text>
                  <Text style={[s.td, s.colGstAmt]}>{item.cgstAmount.toFixed(2)}</Text>
                  <Text style={[s.td, s.colGstPct]}>{item.gstRate / 2}</Text>
                  <Text style={[s.td, s.colGstAmt]}>{item.sgstAmount.toFixed(2)}</Text>
                </>
              ) : (
                <>
                  <Text style={[s.td, s.colGstPct]}>{item.gstRate}</Text>
                  <Text style={[s.td, s.colGstAmt]}>{item.igstAmount.toFixed(2)}</Text>
                </>
              )}
              <Text style={[s.td, s.colTotal]}>{fmt(item.lineTotal)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={s.totalsSection}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total MRP</Text>
            <Text style={s.totalValue}>{fmt(totalMRP)}</Text>
          </View>
          {discount > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>
                Discount ({(discount / totalMRP * 100).toFixed(1)}%)
              </Text>
              <Text style={s.totalValue}>{fmt(discount)}</Text>
            </View>
          )}
          <View style={[s.totalRow, { borderTopWidth: 1, borderTopColor: '#CCCCCC', marginTop: 2, paddingTop: 3 }]}>
            <Text style={s.grandTotalLabel}>Total</Text>
            <Text style={s.grandTotalValue}>{fmt(totalAmount)}</Text>
          </View>
        </View>

        {/* GST Summary */}
        <Text style={s.gstSummaryTitle}>GST Summary</Text>
        <View style={s.gstTable}>
          <View style={[s.tableHeaderRow, { borderBottomWidth: 1, borderBottomColor: '#CCCCCC' }]}>
            <Text style={[s.th, { flex: 1 }]}>Taxable Amount</Text>
            {isInState ? (
              <>
                <Text style={[s.th, { width: 40, textAlign: 'center' }]}>CGST %</Text>
                <Text style={[s.th, { width: 50, textAlign: 'right' }]}>CGST Amount</Text>
                <Text style={[s.th, { width: 40, textAlign: 'center' }]}>SGST %</Text>
                <Text style={[s.th, { width: 50, textAlign: 'right' }]}>SGST Amount</Text>
              </>
            ) : (
              <>
                <Text style={[s.th, { width: 40, textAlign: 'center' }]}>IGST %</Text>
                <Text style={[s.th, { width: 60, textAlign: 'right' }]}>IGST Amount</Text>
              </>
            )}
          </View>
          {gstSlabs.map((slab, idx) => (
            <View key={idx} style={idx === gstSlabs.length - 1 ? s.tableRowLast : s.tableRow}>
              <Text style={[s.td, { flex: 1 }]}>Rs. {slab.taxable.toFixed(2)}</Text>
              {isInState ? (
                <>
                  <Text style={[s.td, { width: 40, textAlign: 'center' }]}>{slab.rate / 2} %</Text>
                  <Text style={[s.td, { width: 50, textAlign: 'right' }]}>Rs. {slab.cgst.toFixed(2)}</Text>
                  <Text style={[s.td, { width: 40, textAlign: 'center' }]}>{slab.rate / 2} %</Text>
                  <Text style={[s.td, { width: 50, textAlign: 'right' }]}>Rs. {slab.sgst.toFixed(2)}</Text>
                </>
              ) : (
                <>
                  <Text style={[s.td, { width: 40, textAlign: 'center' }]}>{slab.rate} %</Text>
                  <Text style={[s.td, { width: 60, textAlign: 'right' }]}>Rs. {slab.igst.toFixed(2)}</Text>
                </>
              )}
            </View>
          ))}
        </View>

        {/* Savings + Signatory */}
        {savings && <Text style={s.savingsText}>{savings}</Text>}
        <View style={s.signRow}>
          <Text style={s.signText}>Authorized Signatory</Text>
        </View>

        {/* Store Policies */}
        {settings.store_policies && (
          <View style={{ borderTopWidth: 1, borderTopColor: '#CCCCCC', paddingTop: 6 }}>
            <Text style={s.policiesTitle}>Store Policies</Text>
            <Text style={s.policiesText}>{settings.store_policies}</Text>
          </View>
        )}

      </Page>
    </Document>
  )
}
