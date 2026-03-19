import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const ONLYOFFICE_API = 'http://localhost:8080/web-apps/apps/api/documents/api.js'

declare global {
  interface Window {
    DocsAPI: {
      DocEditor: new (id: string, config: object) => { destroyEditor(): void }
    }
  }
}

interface Props {
  type: 'case' | 'template'
}

export default function DocumentEditor({ type }: Props) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const editorRef = useRef<{ destroyEditor(): void } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    const configUrl = type === 'case'
      ? `/api/cases/${id}/editor-config`
      : `/api/templates/${id}/editor-config`

    const script = document.createElement('script')
    script.src = ONLYOFFICE_API

    script.onload = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(configUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }))
          throw new Error(err.detail ?? res.statusText)
        }
        const config = await res.json()
        setLoading(false)
        editorRef.current = new window.DocsAPI.DocEditor('onlyoffice-editor', {
          ...config,
          height: '100%',
          width: '100%',
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load editor')
        setLoading(false)
      }
    }

    script.onerror = () => {
      setError('Cannot connect to OnlyOffice Document Server.')
      setLoading(false)
    }

    document.head.appendChild(script)

    return () => {
      if (document.head.contains(script)) document.head.removeChild(script)
      editorRef.current?.destroyEditor()
      editorRef.current = null
    }
  }, [id, type])

  const backPath  = type === 'case' ? `/cases/${id}` : '/templates'
  const backLabel = type === 'case' ? '← Case' : '← Templates'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      {/* Slim top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 16px', background: '#1e2a3a', color: '#fff',
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate(backPath)}
          style={{
            background: 'rgba(255,255,255,0.12)', border: 'none',
            color: '#fff', padding: '4px 12px', borderRadius: 6,
            cursor: 'pointer', fontSize: 13,
          }}
        >
          {backLabel}
        </button>
        {loading && !error && (
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
            Loading editor…
          </span>
        )}
      </div>

      {/* Editor area */}
      {error ? (
        <div style={{ padding: 32 }}>
          <div style={{
            background: '#fee2e2', border: '1px solid #fca5a5',
            borderRadius: 8, padding: 20, marginBottom: 16,
          }}>
            <strong>Cannot open editor:</strong> {error}
          </div>
          <p style={{ fontSize: 14, color: '#555', marginBottom: 12 }}>
            OnlyOffice Document Server must be running. Start it with:
          </p>
          <pre style={{
            background: '#1e2a3a', color: '#7dd3fc',
            padding: '12px 16px', borderRadius: 8,
            fontSize: 13, overflowX: 'auto',
          }}>
            {`docker run -d --name onlyoffice -p 8080:80 -e JWT_ENABLED=false onlyoffice/documentserver`}
          </pre>
          <p style={{ fontSize: 13, color: '#888', marginTop: 12 }}>
            The first run downloads ~3 GB and takes a few minutes to start.
          </p>
        </div>
      ) : (
        <div id="onlyoffice-editor" style={{ flex: 1, minHeight: 0 }} />
      )}
    </div>
  )
}
