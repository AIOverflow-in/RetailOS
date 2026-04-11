import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit'
import type { CartItem, CartState, GSTRate, PaymentMode } from '@/types'
import { calcCartTotals } from '@/lib/gst'
import type { RootState } from './index'

const initialState: CartState = {
  items: [],
  isInState: true,
  paymentMode: 'cash',
  customer: { phone: '', name: '', age: '' },
}

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem(state, action: PayloadAction<CartItem>) {
      const existing = state.items.find(i => i.batchId === action.payload.batchId)
      if (existing) {
        existing.qty = Math.min(existing.qty + action.payload.qty, existing.availableStock)
      } else {
        state.items.push(action.payload)
      }
    },
    updateQty(state, action: PayloadAction<{ batchId: string; qty: number }>) {
      const item = state.items.find(i => i.batchId === action.payload.batchId)
      if (item) item.qty = Math.min(action.payload.qty, item.availableStock)
    },
    updateSalePrice(state, action: PayloadAction<{ batchId: string; salePrice: number }>) {
      const item = state.items.find(i => i.batchId === action.payload.batchId)
      if (item) item.salePrice = action.payload.salePrice
    },
    updateGstRate(state, action: PayloadAction<{ batchId: string; gstRate: GSTRate }>) {
      const item = state.items.find(i => i.batchId === action.payload.batchId)
      if (item) item.gstRate = action.payload.gstRate
    },
    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter(i => i.batchId !== action.payload)
    },
    setIsInState(state, action: PayloadAction<boolean>) {
      state.isInState = action.payload
    },
    setPaymentMode(state, action: PayloadAction<PaymentMode>) {
      state.paymentMode = action.payload
    },
    setCustomer(state, action: PayloadAction<{ phone: string; name: string; age: string }>) {
      state.customer = action.payload
    },
    clearCart(state) {
      state.items = []
      state.paymentMode = 'cash'
      state.customer = { phone: '', name: '', age: '' }
    },
  },
})

export const {
  addItem, updateQty, updateSalePrice, updateGstRate,
  removeItem, setIsInState, setPaymentMode, setCustomer, clearCart,
} = cartSlice.actions

export const selectCartTotals = createSelector(
  (state: RootState) => state.cart.items,
  (state: RootState) => state.cart.isInState,
  (items, isInState) => calcCartTotals(items, isInState)
)

export default cartSlice.reducer
