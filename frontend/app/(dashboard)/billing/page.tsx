'use client'

import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { generateBill } from '@/lib/generateBill'
import { clearCart, setIsInState, setPaymentMode, selectCartTotals } from '@/store/cartSlice'
import type { RootState } from '@/store'
import CustomerLookup from '@/components/billing/CustomerLookup'
import LineItem from '@/components/billing/LineItem'
import AddItemBar from '@/components/billing/AddItemBar'
import CartSummary from '@/components/billing/CartSummary'

export default function BillingPage() {
  const dispatch = useDispatch()
  const items    = useSelector((s: RootState) => s.cart.items)
  const isInState = useSelector((s: RootState) => s.cart.isInState)
  const customer    = useSelector((s: RootState) => s.cart.customer)
  const paymentMode = useSelector((s: RootState) => s.cart.paymentMode)
  const totals    = useSelector(selectCartTotals)
  const [addKey, setAddKey] = useState(0)
  const [loading, setLoading] = useState(false)

  async function completeOrder() {
    if (items.length === 0) { toast.error('Add at least one item'); return }
    setLoading(true)
    // Capture cart state before clearing
    const cartItems = items
    const cartIsInState = isInState
    const cartCustomer = customer
    const cartPaymentMode = paymentMode
    try {
      const order = await api.createOrder({
        is_in_state: cartIsInState,
        payment_mode: cartPaymentMode,
        phone: cartCustomer.phone || null,
        name:  cartCustomer.name  || null,
        age:   cartCustomer.age ? parseInt(cartCustomer.age) : null,
        items: cartItems.map(i => ({
          batch_id:     i.batchId,
          product_name: i.productName,
          batch_no:     i.batchNo,
          qty:          i.qty,
          sale_price:   i.salePrice,
          gst_rate:     i.gstRate,
        })),
      })
      toast.success(`Bill created: ${order.order_number}`)
      dispatch(clearCart())
      setAddKey(k => k + 1)

      // Build bill data from cart + returned order, then open PDF
      const settings = await api.getSettings()
      const shopName = localStorage.getItem('shop_name') ?? ''
      const billItems = cartItems.map(i => {
        const taxable = i.salePrice * i.qty
        const totalTax = parseFloat((taxable * (i.gstRate / 100)).toFixed(2))
        const cgst = cartIsInState ? parseFloat((totalTax / 2).toFixed(2)) : 0
        const sgst = cartIsInState ? parseFloat((totalTax / 2).toFixed(2)) : 0
        const igst = cartIsInState ? 0 : totalTax
        return {
          productName: i.productName,
          batchNo: i.batchNo,
          expiryDate: i.expiryDate,
          mrp: i.mrp,
          qty: i.qty,
          salePrice: i.salePrice,
          gstRate: i.gstRate,
          cgstAmount: cgst,
          sgstAmount: sgst,
          igstAmount: igst,
          lineTotal: parseFloat((taxable + totalTax).toFixed(2)),
        }
      })
      await generateBill({
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
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create order')
    } finally {
      setLoading(false)
    }
  }

  const HEADERS = ['Product', 'Batch', 'Expiry', 'MRP', 'Sale Price', 'Qty', 'GST', 'Stock', 'Total', '']

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-heading-xl font-bold tracking-tight text-[#111]">New Bill</h1>
          <p className="text-body text-[#999] mt-0.5">Create a new billing entry</p>
        </div>
        <div className="mt-2 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-caption text-[#BBBBBB]">GST</span>
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
            <span className="text-caption text-[#BBBBBB]">Payment</span>
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

      {/* Customer */}
      <div className="bg-white rounded-lg border border-[#EBEBEB] p-4">
        <p className="text-caption font-medium text-[#BBBBBB] mb-3">Customer</p>
        <CustomerLookup />
      </div>

      {/* Add item bar — OUTSIDE the table, no overflow clipping */}
      <AddItemBar key={addKey} isInState={isInState} onAdd={() => setAddKey(k => k + 1)} />

      {/* Cart items table — only shown when items exist */}
      {items.length > 0 && (
        <div className="bg-white rounded-lg border border-[#EBEBEB] overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F2F2F2]">
                {HEADERS.map(h => (
                  <th key={h} className="text-left py-2.5 px-4 text-caption font-medium text-[#BBBBBB] whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <LineItem
                  key={item.batchId}
                  batchId={item.batchId}
                  productName={item.productName}
                  batchNo={item.batchNo}
                  expiryDate={item.expiryDate}
                  mrp={item.mrp}
                  availableStock={item.availableStock}
                  qty={item.qty}
                  salePrice={item.salePrice}
                  gstRate={item.gstRate}
                  isInState={isInState}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <CartSummary />
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              onClick={() => { dispatch(clearCart()); setAddKey(k => k + 1) }}
              className="h-9 px-4 text-body border border-[#E5E5E5] rounded-lg text-[#888] hover:border-[#CCCCCC] hover:text-[#111] transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={completeOrder}
            disabled={loading || items.length === 0}
            className="h-9 px-5 text-body font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] disabled:opacity-40 transition-colors min-w-[160px]"
          >
            {loading ? 'Processing…' : `Complete — ₹${totals.total.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
