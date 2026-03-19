import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api, type TemplateResponse, type BankInfo } from '../api'

// ---------------------------------------------------------------------------
// Bank field helpers (mirrors BatchDetail)
// ---------------------------------------------------------------------------

const BANK_CODE_FIELDS = new Set(['รหัสธนาคาร', 'BANK_ID'])
function isBankField(name: string) { return BANK_CODE_FIELDS.has(name) }

// ---------------------------------------------------------------------------
// Variable input — plain text or bank dropdown
// ---------------------------------------------------------------------------

function VarInput({
  fieldName, value, banks, onChange,
}: {
  fieldName: string
  value: string
  banks: BankInfo[]
  onChange: (v: string) => void
}) {
  if (isBankField(fieldName) && banks.length > 0) {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%' }}>
        <option value="">— เลือกธนาคาร —</option>
        {banks.map(b => (
          <option key={b.code} value={b.code}>{b.code} — {b.name}</option>
        ))}
      </select>
    )
  }
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={fieldName}
    />
  )
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = 'single' | 'batch'
type SinglePhase = 'setup' | 'preview'

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function GeneratePage() {
  const navigate = useNavigate()

  const [mode, setMode]           = useState<Mode>('single')
  const [templates, setTemplates] = useState<TemplateResponse[]>([])
  const [template, setTemplate]   = useState<TemplateResponse | null>(null)
  const [banks, setBanks]         = useState<BankInfo[]>([])

  // --- Single mode ---
  const [phase, setPhase]         = useState<SinglePhase>('setup')
  const [vars, setVars]           = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)
  const [caseId, setCaseId]       = useState<number | null>(null)
  const [discarding, setDiscarding] = useState(false)
  // Track whether the preview case was already discarded so we don't double-delete
  const pendingCaseRef = useRef<number | null>(null)

  // --- Batch mode ---
  const fileRef = useRef<HTMLInputElement>(null)
  const [batchFile, setBatchFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    api.getTemplates(0, 100).then(d => setTemplates(d.items)).catch(() => {})
    api.getBanks().then(setBanks).catch(() => {})
  }, [])

  // Discard pending preview case when navigating away
  useEffect(() => {
    return () => {
      if (pendingCaseRef.current) {
        api.deleteCase(pendingCaseRef.current).catch(() => {})
      }
    }
  }, [])

  function selectTemplate(t: TemplateResponse) {
    setTemplate(t)
    setVars(Object.fromEntries(t.fields.map(f => [f, ''])))
    // Going back to setup discards any existing preview
    if (pendingCaseRef.current) {
      api.deleteCase(pendingCaseRef.current).catch(() => {})
      pendingCaseRef.current = null
    }
    setCaseId(null)
    setPhase('setup')
  }

  function setVar(key: string, val: string) {
    setVars(prev => ({ ...prev, [key]: val }))
  }

  // ---- Single: generate / re-generate ----
  async function handleGenerate() {
    if (!template) return

    // Delete previous preview case before generating a new one
    if (pendingCaseRef.current) {
      try { await api.deleteCase(pendingCaseRef.current) } catch {}
      pendingCaseRef.current = null
      setCaseId(null)
    }

    setGenerating(true)
    try {
      const res = await api.generate(template.path, vars)
      pendingCaseRef.current = res.id
      setCaseId(res.id)
      setPhase('preview')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  // ---- Single: discard preview ----
  async function handleDiscard() {
    if (pendingCaseRef.current) {
      setDiscarding(true)
      try { await api.deleteCase(pendingCaseRef.current) } catch {}
      pendingCaseRef.current = null
      setDiscarding(false)
    }
    setCaseId(null)
    setPhase('setup')
  }

  // ---- Single: save (navigate to case) ----
  function handleSave() {
    if (!caseId) return
    pendingCaseRef.current = null   // Don't delete on unmount — it's kept
    navigate(`/cases/${caseId}`)
  }

  // ---- Batch: upload ----
  async function handleBatchUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!batchFile || !template) return
    setUploading(true)
    try {
      const batch = await api.uploadBatch(template.path, batchFile)
      toast.success(`${batch.total} records imported`)
      navigate(`/batches/${batch.id}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function switchMode(m: Mode) {
    // Discard any pending single-mode preview
    if (m !== 'single' && pendingCaseRef.current) {
      api.deleteCase(pendingCaseRef.current).catch(() => {})
      pendingCaseRef.current = null
      setCaseId(null)
    }
    setMode(m)
    setPhase('setup')
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isPreview = mode === 'single' && phase === 'preview' && caseId !== null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Page header ── */}
      <div className="page-header-row" style={{ marginBottom: 0 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Generate Documents</h2>
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
            Fill in data manually for one copy, or upload an Excel file to create multiple copies.
          </p>
        </div>
      </div>

      {/* ── Mode tabs ── */}
      <div style={{
        display: 'flex', borderBottom: '2px solid var(--border)',
        marginTop: 20, marginBottom: 24,
      }}>
        {(['single', 'batch'] as Mode[]).map(m => (
          <button key={m} onClick={() => switchMode(m)} style={{
            padding: '10px 28px', background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 14, fontWeight: 600,
            borderBottom: mode === m ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -2,
            color: mode === m ? 'var(--accent)' : 'var(--text-2)',
            transition: 'color .15s',
          }}>
            {m === 'single' ? 'Single Copy' : 'Excel Batch'}
          </button>
        ))}
      </div>

      {/* ── Template picker (always visible in setup phase) ── */}
      {phase === 'setup' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><h3>Select Template</h3></div>
          <div className="card-body">
            {templates.length === 0 ? (
              <p className="text-2">
                No templates yet.{' '}
                <Link to="/templates/new">Upload a template first.</Link>
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {templates.map(t => (
                  <button key={t.id} type="button"
                    className={`btn btn-sm ${template?.id === t.id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => selectTemplate(t)}
                  >
                    {t.name}
                    <span style={{ opacity: 0.55, fontSize: 11, marginLeft: 4 }}>
                      ({t.fields_count})
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          SINGLE MODE — setup phase
          ════════════════════════════════════════════ */}
      {mode === 'single' && phase === 'setup' && template && (
        <div className="card">
          <div className="card-header">
            <h3>Fill Variables</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-2)' }}>
              {template.name} · {template.fields.length} fields
            </p>
          </div>
          <div className="card-body">
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '12px 20px', marginBottom: 24,
            }}>
              {template.fields.map(field => (
                <div key={field} className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>{field}</label>
                  <VarInput
                    fieldName={field}
                    value={vars[field] ?? ''}
                    banks={banks}
                    onChange={v => setVar(field, v)}
                  />
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <><span className="loading-spinner" style={{ width: 16, height: 16, display: 'inline-block', marginRight: 8 }} />Generating…</>
              ) : 'Generate Preview'}
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          SINGLE MODE — preview phase (split layout)
          ════════════════════════════════════════════ */}
      {isPreview && (
        <div style={{ display: 'flex', gap: 20, flex: '1 1 0', minHeight: 0 }}>

          {/* Left: edit panel */}
          <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="card-header" style={{ flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Edit Variables</h3>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-2)' }}>
                      {template?.name} · Case #{caseId}
                    </p>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => selectTemplate(template!)}
                    style={{ fontSize: 11, color: 'var(--text-2)' }}
                    title="Change template"
                  >
                    ← Back
                  </button>
                </div>
              </div>

              {/* Scrollable fields */}
              <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {template?.fields.map(field => (
                    <div key={field} className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 11, fontWeight: 600 }}>{field}</label>
                      <VarInput
                        fieldName={field}
                        value={vars[field] ?? ''}
                        banks={banks}
                        onChange={v => setVar(field, v)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{
                padding: '14px 20px', borderTop: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
              }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating ? 'Regenerating…' : '↺  Regenerate'}
                </button>
                <button className="btn btn-primary" onClick={handleSave}>
                  ✓  Save as Case
                </button>
                <button
                  onClick={handleDiscard}
                  disabled={discarding}
                  style={{
                    background: 'none', border: '1px solid var(--border)',
                    borderRadius: 6, padding: '7px 14px', cursor: 'pointer',
                    fontSize: 13, color: 'var(--error)',
                  }}
                >
                  {discarding ? 'Discarding…' : '✕  Discard'}
                </button>
              </div>
            </div>
          </div>

          {/* Right: PDF preview */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            background: 'var(--surface)', borderRadius: 12,
            border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Preview</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={api.downloadDocx(caseId!)} className="btn btn-ghost btn-sm">↓ DOCX</a>
                <a href={api.downloadPdf(caseId!)} className="btn btn-ghost btn-sm">↓ PDF</a>
              </div>
            </div>
            <iframe
              key={caseId}
              src={api.previewPdf(caseId!)}
              style={{ flex: 1, border: 'none', width: '100%', minHeight: 500 }}
              title="Document Preview"
            />
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          BATCH MODE — setup phase
          ════════════════════════════════════════════ */}
      {mode === 'batch' && phase === 'setup' && template && (
        <div className="card">
          <div className="card-header">
            <h3>Upload Excel File</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-2)' }}>
              {template.name} · Row 1 = column headers matching template fields
            </p>
          </div>
          <form className="card-body" onSubmit={handleBatchUpload}>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ margin: 0 }}>Excel file <small>(.xlsx)</small></label>
                <a
                  href={api.downloadTemplateExcel(template.id)}
                  className="btn btn-ghost btn-sm"
                  title="Download Excel template with correct column headers pre-filled"
                  style={{ fontSize: 12 }}
                >
                  ↓ Get Excel Template
                </a>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={e => setBatchFile(e.target.files?.[0] ?? null)}
                required
              />
              <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>
                Download the Excel template above to get the correct column headers, fill it in, then upload here.
              </p>
            </div>

            {/* Field reference */}
            <div style={{
              background: 'var(--surface-2)', borderRadius: 8,
              padding: '12px 16px', marginBottom: 20,
            }}>
              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-2)' }}>
                Required columns ({template.fields.length}):
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {template.fields.map(f => (
                  <span key={f} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    color: 'var(--text-2)',
                  }}>{f}</span>
                ))}
              </div>
            </div>

            <div className="flex gap-8">
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={uploading || !batchFile}
              >
                {uploading ? 'Uploading…' : 'Upload & Create Records'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setBatchFile(null); if (fileRef.current) fileRef.current.value = '' }}
                disabled={!batchFile}
              >
                Clear
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Placeholder when no template selected yet */}
      {phase === 'setup' && !template && templates.length > 0 && (
        <div className="empty" style={{ marginTop: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Select a template to continue</p>
          <p>Choose one of the templates above.</p>
        </div>
      )}
    </div>
  )
}
