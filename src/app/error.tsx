'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isDev = process.env.NODE_ENV !== 'production'

  useEffect(() => {
    console.error('[ERROR BOUNDARY]', error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#000000',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: 'monospace',
    }}>
      <div style={{ maxWidth: 600, width: '100%' }}>
        <h2 style={{ fontSize: 20, marginBottom: 16, color: '#ff6b6b' }}>
          {isDev ? 'Runtime Error' : 'Something went wrong'}
        </h2>
        {isDev ? (
          <pre style={{
            background: '#1a1a2e',
            borderRadius: 12,
            padding: 16,
            overflow: 'auto',
            fontSize: 13,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            marginBottom: 16,
            color: '#e0e0e0',
          }}>
            {error.message}
            {'\n\n'}
            {error.stack}
          </pre>
        ) : (
          <p style={{
            fontSize: 14,
            lineHeight: 1.6,
            marginBottom: 16,
            color: '#e0e0e0',
          }}>
            Something went wrong. Please try again.
          </p>
        )}
        <button
          onClick={reset}
          style={{
            background: '#FFFFFF',
            color: '#000',
            border: 'none',
            borderRadius: 8,
            padding: '10px 24px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
