import { useState, useEffect, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api, type BatchRecord, type BatchSummary, type BankInfo } from '../api'

// ---------------------------------------------------------------------------
// Inline PDF preview panel
// ---------------------------------------------------------------------------

function PreviewPanel({ caseId, onClose }: { caseId: number; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12,
        width: '100%', maxWidth: 960, height: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Preview — Case #{caseId}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a href={api.downloadDocx(caseId)} className="btn btn-ghost btn-sm">↓ DOCX</a>
            <a href={api.downloadPdf(caseId)} className="btn btn-ghost btn-sm">↓ PDF</a>
            <Link to={`/cases/${caseId}`} className="btn btn-secondary btn-sm">Open Case →</Link>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
              color: 'var(--text-2)', lineHeight: 1, marginLeft: 4,
            }}>×</button>
          </div>
        </div>
        {/* PDF iframe */}
        <iframe
          key={caseId}
          src={api.previewPdf(caseId)}
          style={{ flex: 1, border: 'none', width: '100%', borderRadius: '0 0 12px 12px' }}
          title="Case Preview"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bank field detection
// ---------------------------------------------------------------------------

const BANK_CODE_FIELDS = new Set(['รหัสธนาคาร', 'BANK_ID'])

function isBankField(name: string) {
  return BANK_CODE_FIELDS.has(name)
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_COLOR: Record<string, string> = {
  draft:     '#64748b',
  edited:    '#2563eb',
  generated: '#16a34a',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 12,
      fontSize: 12, fontWeight: 600, color: '#fff',
      background: STATUS_COLOR[status] ?? '#64748b',
    }}>
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Bank selector component
// ---------------------------------------------------------------------------

function BankSelect({
  fieldName, value, banks, onChange,
}: {
  fieldName: string
  value: string
  banks: BankInfo[]
  onChange: (code: string) => void
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
            style={{ width: '100%' }}>
      <option value="">— เลือกธนาคาร —</option>
      {banks.map(b => (
        <option key={b.code} value={b.code}>
          {b.code} — {b.name}
        </option>
      ))}
    </select>
  )
}

// ---------------------------------------------------------------------------
// Edit modal / drawer
// ---------------------------------------------------------------------------

function EditModal({
  record, banks, onSave, onClose,
}: {
  record: BatchRecord
  banks: BankInfo[]
  onSave: (vars: Record<string, string>) => Promise<void>
  onClose: () => void
}) {
  const [vars, setVars]     = useState<Record<string, string>>({ ...record.variables })
  const [saving, setSaving] = useState(false)

  function set(key: string, val: string) {
    setVars(prev => ({ ...prev, [key]: val }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(vars)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const fields = Object.keys(vars)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, width: '100%',
        maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h3 style={{ margin: 0 }}>Edit Row #{record.row_number}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
              {fields.length} fields · <StatusBadge status={record.status} />
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
            color: 'var(--text-2)', lineHeight: 1,
          }}>×</button>
        </div>

        {/* Fields */}
        <div style={{ overflowY: 'auto', padding: '16px 24px', flex: 1 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px',
          }}>
            {fields.map(key => (
              <div key={key} className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>{key}</label>
                {isBankField(key) ? (
                  <BankSelect
                    fieldName={key} value={vars[key]} banks={banks}
                    onChange={val => set(key, val)}
                  />
                ) : (
                  <input
                    type="text" value={vars[key]}
                    onChange={e => set(key, e.target.value)}
                    placeholder={key}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BatchDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [batch, setBatch]               = useState<BatchSummary | null>(null)
  const [records, setRecords]           = useState<BatchRecord[]>([])
  const [banks, setBanks]               = useState<BankInfo[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [editingRecord, setEditingRecord] = useState<BatchRecord | null>(null)
  const [generatingId, setGeneratingId] = useState<number | null>(null)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [pollTimer, setPollTimer]       = useState<ReturnType<typeof setTimeout> | null>(null)
  const [previewCaseId, setPreviewCaseId] = useState<number | null>(null)

  const batchId = Number(id)

  const loadAll = useCallback(async () => {
    try {
      const [b, recs] = await Promise.all([
        api.getBatch(batchId),
        api.getBatchRecords(batchId),
      ])
      setBatch(b)
      setRecords(recs)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load batch')
    } finally {
      setLoading(false)
    }
  }, [batchId])

  useEffect(() => {
    if (!id) return
    loadAll()
    api.getBanks().then(setBanks).catch(() => {})
  }, [id, loadAll])

  // Poll while any record is being generated in the background
  useEffect(() => {
    const generating = records.some(r => r.status === 'draft' || r.status === 'edited')
    const hasGenerating = batch && batch.generated < batch.total && generatingAll
    if (hasGenerating && !pollTimer) {
      const t = setInterval(loadAll, 3000)
      setPollTimer(t)
    } else if (!hasGenerating && pollTimer) {
      clearInterval(pollTimer)
      setPollTimer(null)
    }
    return () => { if (pollTimer) clearInterval(pollTimer) }
  }, [generatingAll, batch, records, loadAll])

  async function handleSaveRecord(vars: Record<string, string>) {
    if (!editingRecord) return
    const updated = await api.updateBatchRecord(batchId, editingRecord.id, vars)
    toast.success(`Row #${updated.row_number} saved.`)
    setRecords(prev => prev.map(r => r.id === updated.id ? updated : r))
    setBatch(prev => prev ? {
      ...prev,
      draft:  prev.draft  - (editingRecord.status === 'draft' ? 1 : 0),
      edited: prev.edited + (editingRecord.status === 'draft' ? 1 : 0),
    } : prev)
  }

  async function handleGenerateSingle(rec: BatchRecord) {
    setGeneratingId(rec.id)
    try {
      const updated = await api.generateBatchRecord(batchId, rec.id)
      toast.success(`Row #${rec.row_number} generated.`)
      setRecords(prev => prev.map(r => r.id === updated.id ? updated : r))
      await loadAll()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGeneratingId(null)
    }
  }

  async function handleGenerateAll() {
    setGeneratingAll(true)
    try {
      const res = await api.generateAllBatchRecords(batchId)
      toast.success(res.message)
      // Start polling for completion
      const interval = setInterval(async () => {
        const [b, recs] = await Promise.all([api.getBatch(batchId), api.getBatchRecords(batchId)])
        setBatch(b)
        setRecords(recs)
        if (b.draft === 0 && b.edited === 0) {
          clearInterval(interval)
          setGeneratingAll(false)
          toast.success('All records generated!')
        }
      }, 3000)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Generate all failed')
      setGeneratingAll(false)
    }
  }

  const pendingCount = batch ? batch.draft + batch.edited : 0

  if (loading) return <div className="loading"><div className="loading-spinner" /> Loading…</div>
  if (error)   return <div className="alert alert-error">{error}</div>
  if (!batch)  return null

  return (
    <>
      {/* Header */}
      <div className="page-header-row" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="flex gap-12" style={{ alignItems: 'center' }}>
          <Link to="/batches" className="btn btn-ghost btn-sm">← Batches</Link>
          <div>
            <h2 style={{ fontSize: 20, margin: 0 }}>{batch.filename}</h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
              {batch.template.split(/[\\/]/).pop()} · {batch.total} records ·{' '}
              {formatDate(batch.created_at)}
            </p>
          </div>
        </div>
        <div className="flex gap-8">
          <a
            href={api.exportBatchExcel(batchId)}
            className="btn btn-secondary"
            title="Export all records as Excel"
          >
            ↓ Export Excel
          </a>
          {pendingCount > 0 && (
            <button
              className="btn btn-primary"
              onClick={handleGenerateAll}
              disabled={generatingAll}
            >
              {generatingAll
                ? `Generating… (${batch.generated}/${batch.total})`
                : `Generate All (${pendingCount} pending)`}
            </button>
          )}
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex gap-12 mb-24" style={{ flexWrap: 'wrap' }}>
        {[
          { label: 'Total',     val: batch.total,     color: 'var(--surface-2)', text: 'var(--text)' },
          { label: 'Draft',     val: batch.draft,     color: '#f1f5f9',          text: '#64748b' },
          { label: 'Edited',    val: batch.edited,    color: '#eff6ff',          text: '#2563eb' },
          { label: 'Generated', val: batch.generated, color: '#f0fdf4',          text: '#16a34a' },
        ].map(({ label, val, color, text }) => (
          <div key={label} style={{
            background: color, borderRadius: 8, padding: '10px 20px',
            minWidth: 90, textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: text, lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Records table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>Row</th>
              <th>Preview</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 180 }}></th>
            </tr>
          </thead>
          <tbody>
            {records.map(rec => {
              const preview = Object.entries(rec.variables)
                .slice(0, 3)
                .map(([k, v]) => v ? `${k}: ${v}` : null)
                .filter(Boolean)
                .join(' · ')

              return (
                <tr key={rec.id}>
                  <td className="td-mono" style={{ color: 'var(--text-2)' }}>{rec.row_number}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    {preview || <em>—</em>}
                  </td>
                  <td><StatusBadge status={rec.status} /></td>
                  <td>
                    <div className="flex gap-6" style={{ justifyContent: 'flex-end' }}>
                      {/* Preview generated case inline */}
                      {rec.case_id && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={e => { e.stopPropagation(); setPreviewCaseId(rec.case_id!) }}
                        >
                          Preview
                        </button>
                      )}
                      {/* Edit */}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditingRecord(rec)}
                        disabled={generatingId === rec.id}
                      >
                        Edit
                      </button>
                      {/* Generate single */}
                      <button
                        className={`btn btn-sm ${rec.status === 'generated' ? 'btn-ghost' : 'btn-primary'}`}
                        onClick={() => handleGenerateSingle(rec)}
                        disabled={generatingId === rec.id || generatingAll}
                      >
                        {generatingId === rec.id
                          ? '…'
                          : rec.status === 'generated' ? 'Re-gen' : 'Generate'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editingRecord && (
        <EditModal
          record={editingRecord}
          banks={banks}
          onSave={handleSaveRecord}
          onClose={() => setEditingRecord(null)}
        />
      )}

      {/* Inline preview panel */}
      {previewCaseId !== null && (
        <PreviewPanel caseId={previewCaseId} onClose={() => setPreviewCaseId(null)} />
      )}
    </>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
