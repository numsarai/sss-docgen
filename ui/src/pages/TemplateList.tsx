import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type TemplateList as TemplateListData } from '../api'

const LIMIT = 20

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function TemplateList() {
  const navigate = useNavigate()
  const [data, setData]     = useState<TemplateListData | null>(null)
  const [skip, setSkip]     = useState(0)
  const [error, setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)

  const load = useCallback(async (s: number) => {
    setLoading(true); setError(null)
    try {
      setData(await api.getTemplates(s, LIMIT))
      setSkip(s)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load templates')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(0) }, [load])

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return
    setDeleting(id)
    try {
      await api.deleteTemplate(id)
      await load(skip)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally { setDeleting(null) }
  }

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0
  const page       = Math.floor(skip / LIMIT) + 1

  return (
    <>
      <div className="page-header-row">
        <h2>Templates</h2>
        <Link to="/templates/new" className="btn btn-primary">+ Add Template</Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading"><div className="loading-spinner" />Loading templates…</div>
      ) : data && data.items.length === 0 ? (
        <div className="empty">
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No templates yet</p>
          <p>Upload a .docx template to get started.</p>
          <Link to="/templates/new" className="btn btn-primary"
            style={{ marginTop: 16, display: 'inline-flex' }}>
            Add Template
          </Link>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Fields</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map(t => (
                  <tr key={t.id} style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/templates/${t.id}/edit`)}>
                    <td className="td-mono">{t.id}</td>
                    <td style={{ fontWeight: 500 }}>{t.name}</td>
                    <td className="text-2" style={{ maxWidth: 260 }}>
                      <span className="truncate" style={{ display: 'block' }}>
                        {t.description || '—'}
                      </span>
                    </td>
                    <td className="td-mono">{t.fields_count} fields</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-2)', fontSize: 13 }}>
                      {formatDate(t.updated_at)}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex gap-8">
                        <a href={api.downloadTemplate(t.id)}
                          className="btn btn-ghost btn-sm" title="Download .docx">
                          ↓ DOCX
                        </a>
                        <a href={api.downloadTemplateExcel(t.id)}
                          className="btn btn-ghost btn-sm" title="Download Excel fill-in template"
                          style={{ color: '#16a34a' }}>
                          ↓ XLS
                        </a>
                        <Link to={`/templates/${t.id}/edit-file`} className="btn btn-primary btn-sm">
                          Edit File
                        </Link>
                        <Link to={`/templates/${t.id}/edit`} className="btn btn-secondary btn-sm">
                          Details
                        </Link>
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={deleting === t.id}
                          onClick={() => handleDelete(t.id, t.name)}
                        >
                          {deleting === t.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="btn btn-secondary btn-sm" disabled={skip === 0}
                onClick={() => load(Math.max(0, skip - LIMIT))}>← Prev</button>
              <span>Page {page} of {totalPages} · {data?.total} total</span>
              <button className="btn btn-secondary btn-sm"
                disabled={skip + LIMIT >= (data?.total ?? 0)}
                onClick={() => load(skip + LIMIT)}>Next →</button>
            </div>
          )}
        </>
      )}
    </>
  )
}
