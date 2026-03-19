import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api, type BatchSummary, type TemplateResponse } from '../api'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatusPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 12, fontSize: 12,
      background: color, color: '#fff', fontWeight: 600,
    }}>
      {count} {label}
    </span>
  )
}

export default function BatchList() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [batches, setBatches]       = useState<BatchSummary[]>([])
  const [templates, setTemplates]   = useState<TemplateResponse[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [uploading, setUploading]   = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [template, setTemplate]     = useState('')
  const [file, setFile]             = useState<File | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function load() {
    try {
      const res = await api.getBatches()
      setBatches(res.items)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load batches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    api.getTemplates(0, 200).then(d => setTemplates(d.items)).catch(() => {})
  }, [])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !template.trim()) return
    setUploading(true)
    try {
      const batch = await api.uploadBatch(template.trim(), file)
      toast.success(`Batch created — ${batch.total} records imported.`)
      setShowUpload(false)
      setFile(null)
      setTemplate('')
      if (fileRef.current) fileRef.current.value = ''
      navigate(`/batches/${batch.id}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(e: React.MouseEvent, b: BatchSummary) {
    e.stopPropagation()
    if (!window.confirm(`Delete batch "${b.filename}" and all ${b.total} records?`)) return
    setDeletingId(b.id)
    try {
      await api.deleteBatch(b.id)
      toast.success('Batch deleted.')
      setBatches(prev => prev.filter(x => x.id !== b.id))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className="page-header-row">
        <div>
          <h2>Batch Records</h2>
          <p className="text-2">Upload Excel files to manage multiple records at once.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowUpload(v => !v)}>
          + Upload Excel
        </button>
      </div>

      {/* Upload form */}
      {showUpload && (
        <div className="card mb-24">
          <div className="card-header"><h3>Upload Excel</h3></div>
          <form className="card-body" onSubmit={handleUpload}>
            <div className="form-group">
              <label>Template</label>
              {templates.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {templates.map(t => (
                    <button key={t.id} type="button"
                      className={`btn btn-sm ${template === t.path ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setTemplate(t.path)}>
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
              <input
                type="text" placeholder="/path/to/template.docx"
                value={template} onChange={e => setTemplate(e.target.value)} required
              />
            </div>
            <div className="form-group">
              <label>Excel file <small>(.xlsx — row 1 = headers matching template fields)</small></label>
              <input
                ref={fileRef} type="file" accept=".xlsx,.xls"
                onChange={e => setFile(e.target.files?.[0] ?? null)} required
              />
            </div>
            <div className="flex gap-8">
              <button type="submit" className="btn btn-primary" disabled={uploading || !file || !template.trim()}>
                {uploading ? 'Uploading…' : 'Upload & Create Batch'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowUpload(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading"><div className="loading-spinner" /> Loading…</div>
      ) : batches.length === 0 ? (
        <div className="empty">
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No batches yet</p>
          <p>Upload an Excel file to create your first batch.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowUpload(true)}>
            Upload Excel
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>File</th>
                <th>Template</th>
                <th style={{ textAlign: 'center' }}>Records</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {batches.map(b => (
                <tr key={b.id} style={{ cursor: 'pointer', opacity: deletingId === b.id ? 0.4 : 1 }}
                    onClick={() => navigate(`/batches/${b.id}`)}>
                  <td className="td-mono">{b.id}</td>
                  <td style={{ fontWeight: 500 }}>{b.filename}</td>
                  <td className="td-path" title={b.template} style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.template.split(/[\\/]/).pop() ?? b.template}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div className="flex gap-6" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                      <StatusPill label="draft"     count={b.draft}     color="#64748b" />
                      <StatusPill label="edited"    count={b.edited}    color="#2563eb" />
                      <StatusPill label="generated" count={b.generated} color="#16a34a" />
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text-2)', fontSize: 13 }}>
                    {formatDate(b.created_at)}
                  </td>
                  <td>
                    <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
                      <Link to={`/batches/${b.id}`} className="btn btn-ghost btn-sm"
                            onClick={e => e.stopPropagation()}>
                        Open →
                      </Link>
                      <button className="btn btn-danger btn-sm" disabled={deletingId === b.id}
                              onClick={e => handleDelete(e, b)}>
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
