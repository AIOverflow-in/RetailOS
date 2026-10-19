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
    restoreCart(_state, action: PayloadAction<CartState>) {
      return action.payload
    },
    // Every new bill starts in-state with cash; most bills are in-state, so an
    // out-of-state choice must not carry over to the next customer.
    clearCart() {
      return initialState
    },
  },
})

export const {
  setIsInState, setPaymentMode, setCustomer, restoreCart, clearCart,
} = cartSlice.actions

export default cartSlice.reducer
