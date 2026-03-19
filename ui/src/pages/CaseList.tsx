import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api, type CaseList as CaseListData, type CaseResponse } from '../api'
import StatusBadge from '../components/StatusBadge'

const LIMIT = 20

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function basename(p: string | null) {
  if (!p) return '—'
  return p.split(/[\\/]/).pop() ?? p
}

export default function CaseList() {
  const navigate = useNavigate()
  const [data, setData] = useState<CaseListData | null>(null)
  const [skip, setSkip]   = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [downloading, setDownloading] = useState(false)

  const load = useCallback(async (s: number, q = search, st = statusFilter) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getCases(s, LIMIT, q, st)
      setData(res)
      setSkip(s)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load cases')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => { load(0, search, statusFilter) }, [])

  async function handleBatchDownload() {
    if (selectedIds.size === 0) return
    setDownloading(true)
    setError(null)
    try {
      await api.batchDownloadCases(Array.from(selectedIds))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to download ZIP')
    } finally {
      setDownloading(false)
    }
  }

  async function handleDelete(e: React.MouseEvent, c: CaseResponse) {
    e.stopPropagation()
    if (!window.confirm(`Delete case #${c.id}? This will also remove the generated files.`)) return
    setDeletingId(c.id)
    try {
      await api.deleteCase(c.id)
      toast.success(`Case #${c.id} deleted successfully.`)
      // Reload current page; if it becomes empty go back one page
      const newSkip = data && data.items.length === 1 && skip > 0 ? skip - LIMIT : skip
      await load(newSkip)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete case')
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0
  const page       = Math.floor(skip / LIMIT) + 1

  return (
    <>
      <div className="page-header-row" style={{ flexWrap: 'wrap', gap: 16 }}>
        <h2>Cases</h2>
        <div className="flex gap-8" style={{ flex: 1, minWidth: 300 }}>
          <form className="flex gap-8" style={{ width: '100%' }} onSubmit={e => { e.preventDefault(); load(0) }}>
            <input
              type="text"
              style={{ flex: 1, minWidth: 150 }}
              placeholder="Search template name or attributes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              style={{ width: 140 }}
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value)
                load(0, search, e.target.value)
              }}
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="generating">Generating</option>
              <option value="generated">Generated</option>
              <option value="error">Error</option>
            </select>
            <button type="submit" className="btn btn-secondary">Search</button>
          </form>
        </div>
        <div className="flex gap-8">
          {selectedIds.size > 0 && (
            <button className="btn btn-secondary" onClick={handleBatchDownload} disabled={downloading}>
              {downloading ? 'Zipping...' : `Download ${selectedIds.size} Cases`}
            </button>
          )}
          <Link to="/extract" className="btn btn-secondary">AI Extract</Link>
          <Link to="/generate" className="btn btn-primary">+ New Document</Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading">
          <div className="loading-spinner" />
          Loading cases…
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="empty">
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No cases yet</p>
          <p>Generate your first document to get started.</p>
          <Link to="/generate" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>
            Create Document
          </Link>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!!data && data.items.length > 0 && selectedIds.size === data.items.length}
                      onChange={e => {
                        if (e.target.checked && data) setSelectedIds(new Set(data.items.map(c => c.id)))
                        else setSelectedIds(new Set())
                      }}
                    />
                  </th>
                  <th>#</th>
                  <th>Template</th>
                  <th>Status</th>
                  <th>Variables</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map(c => (
                  <tr
                    key={c.id}
                    style={{ cursor: 'pointer', opacity: deletingId === c.id ? 0.4 : 1, transition: 'opacity .15s' }}
                    onClick={() => navigate(`/cases/${c.id}`)}
                  >
                    <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={e => {
                          const s = new Set(selectedIds)
                          if (e.target.checked) s.add(c.id)
                          else s.delete(c.id)
                          setSelectedIds(s)
                        }}
                      />
                    </td>
                    <td className="td-mono">{c.id}</td>
                    <td className="td-path" title={c.template}>{basename(c.template)}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td className="td-mono">{Object.keys(c.variables).length} fields</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-2)', fontSize: 13 }}>
                      {formatDate(c.created_at)}
                    </td>
                    <td>
                      <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
                        <Link
                          to={`/cases/${c.id}`}
                          className="btn btn-ghost btn-sm"
                          onClick={e => e.stopPropagation()}
                        >
                          View →
                        </Link>
                        <button
                          className="btn btn-danger btn-sm"
                          title="Delete case"
                          disabled={deletingId === c.id}
                          onClick={e => handleDelete(e, c)}
                        >
                          🗑
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
              <button
                className="btn btn-secondary btn-sm"
                disabled={skip === 0}
                onClick={() => load(Math.max(0, skip - LIMIT))}
              >
                ← Prev
              </button>
              <span>Page {page} of {totalPages} · {data?.total} total</span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={skip + LIMIT >= (data?.total ?? 0)}
                onClick={() => load(skip + LIMIT)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
