import type { ShopSettings } from '@/types'

const CACHE_KEY = 'shop_settings'

export function getCachedSettings(): ShopSettings | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(CACHE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ShopSettings
  } catch {
    return null
  }
}

export function setCachedSettings(s: ShopSettings): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CACHE_KEY, JSON.stringify(s))
}

export function clearSettingsCache(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(CACHE_KEY)
}
