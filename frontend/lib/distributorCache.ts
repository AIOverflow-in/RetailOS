import type { Distributor } from '@/types'

const CACHE_KEY = 'distributors_cache'

export function getCachedDistributors(): Distributor[] | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(CACHE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Distributor[]
  } catch {
    return null
  }
}

export function setCachedDistributors(list: Distributor[]): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(list))
}

export function clearDistributorCache(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(CACHE_KEY)
}
