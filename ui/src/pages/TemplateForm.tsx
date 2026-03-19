import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api, type TemplateResponse } from '../api'

export default function TemplateForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit  = Boolean(id)
  const navigate = useNavigate()

  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile]               = useState<File | null>(null)
  const [existing, setExisting]       = useState<TemplateResponse | null>(null)
  const [loading, setLoading]         = useState(isEdit)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  // Load existing record when editing
  useEffect(() => {
    if (!id) return
    api.getTemplateById(Number(id))
      .then(t => {
        setExisting(t)
        setName(t.name)
        setDescription(t.description ?? '')
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load template'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) { setError('Name is required.'); return }
    if (!isEdit && !file) { setError('Please select a .docx file.'); return }

    setSaving(true)
    try {
      if (isEdit && id) {
        await api.updateTemplate(Number(id), name.trim(), description, file ?? undefined)
      } else {
        await api.createTemplate(name.trim(), description, file!)
      }
      navigate('/templates')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading"><div className="loading-spinner" />Loading…</div>

  return (
    <>
      <div className="page-header-row">
        <div className="flex gap-12" style={{ alignItems: 'center' }}>
          <Link to="/templates" className="btn btn-ghost btn-sm">← Templates</Link>
          <h2>{isEdit ? `Edit "${existing?.name ?? ''}"` : 'Add Template'}</h2>
        </div>
        {isEdit && existing && (
          <a href={api.downloadTemplate(existing.id)} className="btn btn-secondary btn-sm" download>
            ↓ Download current .docx
          </a>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-header"><h3>Template details</h3></div>
          <div className="card-body">

            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Bank Freeze Letter"
              />
            </div>

            <div className="form-group">
              <label>Description <small>optional</small></label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What is this template for?"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>
                {isEdit ? 'Replace .docx file' : '.docx file'}
                {isEdit && <small>leave blank to keep current file</small>}
              </label>
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="form-hint">
                Fields are scanned automatically from {'{{placeholders}}'} in the file.
              </p>
            </div>

          </div>
        </div>

        {/* Existing fields preview (edit mode) */}
        {isEdit && existing && existing.fields.length > 0 && (
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <h3>Current fields</h3>
              <span className="text-2" style={{ fontSize: 13 }}>
                {existing.fields_count} {'{{fields}}'} detected
              </span>
            </div>
            <div className="card-body">
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 8,
              }}>
                {existing.fields.map(f => (
                  <span key={f} style={{
                    background: 'var(--primary-light)', color: 'var(--primary)',
                    borderRadius: 'var(--radius-sm)', padding: '3px 10px',
                    fontSize: 13, fontFamily: 'monospace',
                  }}>
                    {`{{${f}}}`}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-8 mt-20">
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Upload Template'}
          </button>
          <Link to="/templates" className="btn btn-secondary btn-lg">Cancel</Link>
        </div>
      </form>
    </>
  )
}
