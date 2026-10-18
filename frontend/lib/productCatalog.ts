import { api } from '@/lib/api'
import { markCatalogStale, takeCatalogStale } from '@/lib/catalogStale'
import type { Product } from '@/types'

/**
 * The shop's whole product list, shared by every search box. It is kept in
 * localStorage so the dropdown fills instantly on every visit, and refreshed in
 * the background: on first use after a page load, after anything that changes
 * products or stock (see lib/catalogStale), and at most every few minutes
 * otherwise. Refreshing matters because "Out of stock" items can't be picked,
 * so a stale list could block billing a product that was just restocked.
 */

const PAGE_SIZE = 200 // the most GET /products returns per page
const PARALLEL_PAGES = 4
const MAX_AGE_MS = 5 * 60_000

let products: Product[] | null = null
let loadedFor: string | null = null // schema the in-memory list belongs to
let fetchedAt = 0
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

const schema = () => localStorage.getItem('schema_name') ?? ''
const storageKey = (s: string) => `sellos:catalog:${s}`

const byName = (a: Product, b: Product) =>
  a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: 'base', numeric: true })

/** The cached list (memory, else localStorage), or null if never loaded. */
export function getCatalog(): Product[] | null {
  const s = schema()
  if (loadedFor !== s) {
    loadedFor = s
    products = null
    markCatalogStale()
    try {
      const raw = localStorage.getItem(storageKey(s))
      if (raw) products = JSON.parse(raw) as Product[]
    } catch {}
  }
  return products
}

export function subscribeCatalog(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** Fetches every page in the background unless the list is fresh. Never throws. */
export function refreshCatalog(): Promise<void> {
  getCatalog()
  if (inflight) return inflight
  if (!takeCatalogStale() && products && Date.now() - fetchedAt < MAX_AGE_MS) return Promise.resolve()

  const s = loadedFor
  inflight = (async () => {
    try {
      const first = await api.searchProductsPaginated('', 1, PAGE_SIZE)
      const all: Product[] = [...(first.products ?? [])]
      const pages = Math.ceil((first.total ?? 0) / PAGE_SIZE)
      for (let p = 2; p <= pages; p += PARALLEL_PAGES) {
        const batch = []
        for (let i = p; i < p + PARALLEL_PAGES && i <= pages; i++) {
          batch.push(api.searchProductsPaginated('', i, PAGE_SIZE))
        }
        for (const r of await Promise.all(batch)) all.push(...(r.products ?? []))
      }
      if (s !== schema()) return // logged into another shop meanwhile
      const seen = new Set<string>()
      products = all.filter(p => !seen.has(p.product_id) && seen.add(p.product_id)).sort(byName)
      fetchedAt = Date.now()
      try {
        localStorage.setItem(storageKey(s), JSON.stringify(products))
      } catch {} // storage full: still works, just not instant next visit
      listeners.forEach(fn => fn())
    } catch {
      markCatalogStale() // keep whatever we had; try again next time
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/** All products whose name or company contains text, in name order. */
export function filterCatalog(list: Product[], text: string): Product[] {
  const q = text.trim().toLowerCase()
  if (!q) return list
  return list.filter(p => p.name.toLowerCase().includes(q) || p.company_name.toLowerCase().includes(q))
}
