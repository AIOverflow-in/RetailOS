import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface AuthState {
  token: string | null
  shopName: string | null
  schemaName: string | null
}

const initialState: AuthState = {
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  shopName: typeof window !== 'undefined' ? localStorage.getItem('shop_name') : null,
  schemaName: typeof window !== 'undefined' ? localStorage.getItem('schema_name') : null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth(state, action: PayloadAction<{ token: string; shop_name: string; schema_name: string }>) {
      state.token = action.payload.token
      state.shopName = action.payload.shop_name
      state.schemaName = action.payload.schema_name
      localStorage.setItem('token', action.payload.token)
      localStorage.setItem('shop_name', action.payload.shop_name)
      localStorage.setItem('schema_name', action.payload.schema_name)
    },
    clearAuth(state) {
      state.token = null
      state.shopName = null
      state.schemaName = null
      localStorage.removeItem('token')
      localStorage.removeItem('shop_name')
      localStorage.removeItem('schema_name')
      localStorage.removeItem('shop_settings')
    },
  },
})

export const { setAuth, clearAuth } = authSlice.actions
export default authSlice.reducer
