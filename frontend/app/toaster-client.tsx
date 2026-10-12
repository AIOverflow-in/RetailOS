'use client'

import { useEffect, useState } from 'react'
import { Toaster } from '@/components/ui/sonner'

// Rendered only after mount so it never touches server HTML (Sonner's <section>
// clashed with AuthGuard's null server output). Imported statically rather than
// via next/dynamic: a lazily fetched chunk never loads if the shop goes offline
// first, and then every error toast would be invisible exactly when it matters.
export default function ToasterClient() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? <Toaster richColors position="top-right" /> : null
}
