'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import { refreshCatalog } from '@/lib/productCatalog'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const token = useSelector((s: RootState) => s.auth.token)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !token) router.replace('/login')
    // Load the product list as soon as the app opens, so billing search is instant.
    if (mounted && token) refreshCatalog()
  }, [mounted, token, router])

  // Always render children — keeps server and client HTML identical,
  // preventing hydration mismatches. Redirect happens after mount via effect.
  return <>{children}</>
}
