'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

function getSAToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('sa_token')
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const token = getSAToken()
    const isLoginPage = pathname === '/super-admin/login'

    if (!token && !isLoginPage) {
      router.replace('/super-admin/login')
    } else if (token && isLoginPage) {
      router.replace('/super-admin/dashboard')
    }
  }, [mounted, pathname, router])

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {children}
    </div>
  )
}
