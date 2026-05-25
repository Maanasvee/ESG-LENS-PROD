'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 48, background: '#f8fafb', color: '#1a2e32' }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>ESG Lens — Something went wrong</h1>
        <p style={{ marginBottom: 24, color: '#5a7278' }}>{error.message}</p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            background: '#0d5c63',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
