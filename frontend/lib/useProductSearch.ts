'use client'

import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'
import { filterCatalog, getCatalog, refreshCatalog, subscribeCatalog } from '@/lib/productCatalog'
import type { Product } from '@/types'

export function useProductSearch() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  // The shop's full product list (lib/productCatalog), or null until first loaded.
  const [allProducts, setAllProducts] = useState<Product[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  // Set when the server search failed, so callers can say so instead of showing
  // "no results" (and must not offer to create a new product off a failed search).
  const [error, setError] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Read in an effect, not during render: localStorage doesn't exist on the server.
  useEffect(() => {
    setAllProducts(getCatalog())
    const unsubscribe = subscribeCatalog(() => setAllProducts(getCatalog()))
    triggerPreload()
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function triggerPreload() {
    await refreshCatalog()
    setLoadFailed(!getCatalog())
  }

  function handleQuery(val: string) {
    setQuery(val)
    setError(null)

    if (searchTimer.current) clearTimeout(searchTimer.current)

    if (val.trim().length === 0) {
      setSuggestions([])
      return
    }

    // Normal case: search the cached list, instantly.
    if (allProducts !== null) {
      setSuggestions(filterCatalog(allProducts, val).slice(0, 20))
      return
    }

    // List not loaded yet (first visit) or failed to load: ask the server.
    if (val.trim().length < 3) return

    setLoading(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.searchProducts(val)
        setSuggestions(res ?? [])
      } catch (err) {
        setSuggestions([])
        setError(err instanceof Error ? err.message : 'Search failed. Please try again.')
      } finally {
        setLoading(false)
      }
    }, 400)
  }

  return {
    query,
    suggestions,
    loading,
    handleQuery,
    triggerPreload,
    setQuery,
    setSuggestions,
    allProducts,
    // True when the full list couldn't be loaded, so search goes to the server.
    catalogExceedsCap: allProducts === null && loadFailed,
    error,
  }
}
