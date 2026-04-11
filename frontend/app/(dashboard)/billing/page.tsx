'use client'

import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { toast } from 'sonner'
import { api } from '@/lib/api'
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
    try {
      const order = await api.createOrder({
        is_in_state: isInState,
        payment_mode: paymentMode,
        phone: customer.phone || null,
        name:  customer.name  || null,
        age:   customer.age ? parseInt(customer.age) : null,
        items: items.map(i => ({
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
      window.print()
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
          <h1 className="text-[30px] font-bold tracking-tight text-[#111]">New Bill</h1>
          <p className="text-[13px] text-[#999] mt-0.5">Create a new billing entry</p>
        </div>
        <div className="mt-2 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#BBBBBB]">GST</span>
            <div className="flex rounded-lg overflow-hidden border border-[#E5E5E5] text-[12px] bg-white">
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
            <span className="text-[11px] text-[#BBBBBB]">Payment</span>
            <div className="flex rounded-lg overflow-hidden border border-[#E5E5E5] text-[12px] bg-white">
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
        <p className="text-[11px] font-medium text-[#BBBBBB] mb-3">Customer</p>
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
                  <th key={h} className="text-left py-2.5 px-4 text-[11px] font-medium text-[#BBBBBB] whitespace-nowrap">
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
              className="h-9 px-4 text-[13px] border border-[#E5E5E5] rounded-lg text-[#888] hover:border-[#CCCCCC] hover:text-[#111] transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={completeOrder}
            disabled={loading || items.length === 0}
            className="h-9 px-5 text-[13px] font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] disabled:opacity-40 transition-colors min-w-[160px]"
          >
            {loading ? 'Processing…' : `Complete — ₹${totals.total.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
