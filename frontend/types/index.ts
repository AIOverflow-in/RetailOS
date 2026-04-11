// ─── Auth ───────────────────────────────────────────────────────────────────

export interface LoginResponse {
  token: string
  shop_name: string
  schema_name: string
}

// ─── Products & Batches ──────────────────────────────────────────────────────

export interface Product {
  product_id: string
  name: string
  company_name: string
  sku: string | null
  hsn_code: string | null
  created_at: string
}

export interface Batch {
  batch_id: string
  product_id: string
  batch_no: string
  expiry_date: string
  mrp: number
  buying_price: number
  selling_price: number
  purchase_qty: number
  sold_qty: number
  available_stock: number
  box_no: string | null
  created_at: string
}

export interface InventoryRow {
  product_id: string
  name: string
  company_name: string
  sku: string | null
  hsn_code: string | null
  batch_id: string
  batch_no: string
  expiry_date: string
  mrp: number
  buying_price: number
  selling_price: number
  purchase_qty: number
  sold_qty: number
  box_no: string | null
  available_stock: number
}

// ─── Customers ───────────────────────────────────────────────────────────────

export interface Customer {
  customer_id: string
  phone: string
  name: string
  age: number | null
  visit_count: number
  created_at: string
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export type GSTRate = 0 | 5 | 12 | 18 | 28

export interface OrderItem {
  item_id: string
  order_id: string
  batch_id: string
  product_name: string
  batch_no: string
  qty: number
  sale_price: number
  gst_rate: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  line_total: number
}

export type PaymentMode = 'cash' | 'upi' | 'card' | 'mixed'

export interface Order {
  order_id: string
  order_number: string
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  cgst_total: number
  sgst_total: number
  igst_total: number
  total_amount: number
  payment_mode: PaymentMode
  status: string
  created_at: string
}

export interface OrderDetail {
  order: Order
  items: OrderItem[]
}

// ─── Cart (Redux state) ───────────────────────────────────────────────────────

export interface CartItem {
  batchId: string
  productId: string
  productName: string
  batchNo: string
  expiryDate: string
  mrp: number
  availableStock: number
  qty: number
  salePrice: number
  gstRate: GSTRate
}

export interface CartState {
  items: CartItem[]
  isInState: boolean
  paymentMode: PaymentMode
  customer: {
    phone: string
    name: string
    age: string
  }
}

// ─── Stock Adjustments ──────────────────────────────────────────────────

export interface StockAdjustment {
  adjustment_id: string
  batch_id: string
  batch_no: string
  product_name: string
  qty_change: number
  reason: string
  notes: string | null
  created_at: string
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface GSTSummary {
  total_orders: number
  taxable_value: number
  total_cgst: number
  total_sgst: number
  total_igst: number
  total_sales: number
}

export interface GSTSlab {
  gst_rate: number
  taxable_value: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

export interface GSTReport {
  summary: GSTSummary
  slabs: GSTSlab[]
}
