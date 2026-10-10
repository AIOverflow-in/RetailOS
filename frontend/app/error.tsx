'use client' // Error boundaries must be Client Components

import ErrorScreen from '@/components/shared/ErrorScreen'

export default function Error({ error, unstable_retry }: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return <ErrorScreen error={error} retry={unstable_retry} />
}
