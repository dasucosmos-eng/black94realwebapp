export default function NotFound() {
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
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 72, marginBottom: 16 }}>404</h1>
        <p style={{ color: '#94a3b8' }}>Page not found</p>
      </div>
    </div>
  )
}
