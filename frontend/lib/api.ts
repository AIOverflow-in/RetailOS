const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

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

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401 && path !== '/auth/login') {
    localStorage.removeItem('token')
    localStorage.removeItem('shop_name')
    localStorage.removeItem('schema_name')
    window.location.href = '/login'
    throw new Error('Unauthorized')
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

  // Inventory
  listInventory: () => request<any[]>('/inventory'),

  // Customers
  lookupCustomer: (phone: string) => request<any>(`/customers?phone=${phone}`),

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

  // Reports
  gstReport: (from: string, to: string) =>
    request<any>(`/reports/gst?from=${from}&to=${to}`),
  gstReportExportURL: (from: string, to: string) =>
    `${BASE_URL}/reports/gst/export?from=${from}&to=${to}`,
}
