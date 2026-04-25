// ─── Auth ───────────────────────────────────────────────────────────────────

export interface LoginResponse {
  token: string
  shop_name: string
  schema_name: string
}

// ─── Distributors ────────────────────────────────────────────────────────────

export interface Distributor {
  distributor_id: string
  name: string
  phone: string | null
  address: string | null
  email: string | null
  is_active: boolean
  created_at: string
}

export interface DistributorBatchRow {
  product_id: string
  product_name: string
  company_name: string
  batch_id: string
  batch_no: string
  expiry_date: string
  mrp: number
  buying_price: number
  selling_price: number
  purchase_qty: number
  sold_qty: number
  box_no: string | null
  purchase_gst_rate: number | null
  landing_price: number | null
  purchase_invoice_no: string | null
  available_stock: number
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
  purchase_gst_rate: number | null
  landing_price: number | null
  distributor_id: string | null
  distributor_name: string | null
  purchase_invoice_no: string | null
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
  purchase_gst_rate: number | null
  landing_price: number | null
  distributor_id: string | null
  distributor_name: string | null
  purchase_invoice_no: string | null
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
  returned_qty: number
  sale_price: number
  gst_rate: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  line_total: number
  mrp: number
  expiry_date: string
}

export type PaymentMode = 'cash' | 'upi' | 'card' | 'mixed'

export interface Order {
  order_id: string
  order_number: string
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_age: number | null
  cgst_total: number
  sgst_total: number
  igst_total: number
  total_amount: number
  payment_mode: PaymentMode
  status: string
  created_at: string
  updated_at: string | null
  return_comment: string | null
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

// ─── Dashboard ──────────────────────────────────────────────────────────

export interface DashboardData {
  total_sales: number
  order_count: number
  low_stock: number
  expiring_soon: number
  payment_split: { payment_mode: string; total: number }[]
  distributor_stats: {
    distributor_id: string
    distributor_name: string
    batch_count: number
    total_purchase_qty: number
    total_stock_value: number
  }[]
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

export interface PurchaseGSTSummary {
  total_batches: number
  total_buying_value: number
  total_input_gst: number
  total_landing_value: number
}

export interface PurchaseGSTSlab {
  gst_rate: number
  buying_value: number
  input_gst: number
  landing_value: number
}

export interface GSTReport {
  summary: GSTSummary
  slabs: GSTSlab[]
  purchase?: {
    summary: PurchaseGSTSummary
    slabs: PurchaseGSTSlab[]
  }
}

// ─── Shop Settings ───────────────────────────────────────────────────────────

export interface ShopSettings {
  store_address?: string
  gstin?: string
  drug_license?: string
  food_license?: string
  other_licenses?: string
  store_policies?: string
  google_review_link?: string
}
