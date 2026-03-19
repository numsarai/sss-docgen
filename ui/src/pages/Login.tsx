import { useState } from 'react'
import { api } from '../api'

export default function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await api.login(password)
      localStorage.setItem('token', res.access_token)
      window.location.href = '/' // hard redirect to clear state and re-route
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-dim)'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        <div className="card-header" style={{ textAlign: 'center', padding: '32px 24px 16px' }}>
          <img src="/sss-logo.png" alt="SSS Logo" style={{ width: 160, marginBottom: 16, display: 'inline-block' }} />
          <h2 style={{ fontSize: 18, margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: 1 }}>Saraithong</h2>
          <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 13, opacity: 0.8 }}>Superassistant System</p>
          <p className="text-2" style={{ margin: '24px 0 0 0' }}>Sign in to continue</p>
        </div>
        <form className="card-body" onSubmit={handleLogin}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter access token"
              required
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
