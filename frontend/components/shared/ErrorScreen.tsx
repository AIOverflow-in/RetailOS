'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/** Shown when a screen crashes, instead of a blank "Application error" page. */
export default function ErrorScreen({ error, retry }: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div role="alert" className="max-w-md mx-auto my-16 bg-white rounded-lg border border-[#EBEBEB] p-6 space-y-4 text-center">
      <div className="space-y-1">
        <h2 className="text-heading-sm font-semibold text-[#111]">Something went wrong on this screen</h2>
        <p className="text-body-sm text-[#888]">
          Your saved bills and stock are safe, and a bill you were building is kept. Try again, or go back to the dashboard.
        </p>
      </div>
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={retry}
          className="h-9 px-4 text-body font-medium bg-[#111] text-white rounded-lg hover:bg-[#333] transition-colors"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="h-9 px-4 inline-flex items-center text-body text-[#555] border border-[#E5E5E5] rounded-lg hover:border-[#CCC] transition-colors"
        >
          Dashboard
        </Link>
      </div>
      {error.digest && <p className="text-caption text-[#BBB]">Reference: {error.digest}</p>}
    </div>
  )
}
