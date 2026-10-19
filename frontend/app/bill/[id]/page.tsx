'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { orderItemsToBillItems } from '@/lib/billItems'
import type { ShopSettings, OrderDetail } from '@/types'
import {
  type BillItem,
  type GSTSlab,
  fmt,
  fmtExpiry,
  fmtBillDate,
  buildGSTSlabs,
} from '@/components/bill/BillDocument'

export default function BillPage() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<OrderDetail | null>(null)
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.getOrder(id), api.getSettings()]).then(async ([d, s]) => {
      setDetail(d)
      setSettings(s)
      if (s.google_review_link) {
        const QRCode = await import('qrcode')
        const url = await QRCode.default.toDataURL(s.google_review_link, { width: 120, margin: 1 })
        setQrDataUrl(url)
      }
      setReady(true)
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to load bill'
      setError(msg)
    })
  }, [id])

  useEffect(() => {
    if (ready) window.print()
  }, [ready])

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontSize: 13, color: '#c0392b' }}>
        {error}
      </div>
    )
  }

  if (!ready || !detail || !settings) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontSize: 13, color: '#555' }}>
        Preparing bill…
      </div>
    )
  }

  const { order, items } = detail
  const isInState = order.cgst_total > 0 || order.sgst_total > 0
  const shopName = typeof window !== 'undefined' ? (localStorage.getItem('shop_name') ?? '') : ''

  const billItems: BillItem[] = orderItemsToBillItems(items)

  const totalMRP = parseFloat(billItems.reduce((s, i) => s + i.mrp * i.qty, 0).toFixed(2))
  const discount = parseFloat((totalMRP - order.total_amount).toFixed(2))
  const savings = discount > 0
    ? `Congratulations! You have saved Rs ${discount.toFixed(2)} on this order.`
    : null
  const gstSlabs: GSTSlab[] = buildGSTSlabs(billItems, isInState)

  const cell: React.CSSProperties = { padding: '4px 6px', verticalAlign: 'top' }
  const th: React.CSSProperties = { padding: '4px 4px', fontWeight: 700, color: '#111', fontSize: 9, textAlign: 'left' }
  const td: React.CSSProperties = { padding: '4px 4px', color: '#111', fontSize: 9 }

  return (
    <>
      <style>{`
        @media print { .no-print { display: none !important; } @page { margin: 0; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: white; }
      `}</style>

      {/* Manual print button */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px', borderBottom: '1px solid #EBEBEB', background: 'white' }}>
        <button
          onClick={() => window.print()}
          style={{ padding: '6px 16px', fontSize: 13, fontWeight: 600, background: '#111', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          Print
        </button>
      </div>

      {/* Bill */}
      <div style={{ maxWidth: 794, margin: '0 auto', padding: '12mm 12mm', background: 'white', fontSize: 11, fontFamily: 'Helvetica, Arial, sans-serif', color: '#111' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 3, color: '#111' }}>{shopName || 'Store'}</p>
            {settings.store_address && <p style={{ fontSize: 9, color: '#333', marginBottom: 2 }}>Address : {settings.store_address}</p>}
            {settings.gstin && <p style={{ fontSize: 9, color: '#333', marginBottom: 2 }}>GST No: {settings.gstin}</p>}
            {settings.drug_license && <p style={{ fontSize: 9, color: '#333', marginBottom: 2 }}>Drug License Number : {settings.drug_license}</p>}
            {settings.food_license && <p style={{ fontSize: 9, color: '#333', marginBottom: 2 }}>Food License : {settings.food_license}</p>}
          </div>
          {qrDataUrl && (
            <div style={{ textAlign: 'center', width: 72 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Google Review QR" style={{ width: 64, height: 64 }} />
              <p style={{ fontSize: 7, marginTop: 2, color: '#333' }}>Review Us on Google</p>
            </div>
          )}
        </div>

        <hr style={{ borderColor: '#CCC', marginBottom: 8 }} />

        {/* Info grid */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CCC', marginBottom: 8 }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #CCC' }}>
              <td style={{ ...cell, borderRight: '1px solid #CCC', width: '50%' }}>
                <p style={{ fontWeight: 700, fontSize: 9, marginBottom: 2, color: '#111' }}>Bill No.</p>
                <p style={{ fontSize: 9, color: '#222' }}>{order.order_number}</p>
              </td>
              <td style={{ ...cell, width: '50%' }}>
                <p style={{ fontWeight: 700, fontSize: 9, marginBottom: 2, color: '#111' }}>Order Date</p>
                <p style={{ fontSize: 9, color: '#222' }}>{fmtBillDate(order.created_at)}</p>
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #CCC' }}>
              <td style={{ ...cell, borderRight: '1px solid #CCC' }}>
                <p style={{ fontWeight: 700, fontSize: 9, marginBottom: 2, color: '#111' }}>Customer Name</p>
                <p style={{ fontSize: 9, color: '#222' }}>{order.customer_name || '—'}</p>
              </td>
              <td style={cell}>
                <p style={{ fontWeight: 700, fontSize: 9, marginBottom: 2, color: '#111' }}>Customer Contact Number</p>
                <p style={{ fontSize: 9, color: '#222' }}>{order.customer_phone || '—'}</p>
              </td>
            </tr>
            <tr>
              <td style={{ ...cell, borderRight: '1px solid #CCC' }}>
                <p style={{ fontWeight: 700, fontSize: 9, marginBottom: 2, color: '#111' }}>Customer Age</p>
                <p style={{ fontSize: 9, color: '#222' }}>{order.customer_age != null ? String(order.customer_age) : '—'}</p>
              </td>
              <td style={cell}>
                <p style={{ fontWeight: 700, fontSize: 9, marginBottom: 2, color: '#111' }}>Payment Mode</p>
                <p style={{ fontSize: 9, color: '#222' }}>{order.payment_mode.toUpperCase()}</p>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Line items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CCC', marginBottom: 8 }}>
          <thead>
            <tr style={{ backgroundColor: '#F5F5F5', borderBottom: '1px solid #CCC' }}>
              <th style={{ ...th, width: 22 }}>S No</th>
              <th style={th}>Product Name</th>
              <th style={{ ...th, textAlign: 'right', width: 52 }}>MRP</th>
              <th style={{ ...th, textAlign: 'center', width: 28 }}>Qty</th>
              <th style={{ ...th, textAlign: 'right', width: 56 }}>Price</th>
              {isInState ? (
                <>
                  <th style={{ ...th, textAlign: 'center', width: 36 }}>CGST %</th>
                  <th style={{ ...th, textAlign: 'right', width: 46 }}>CGST Amt</th>
                  <th style={{ ...th, textAlign: 'center', width: 36 }}>SGST %</th>
                  <th style={{ ...th, textAlign: 'right', width: 46 }}>SGST Amt</th>
                </>
              ) : (
                <>
                  <th style={{ ...th, textAlign: 'center', width: 36 }}>IGST %</th>
                  <th style={{ ...th, textAlign: 'right', width: 46 }}>IGST Amt</th>
                </>
              )}
              <th style={{ ...th, textAlign: 'right', width: 56 }}>Sub Total</th>
            </tr>
          </thead>
          <tbody>
            {billItems.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: idx < billItems.length - 1 ? '1px solid #EEE' : 'none' }}>
                <td style={td}>{idx + 1}</td>
                <td style={td}>
                  <p style={{ color: '#111', marginBottom: 2 }}>{item.productName}</p>
                  <p style={{ fontSize: 8, color: '#444' }}>
                    Batch No: {item.batchNo}{item.expiryDate ? ` | Expiry Date: ${fmtExpiry(item.expiryDate)}` : ''}
                  </p>
                </td>
                <td style={{ ...td, textAlign: 'right' }}>{fmt(item.mrp)}</td>
                <td style={{ ...td, textAlign: 'center' }}>{item.qty}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmt(item.salePrice)}</td>
                {isInState ? (
                  <>
                    <td style={{ ...td, textAlign: 'center' }}>{item.gstRate / 2}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{item.cgstAmount.toFixed(2)}</td>
                    <td style={{ ...td, textAlign: 'center' }}>{item.gstRate / 2}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{item.sgstAmount.toFixed(2)}</td>
                  </>
                ) : (
                  <>
                    <td style={{ ...td, textAlign: 'center' }}>{item.gstRate}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{item.igstAmount.toFixed(2)}</td>
                  </>
                )}
                <td style={{ ...td, textAlign: 'right' }}>{fmt(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: 8, fontSize: 9 }}>
          <div style={{ display: 'flex', marginBottom: 3 }}>
            <span style={{ width: 90, textAlign: 'right', color: '#333' }}>Total MRP</span>
            <span style={{ width: 70, textAlign: 'right', color: '#222' }}>{fmt(totalMRP)}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: 'flex', marginBottom: 3 }}>
              <span style={{ width: 90, textAlign: 'right', color: '#333' }}>
                Discount ({(discount / totalMRP * 100).toFixed(1)}%)
              </span>
              <span style={{ width: 70, textAlign: 'right', color: '#222' }}>{fmt(discount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', borderTop: '1px solid #CCC', paddingTop: 4, marginTop: 2 }}>
            <span style={{ width: 90, textAlign: 'right', fontWeight: 700, fontSize: 11, color: '#111' }}>Total</span>
            <span style={{ width: 70, textAlign: 'right', fontWeight: 700, fontSize: 11, color: '#111' }}>{fmt(order.total_amount)}</span>
          </div>
        </div>

        {/* GST Summary */}
        <p style={{ fontWeight: 700, fontSize: 9, marginBottom: 4, color: '#111' }}>GST Summary</p>
        <table style={{ borderCollapse: 'collapse', border: '1px solid #CCC', marginBottom: 10, fontSize: 9, width: 320 }}>
          <thead>
            <tr style={{ backgroundColor: '#F5F5F5', borderBottom: '1px solid #CCC' }}>
              <th style={th}>Taxable Amount</th>
              {isInState ? (
                <>
                  <th style={{ ...th, textAlign: 'center', width: 44 }}>CGST %</th>
                  <th style={{ ...th, textAlign: 'right', width: 58 }}>CGST Amount</th>
                  <th style={{ ...th, textAlign: 'center', width: 44 }}>SGST %</th>
                  <th style={{ ...th, textAlign: 'right', width: 58 }}>SGST Amount</th>
                </>
              ) : (
                <>
                  <th style={{ ...th, textAlign: 'center', width: 44 }}>IGST %</th>
                  <th style={{ ...th, textAlign: 'right', width: 68 }}>IGST Amount</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {gstSlabs.map((slab, idx) => (
              <tr key={idx} style={{ borderBottom: idx < gstSlabs.length - 1 ? '1px solid #EEE' : 'none' }}>
                <td style={td}>Rs. {slab.taxable.toFixed(2)}</td>
                {isInState ? (
                  <>
                    <td style={{ ...td, textAlign: 'center' }}>{slab.rate / 2} %</td>
                    <td style={{ ...td, textAlign: 'right' }}>Rs. {slab.cgst.toFixed(2)}</td>
                    <td style={{ ...td, textAlign: 'center' }}>{slab.rate / 2} %</td>
                    <td style={{ ...td, textAlign: 'right' }}>Rs. {slab.sgst.toFixed(2)}</td>
                  </>
                ) : (
                  <>
                    <td style={{ ...td, textAlign: 'center' }}>{slab.rate} %</td>
                    <td style={{ ...td, textAlign: 'right' }}>Rs. {slab.igst.toFixed(2)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Savings */}
        {savings && <p style={{ fontSize: 9, color: '#333', marginBottom: 10 }}>{savings}</p>}

        {/* Authorized Signatory */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <p style={{ fontSize: 9, color: '#333' }}>Authorized Signatory</p>
        </div>

        {/* Store Policies */}
        {settings.store_policies && (
          <div style={{ borderTop: '1px solid #CCC', paddingTop: 6 }}>
            <p style={{ fontWeight: 700, fontSize: 9, marginBottom: 3, color: '#111' }}>Store Policies</p>
            <p style={{ fontSize: 8, color: '#333', lineHeight: 1.5 }}>{settings.store_policies}</p>
          </div>
        )}

      </div>
    </>
  )
}
