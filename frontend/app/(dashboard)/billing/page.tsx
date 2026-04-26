'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { getCachedSettings, setCachedSettings } from '@/lib/settingsCache'
import { generateBill, sendBillViaWhatsApp } from '@/lib/generateBill'
import type { BillData } from '@/lib/generateBill'
import { clearCart, setIsInState, setPaymentMode } from '@/store/cartSlice'
import type { RootState } from '@/store'
import CustomerLookup from '@/components/billing/CustomerLookup'
import CartSummary from '@/components/billing/CartSummary'
import BillingTable, {
  emptyRow,
  isCompleteRow,
  type BillingRow,
} from '@/components/billing/BillingTable'
import { calcGST, calcLineTotal } from '@/lib/gst'

export default function BillingPage() {
  const dispatch = useDispatch()
  const isInState = useSelector((s: RootState) => s.cart.isInState)
  const customer = useSelector((s: RootState) => s.cart.customer)
  const paymentMode = useSelector((s: RootState) => s.cart.paymentMode)

  const [rows, setRows] = useState<BillingRow[]>(() => [emptyRow()])
  const [loading, setLoading] = useState(false)
  const [lastBill, setLastBill] = useState<BillData | null>(null)

  async function placeOrder() {
    const completeRows = rows.filter(isCompleteRow)
    if (completeRows.length === 0) {
      toast.error('Add at least one item')
      return
    }
    if (!customer.name.trim()) {
      toast.error('Customer name is required')
      return
    }
    if (customer.phone.length !== 10) {
      toast.error('Customer phone is required (10 digits)')
      return
    }
    setLoading(true)
    const cartIsInState = isInState
    const cartCustomer = customer
    const cartPaymentMode = paymentMode
    try {
      const order = await api.createOrder({
        is_in_state: cartIsInState,
        payment_mode: cartPaymentMode,
        phone: cartCustomer.phone || null,
        name: cartCustomer.name || null,
        age: cartCustomer.age ? parseInt(cartCustomer.age) : null,
        items: completeRows.map(r => ({
          batch_id: r.batchId as string,
          product_name: r.productName as string,
          batch_no: r.batchNo as string,
          qty: r.qty,
          sale_price: r.salePrice,
          gst_rate: r.gstRate,
        })),
      })
      toast.success(`Bill created: ${order.order_number}`)
      setRows([emptyRow()])
      dispatch(clearCart())

      let settings = getCachedSettings()
      if (!settings) {
        settings = await api.getSettings()
        setCachedSettings(settings)
      }
      const shopName = localStorage.getItem('shop_name') ?? ''
      const billItems = completeRows.map(r => {
        const tax = calcGST(r.salePrice, r.qty, r.gstRate, cartIsInState)
        return {
          productName: r.productName as string,
          batchNo: r.batchNo as string,
          expiryDate: r.expiryDate as string,
          mrp: r.mrp ?? 0,
          qty: r.qty,
          salePrice: r.salePrice,
          gstRate: r.gstRate,
          cgstAmount: tax.cgst,
          sgstAmount: tax.sgst,
          igstAmount: tax.igst,
          lineTotal: calcLineTotal(r.salePrice, r.qty, r.gstRate),
        }
      })
      const billData: BillData = {
        orderNumber: order.order_number,
        orderDate: order.created_at,
        customerName: cartCustomer.name || null,
        customerPhone: cartCustomer.phone || null,
        customerAge: cartCustomer.age ? parseInt(cartCustomer.age) : null,
        paymentMode: cartPaymentMode,
        isInState: cartIsInState,
        items: billItems,
        cgstTotal: order.cgst_total,
        sgstTotal: order.sgst_total,
        igstTotal: order.igst_total,
        totalAmount: order.total_amount,
        settings,
        shopName,
      }
      await generateBill(billData)
      if (billData.customerPhone) setLastBill(billData)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create order')
    } finally {
      setLoading(false)
    }
  }

  const completeRows = rows.filter(isCompleteRow)
  const grandTotal = completeRows.reduce(
    (sum, r) => sum + calcLineTotal(r.salePrice, r.qty, r.gstRate),
    0,
  )

  const missing: string[] = []
  if (completeRows.length === 0) missing.push('Add at least one item')
  if (!customer.name.trim()) missing.push('Customer name')
  if (customer.phone.length !== 10) missing.push('Customer phone (10 digits)')
  const placeOrderDisabled = loading || missing.length > 0
  const placeOrderTooltip = missing.length > 0 ? `Required: ${missing.join(', ')}` : ''

  return (
    <div className="space-y-5">

      {lastBill?.customerPhone && (
        <div className="flex items-center justify-between bg-[#F6FFF6] border border-emerald-200 rounded-lg px-4 py-2.5">
          <p className="text-body-sm text-emerald-700">
            Bill ready — send to {lastBill.customerPhone} on WhatsApp?
          </p>
          <div className="flex gap-3">
            <button
              onClick={async () => { await sendBillViaWhatsApp(lastBill); setLastBill(null) }}
              className="flex items-center gap-1.5 text-body-sm font-medium text-emerald-700 hover:text-emerald-900 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" /> Send Bill
            </button>
            <button
              onClick={() => setLastBill(null)}
              className="text-body-sm text-[#AAAAAA] hover:text-[#111] transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-heading-xl font-bold tracking-tight text-[#111]">New Bill</h1>
          <p className="text-body text-[#999] mt-0.5">Create a new billing entry</p>
        </div>
        <div className="mt-2 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-caption text-label">GST</span>
            <div className="flex rounded-lg overflow-hidden border border-[#E5E5E5] text-body-sm bg-white">
              <button
                className={`px-3 py-1.5 font-medium transition-colors ${isInState ? 'bg-[#111] text-white' : 'text-[#888] hover:bg-[#F5F5F5]'}`}
                onClick={() => dispatch(setIsInState(true))}
              >In-state</button>
              <button
                className={`px-3 py-1.5 font-medium transition-colors ${!isInState ? 'bg-[#111] text-white' : 'text-[#888] hover:bg-[#F5F5F5]'}`}
                onClick={() => dispatch(setIsInState(false))}
              >Out-of-state</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-caption text-label">Payment</span>
            <div className="flex rounded-lg overflow-hidden border border-[#E5E5E5] text-body-sm bg-white">
              {(['cash', 'upi', 'card', 'mixed'] as const).map(mode => (
                <button
                  key={mode}
                  className={`px-3 py-1.5 font-medium transition-colors capitalize ${paymentMode === mode ? 'bg-[#111] text-white' : 'text-[#888] hover:bg-[#F5F5F5]'}`}
                  onClick={() => dispatch(setPaymentMode(mode))}
                >{mode}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#EBEBEB] p-4">
        <p className="text-caption font-medium text-label mb-3">Customer</p>
        <CustomerLookup />
      </div>

      <BillingTable rows={rows} setRows={setRows} />

      <div className="flex items-end justify-between gap-4 flex-wrap">
        <CartSummary rows={rows} isInState={isInState} />
        <div className="flex items-center gap-2">
          {completeRows.length > 0 && (
            <button
              onClick={() => { setRows([emptyRow()]); dispatch(clearCart()) }}
              className="h-9 px-4 text-body border border-[#E5E5E5] rounded-lg text-[#888] hover:border-[#CCCCCC] hover:text-[#111] transition-colors"
            >
              Clear
            </button>
          )}
          <span
            title={placeOrderTooltip}
            className={placeOrderDisabled ? 'cursor-not-allowed' : undefined}
          >
            <button
              onClick={placeOrder}
              disabled={placeOrderDisabled}
              className="h-9 px-5 text-body font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] disabled:opacity-40 disabled:pointer-events-none transition-colors min-w-[160px]"
            >
              {loading ? 'Processing…' : `Place Order — ₹${grandTotal.toFixed(2)}`}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
