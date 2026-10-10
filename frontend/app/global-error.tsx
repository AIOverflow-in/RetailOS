'use client' // Error boundaries must be Client Components

// Replaces the root layout when it crashes, so global styles may not be loaded:
// keep it self-contained.
export default function GlobalError({ error, unstable_retry }: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#FAFAFA', margin: 0 }}>
        <title>SellOS</title>
        <div role="alert" style={{ maxWidth: 420, margin: '80px auto', padding: 24, background: '#fff', border: '1px solid #EBEBEB', borderRadius: 8, textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, margin: '0 0 8px', color: '#111' }}>SellOS ran into a problem</h2>
          <p style={{ fontSize: 14, color: '#888', margin: '0 0 16px' }}>
            Your saved bills and stock are safe. Try again, or reload the page.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{ height: 36, padding: '0 16px', background: '#111', color: '#fff', border: 0, borderRadius: 8, fontSize: 14, cursor: 'pointer' }}
          >
            Try again
          </button>
          {error.digest && <p style={{ fontSize: 12, color: '#BBB', marginTop: 16 }}>Reference: {error.digest}</p>}
        </div>
      </body>
    </html>
  )
}
