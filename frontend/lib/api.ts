import type { Distributor, DistributorBatchRow, Product, ShopSettings } from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

// A request that gets no answer within this time is abandoned, so the counter is
// never stuck on a spinner. Bill creation is safe to retry (client_ref), so this
// errs on the short side.
const TIMEOUT_MS = 20_000

const OFFLINE_MSG = "You're offline. Check the shop's internet connection and try again."
const TIMEOUT_MSG = 'The server is taking too long to respond. Please try again.'
const UNREACHABLE_MSG = "Can't reach SellOS right now. Please try again in a minute."

/**
 * Thrown for every failed request. `kind` says whether the request may never
 * have reached the server (offline / timeout / unreachable) or the server
 * answered with an error (http). The page shows `message`; nothing is toasted
 * here, so each failure is reported once.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public kind: 'offline' | 'timeout' | 'unreachable' | 'http',
    public status = 0,
  ) {
    super(message)
  }
}

/** True when the request may or may not have been processed (no reply received). */
export function isConnectionError(err: unknown): boolean {
  return err instanceof ApiError && err.kind !== 'http'
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
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: options.signal ?? AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (err) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new ApiError(OFFLINE_MSG, 'offline')
    if (err instanceof DOMException && err.name === 'TimeoutError') throw new ApiError(TIMEOUT_MSG, 'timeout')
    throw new ApiError(UNREACHABLE_MSG, 'unreachable')
  }

  if (res.status === 401 && path !== '/auth/login') {
    // The bill in progress is kept in localStorage (lib/billDraft) and restored
    // after logging back in.
    localStorage.removeItem('token')
    localStorage.removeItem('shop_name')
    localStorage.removeItem('schema_name')
    window.location.href = '/login'
    throw new ApiError('Your session has expired. Please log in again.', 'http', 401)
  }

  if (res.status === 502 || res.status === 503 || res.status === 504) {
    throw new ApiError(UNREACHABLE_MSG, 'unreachable', res.status)
  }

  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // Not JSON (e.g. an HTML error page from a proxy): never show it raw.
  }

  if (!res.ok) {
    const fallback = res.status >= 500
      ? 'Something went wrong on our side. Please try again.'
      : `Request failed (${res.status}). Please try again.`
    throw new ApiError(typeof data?.error === 'string' ? data.error : fallback, 'http', res.status)
  }
  if (text && data === null) {
    throw new ApiError('Got an unexpected reply from the server. Please try again.', 'http', res.status)
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
  getProduct: (id: string) => request<Product>(`/products/${id}`),
  listCompanyNames: () => request<string[]>('/products/companies'),
  createProduct: (data: { name: string; company_name: string; sku?: string; hsn_code?: string }) =>
    // existing: true when the name + company matched a product already in the catalog
    request<Product & { existing: boolean }>('/products', { method: 'POST', body: JSON.stringify(data) }),
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
    expiry_date: string; purchase_qty: number; box_no?: string | null;
    purchase_gst_rate?: number | null;
    distributor_id?: string | null;
    purchase_invoice_no?: string | null;
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
  listOrders: (
    q = '',
    page = 1,
    limit = 20,
    filters: {
      payment?: string[]
      status?: string[]
      dateFrom?: string
      dateTo?: string
      sort?: 'date_asc' | 'date_desc' | 'total_asc' | 'total_desc'
    } = {},
  ) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    params.set('page', String(page))
    params.set('limit', String(limit))
    for (const p of filters.payment ?? []) params.append('payment', p)
    for (const s of filters.status ?? []) params.append('status', s)
    if (filters.dateFrom) params.set('date_from', filters.dateFrom)
    if (filters.dateTo) params.set('date_to', filters.dateTo)
    if (filters.sort) params.set('sort', filters.sort)
    return request<{ orders: any[]; total: number; page: number; limit: number }>(
      `/orders?${params.toString()}`,
    )
  },
  getOrder: (id: string) => request<any>(`/orders/${id}`),
  deleteOrder: (id: string) =>
    request(`/orders/${id}`, { method: 'DELETE' }),
  returnOrder: (id: string) =>
    request(`/orders/${id}/return`, { method: 'POST' }),
  editOrder: (id: string, data: {
    edits: { item_id: string; new_qty: number }[]
    additions: {
      batch_id: string; product_name: string; batch_no: string
      qty: number; sale_price: number; gst_rate: number
    }[]
    comment: string
  }) =>
    request<{ status: string }>(`/orders/${id}/edit`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Reports
  gstReport: (from: string, to: string) =>
    request<any>(`/reports/gst?from=${from}&to=${to}`),
  gstReportExportURL: (from: string, to: string) =>
    `${BASE_URL}/reports/gst/export?from=${from}&to=${to}`,

  // Distributors
  listDistributors: (q = '') =>
    request<Distributor[]>(`/distributors?q=${encodeURIComponent(q)}`),
  createDistributor: (data: { name: string; phone?: string | null; address?: string | null; email?: string | null }) =>
    request<Distributor>('/distributors', { method: 'POST', body: JSON.stringify(data) }),
  updateDistributor: (id: string, data: { name: string; phone?: string | null; address?: string | null; email?: string | null; is_active: boolean }) =>
    request<Distributor>(`/distributors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDistributor: (id: string) =>
    request(`/distributors/${id}`, { method: 'DELETE' }),
  listBatchesByDistributor: (id: string) =>
    request<DistributorBatchRow[]>(`/distributors/${id}/batches`),

  // Settings
  getSettings: () => request<ShopSettings>('/settings'),
  updateSettings: (data: ShopSettings) =>
    request<ShopSettings>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
}
