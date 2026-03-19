import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api, type CaseResponse, type TemplateResponse } from '../api'

interface KvRow { key: string; value: string }

function newRow(): KvRow { return { key: '', value: '' } }

function Spinner({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', color: 'var(--text-2)' }}>
      <div className="loading-spinner" style={{ width: 24, height: 24, flexShrink: 0 }} />
      <span style={{ fontSize: 15 }}>{label}</span>
    </div>
  )
}

export default function DocumentForm() {
  const [template, setTemplate]         = useState('')
  const [rows, setRows]                 = useState<KvRow[]>([newRow()])
  const [loading, setLoading]           = useState(false)
  const [scanning, setScanning]         = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [result, setResult]             = useState<CaseResponse | null>(null)
  const [saveOnly, setSaveOnly]         = useState(false)
  const [templates, setTemplates]       = useState<TemplateResponse[]>([])
  const templateRef = useRef<HTMLInputElement>(null)
  const location = useLocation()

  useEffect(() => {
    api.getTemplates(0, 200).then(d => setTemplates(d.items)).catch(() => {})
  }, [])

  useEffect(() => {
    if (location.state?.template) setTemplate(location.state.template)
    if (location.state?.variables) {
      const v = location.state.variables as Record<string, string>
      const newRows = Object.entries(v).map(([key, value]) => ({ key, value: String(value ?? '') }))
      if (newRows.length > 0) setRows(newRows)
    }
  }, [location.state])

  function pickTemplate(t: TemplateResponse) {
    setTemplate(t.path)
    if (t.fields.length > 0) setRows(t.fields.map(f => ({ key: f, value: '' })))
  }

  function setRow(i: number, field: 'key' | 'value', val: string) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row))
  }
  function addRow() { setRows(r => [...r, newRow()]) }
  function removeRow(i: number) { setRows(r => r.filter((_, idx) => idx !== i)) }

  async function scanTemplate() {
    if (!template.trim()) {
      templateRef.current?.focus()
      return
    }
    setScanning(true)
    setError(null)
    try {
      const { fields } = await api.getTemplateFields(template.trim())
      if (fields.length === 0) {
        setError('No {{fields}} found in template.')
        return
      }
      setRows(fields.map(f => ({ key: f, value: '' })))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to scan template')
    } finally {
      setScanning(false)
    }
  }

  async function submit(generate: boolean) {
    setError(null)
    const vars: Record<string, string> = {}
    for (const { key, value } of rows) {
      if (key.trim()) vars[key.trim()] = value
    }
    if (!template.trim()) {
      setError('Template path is required.')
      return
    }
    setSaveOnly(!generate)
    setLoading(true)
    try {
      if (!generate) {
        const res = await api.createCase(template.trim(), vars)
        setResult(res)
      } else {
        const res = await api.generate(template.trim(), vars)
        let finalStatus = res.status
        let currentRes = res
        while (finalStatus === 'generating') {
          await new Promise(r => setTimeout(r, 2000))
          currentRes = await api.getCase(res.id)
          finalStatus = currentRes.status
          if (finalStatus === 'error') {
            throw new Error(currentRes.error || 'Generation failed in background.')
          }
        }
        setResult(currentRes)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <>
        <div className="page-header">
          <h2>{saveOnly ? 'Case Created' : 'Document Generated'}</h2>
          <p>Case #{result.id} has been {saveOnly ? 'saved' : 'generated successfully'}.</p>
        </div>
        <div className="alert alert-success">
          {saveOnly
            ? 'Case saved with pending status.'
            : result.status === 'generated'
              ? 'DOCX and PDF generated successfully.'
              : `Status: ${result.status}${result.error ? ' — ' + result.error : ''}`}
        </div>
        <div className="flex gap-8 mt-16">
          <Link to={`/cases/${result.id}`} className="btn btn-primary">View Case →</Link>
          <button className="btn btn-secondary" onClick={() => {
            setResult(null)
            setRows([newRow()])
            setTemplate('')
          }}>
            New Document
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="page-header">
        <h2>New Document</h2>
        <p>Fill in the template variables and generate a DOCX + PDF.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Template */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h3>Template</h3></div>
        <div className="card-body">
          {templates.length > 0 && (
            <div className="form-group">
              <label>Pick a saved template <small>or type a path below</small></label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {templates.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={`btn btn-sm ${template === t.path ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => pickTemplate(t)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="form-group">
            <label>Template path <small>absolute path to .docx</small></label>
            <div className="flex gap-8">
              <input
                ref={templateRef}
                type="text"
                value={template}
                onChange={e => setTemplate(e.target.value)}
                placeholder="/path/to/template.docx"
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-secondary"
                onClick={scanTemplate}
                disabled={scanning || !template.trim()}
              >
                {scanning ? 'Scanning…' : 'Load Fields'}
              </button>
            </div>
            <p className="form-hint">
              Click "Load Fields" to auto-populate variable rows from the template.
            </p>
          </div>
        </div>
      </div>

      {/* Variables */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3>Variables</h3>
          <button className="btn btn-secondary btn-sm" onClick={addRow}>+ Add Field</button>
        </div>
        <div className="card-body">
          {rows.length === 0 && (
            <p className="text-2" style={{ marginBottom: 12 }}>
              No fields. Click "Load Fields" or add manually.
            </p>
          )}
          {rows.map((row, i) => (
            <div className="kv-row" key={i}>
              <input
                type="text"
                placeholder="field_name"
                value={row.key}
                onChange={e => setRow(i, 'key', e.target.value)}
              />
              <input
                type="text"
                placeholder="value"
                value={row.value}
                onChange={e => setRow(i, 'value', e.target.value)}
              />
              <button
                className="btn btn-danger btn-sm"
                onClick={() => removeRow(i)}
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm mt-16" onClick={addRow}>+ Add field</button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-8">
        {loading ? (
          <Spinner label={saveOnly ? 'Saving case…' : 'Generating DOCX + PDF via LibreOffice…'} />
        ) : (
          <>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => submit(true)}
              disabled={loading}
            >
              Generate DOCX + PDF
            </button>
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => submit(false)}
              disabled={loading}
            >
              Save Only
            </button>
          </>
        )}
      </div>
    </>
  )
}
