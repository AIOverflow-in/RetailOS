const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

function getSAToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('sa_token')
}

async function saRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getSAToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('sa_token')
    window.location.href = '/super-admin/login'
    throw new Error('Unauthorized')
  }

  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    throw new Error(data?.error || `Request failed: ${res.status}`)
  }

  return data as T
}

export const superAdminApi = {
  login: (username: string, password: string) =>
    saRequest<{ message: string; session_id: string }>(
      '/super-admin/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }) }
    ),

  verifyOTP: (session_id: string, otp: string) =>
    saRequest<{ token: string }>(
      '/super-admin/auth/verify-otp',
      { method: 'POST', body: JSON.stringify({ session_id, otp }) }
    ),

  listTenants: () =>
    saRequest('/super-admin/tenants'),

  createTenant: (data: {
    shop_name: string
    username: string
    password: string
    order_prefix: string
  }) =>
    saRequest('/super-admin/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  setTenantActive: (id: string, is_active: boolean) =>
    saRequest(`/super-admin/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
    }),
}
