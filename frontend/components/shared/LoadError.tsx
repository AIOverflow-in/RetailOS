'use client'

/** Shown in place of data that failed to load, so a failure never looks like an empty list or ₹0. */
export default function LoadError({ what, message, onRetry }: {
  what: string
  message: string
  onRetry: () => void
}) {
  return (
    <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
      <p className="text-body-sm text-red-600">Couldn&apos;t load {what}: {message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 text-body-sm font-medium text-red-700 hover:text-red-900 transition-colors"
      >
        Retry
      </button>
    </div>
  )
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.'
}
