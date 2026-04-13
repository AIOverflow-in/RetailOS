import { toast } from 'sonner'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

const SERVICE_DOWN_MSG = 'Service temporarily unavailable. Please try again in 5 minutes.'

function notifyServiceUnavailable() {
  toast.error(SERVICE_DOWN_MSG, { id: 'service-unavailable', duration: 6000 })
}

function getSAToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('sa_token')
}

async function saRequest<T>(
  path: string,
  options: RequestInit = {},
  skipAuthRedirect = false
): Promise<T> {
  const token = getSAToken()
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

  if ((res.status === 401 || res.status === 403) && !skipAuthRedirect) {
    localStorage.removeItem('sa_token')
    window.location.href = '/super-admin/login'
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

export const superAdminApi = {
  login: (username: string, password: string) =>
    saRequest<{ message: string; session_id: string }>(
      '/super-admin/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }) },
      true
    ),

  verifyOTP: (session_id: string, otp: string) =>
    saRequest<{ token: string }>(
      '/super-admin/auth/verify-otp',
      { method: 'POST', body: JSON.stringify({ session_id, otp }) },
      true
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
