'use client'

import { useState, useRef } from 'react'
import { api } from '@/lib/api'
import type { Product } from '@/types'

export function useProductSearch() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [allProducts, setAllProducts] = useState<Product[] | null>(null)
  const [catalogExceedsCap, setCatalogExceedsCap] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function triggerPreload() {
    if (allProducts !== null) return // Already fetched

    try {
      const result = await api.searchAllProducts()
      setAllProducts(result.products)
      // Check if catalog exceeds the 200-record cap
      if (result.total > result.products.length) {
        setCatalogExceedsCap(true)
      }
    } catch (err) {
      // On error, fall back to server search
      setCatalogExceedsCap(true)
    }
  }

  function handleQuery(val: string) {
    setQuery(val)

    if (searchTimer.current) clearTimeout(searchTimer.current)

    if (val.trim().length === 0) {
      setSuggestions([])
      return
    }

    // If we have cached products and catalog fits within cap, filter locally
    if (allProducts !== null && !catalogExceedsCap) {
      const lower = val.toLowerCase()
      const filtered = allProducts.filter(p =>
        p.name.toLowerCase().includes(lower) ||
        p.company_name.toLowerCase().includes(lower)
      )
      setSuggestions(filtered.slice(0, 20))
      return
    }

    // Fallback: server-side search with higher debounce and minimum length
    if (val.trim().length < 3) return

    setLoading(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.searchProducts(val)
        setSuggestions(res ?? [])
      } catch (err) {
        setSuggestions([])
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
  }
}
