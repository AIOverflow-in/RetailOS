import type { ShopSettings } from '@/types'
import { toast } from 'sonner'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

const SERVICE_DOWN_MSG = 'Service temporarily unavailable. Please try again in 5 minutes.'

function notifyServiceUnavailable() {
  toast.error(SERVICE_DOWN_MSG, { id: 'service-unavailable', duration: 6000 })
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  } catch {
    notifyServiceUnavailable()
    throw new Error(SERVICE_DOWN_MSG)
  }

  if (res.status === 401 && path !== '/auth/login') {
    localStorage.removeItem('token')
    localStorage.removeItem('shop_name')
    localStorage.removeItem('schema_name')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (res.status === 503 || res.status === 502 || res.status === 504) {
    notifyServiceUnavailable()
    throw new Error(SERVICE_DOWN_MSG)
  }

  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    throw new Error(data?.error || `Request failed: ${res.status}`)
  }

  return data as T
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ token: string; shop_name: string; schema_name: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }) }
    ),

  // Products
  searchProducts: (q: string) =>
    request<{ products: any[]; total: number; page: number; limit: number }>(
      `/products?q=${encodeURIComponent(q)}`
    ).then(r => r.products ?? []),
  searchProductsPaginated: (q: string, page = 1, limit = 30) =>
    request<{ products: any[]; total: number; page: number; limit: number }>(
      `/products?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`
    ),
  searchAllProducts: () =>
    request<{ products: any[]; total: number; page: number; limit: number }>(
      '/products?q=&limit=200'
    ).then(r => ({ products: r.products ?? [], total: r.total ?? 0 })),
  createProduct: (data: { name: string; company_name: string; sku?: string; hsn_code?: string }) =>
    request('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: string, data: { name: string; company_name: string; sku?: string | null; hsn_code?: string | null }) =>
    request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Batches
  listBatches: (product_id: string) => request<any[]>(`/batches?product_id=${product_id}`),
  listActiveBatches: (product_id: string) =>
    request<any[]>(`/batches/active?product_id=${product_id}`),
  createBatch: (data: object) =>
    request('/batches', { method: 'POST', body: JSON.stringify(data) }),
  updateBatch: (id: string, data: {
    buying_price: number; selling_price: number; mrp: number;
    expiry_date: string; purchase_qty: number; box_no?: string | null
  }) =>
    request(`/batches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Inventory
  listInventory: () => request<any[]>('/inventory'),

  // Stock Adjustments
  createStockAdjustment: (data: { batch_id: string; qty_change: number; reason: string; notes?: string | null }) =>
    request('/stock-adjustments', { method: 'POST', body: JSON.stringify(data) }),
  listStockAdjustments: (page = 1, limit = 20) =>
    request<{ adjustments: any[]; total: number; page: number; limit: number }>(
      `/stock-adjustments?page=${page}&limit=${limit}`
    ),

  // Customers
  lookupCustomer: (phone: string) => request<any>(`/customers?phone=${phone}`),
  listCustomers: (q = '', page = 1, limit = 20) =>
    request<{ customers: any[]; total: number; page: number; limit: number }>(
      `/customers?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`
    ),
  updateCustomer: (id: string, data: { name: string; phone: string; age?: number | null }) =>
    request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Dashboard
  getDashboard: () => request<any>('/dashboard'),

  // Orders
  createOrder: (data: object) =>
    request<any>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  listOrders: (q = '', page = 1, limit = 20) =>
    request<{ orders: any[]; total: number; page: number; limit: number }>(
      `/orders?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}`
    ),
  getOrder: (id: string) => request<any>(`/orders/${id}`),
  deleteOrder: (id: string) =>
    request(`/orders/${id}`, { method: 'DELETE' }),
  returnOrder: (id: string) =>
    request(`/orders/${id}/return`, { method: 'POST' }),

  // Reports
  gstReport: (from: string, to: string) =>
    request<any>(`/reports/gst?from=${from}&to=${to}`),
  gstReportExportURL: (from: string, to: string) =>
    `${BASE_URL}/reports/gst/export?from=${from}&to=${to}`,

  // Settings
  getSettings: () => request<ShopSettings>('/settings'),
  updateSettings: (data: ShopSettings) =>
    request<ShopSettings>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
}
