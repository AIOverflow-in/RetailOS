import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { CartState, PaymentMode } from '@/types'

const initialState: CartState = {
  isInState: true,
  paymentMode: 'cash',
  customer: { phone: '', name: '', age: '' },
}

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
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
      state.paymentMode = 'cash'
      state.customer = { phone: '', name: '', age: '' }
    },
  },
})

export const {
  setIsInState, setPaymentMode, setCustomer, clearCart,
} = cartSlice.actions

export default cartSlice.reducer
