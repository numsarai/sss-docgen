/**
 * BatchDetail — review, edit, generate, and confirm batch records.
 *
 * Workflow:
 *   Upload Excel → records created (draft)
 *   Edit any row → status becomes "edited"
 *   Generate single / Generate All → previews ready (status = "generated")
 *   Click row → PDF shown on the right panel
 *   ✓ Save as Case → case is officially kept
 *   ✕ Discard → deletes preview, resets row to draft for a fresh attempt
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api, type BatchRecord, type BatchSummary, type BankInfo } from '../api'

const BANK_CODE_FIELDS = new Set(['รหัสธนาคาร', 'BANK_ID'])
const STATUS_COLOR: Record<string, string> = {
  draft:     '#64748b',
  edited:    '#d97706',
  generated: '#2563eb',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 12,
      fontSize: 11, fontWeight: 700, color: '#fff',
      background: STATUS_COLOR[status] ?? '#64748b',
    }}>
      {status === 'generated' ? 'preview' : status}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function EditModal({ record, banks, onSave, onClose }: {
  record: BatchRecord; banks: BankInfo[]
  onSave: (v: Record<string, string>) => Promise<void>; onClose: () => void
}) {
  const [vars, setVars] = useState<Record<string, string>>({ ...record.variables })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try { await onSave(vars); onClose() } finally { setSaving(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 760,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
      }}>
        <div style={{
          padding: '20px 24px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h3 style={{ margin: 0 }}>Edit Row #{record.row_number}</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
              {Object.keys(vars).length} fields · <StatusBadge status={record.status} />
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text-2)' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '16px 24px', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
            {Object.keys(vars).map(key => (
              <div key={key} className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: 12, fontWeight: 600 }}>{key}</label>
                {BANK_CODE_FIELDS.has(key) && banks.length > 0 ? (
                  <select value={vars[key]} onChange={e => setVars(p => ({ ...p, [key]: e.target.value }))} style={{ width: '100%' }}>
                    <option value="">— เลือกธนาคาร —</option>
                    {banks.map(b => <option key={b.code} value={b.code}>{b.code} — {b.name}</option>)}
                  </select>
                ) : (
                  <input type="text" value={vars[key]} onChange={e => setVars(p => ({ ...p, [key]: e.target.value }))} placeholder={key} />
                )}
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

function PreviewPanel({ record, onClose, onConfirm, onDiscard, onEdit, onRegenerate, confirming, discarding, regenerating }: {
  record: BatchRecord; onClose: () => void; onConfirm: () => void; onDiscard: () => void
  onEdit: () => void; onRegenerate: () => void
  confirming: boolean; discarding: boolean; regenerating: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)', background: 'var(--surface)', minWidth: 0, flex: 1 }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Row #{record.row_number}</span>
          <StatusBadge status={record.status} />
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-2)' }}>×</button>
      </div>

      <div style={{
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0, background: 'var(--surface-2)',
      }}>
        <button className="btn btn-secondary btn-sm" onClick={onEdit}>✎ Edit</button>
        {record.status === 'generated' && (
          <button className="btn btn-ghost btn-sm" onClick={onRegenerate} disabled={regenerating}>
            {regenerating ? '…' : '↺ Re-gen'}
          </button>
        )}
        {record.case_id && (
          <>
            <a href={api.downloadDocx(record.case_id)} className="btn btn-ghost btn-sm">↓ DOCX</a>
            <a href={api.downloadPdf(record.case_id)} className="btn btn-ghost btn-sm">↓ PDF</a>
            <Link to={`/cases/${record.case_id}`} className="btn btn-ghost btn-sm" target="_blank">Open Case ↗</Link>
          </>
        )}
        {record.status === 'generated' && (
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button onClick={onDiscard} disabled={discarding} style={{
              padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: 'none', border: '1.5px solid var(--error)', color: 'var(--error)', cursor: 'pointer',
            }}>{discarding ? 'Discarding…' : '✕ Discard'}</button>
            <button className="btn btn-primary btn-sm" onClick={onConfirm} disabled={confirming}>
              {confirming ? 'Saving…' : '✓ Save as Case'}
            </button>
          </div>
        )}
      </div>

      {record.case_id ? (
        <iframe key={record.case_id} src={api.previewPdf(record.case_id)}
          style={{ flex: 1, border: 'none', width: '100%', minHeight: 0 }} title="Preview" />
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', gap: 12 }}>
          <div style={{ fontSize: 40, opacity: 0.25 }}>📄</div>
          <p style={{ margin: 0, fontSize: 14 }}>Generate this row to see the preview</p>
        </div>
      )}
    </div>
  )
}

export default function BatchDetail() {
  const { id } = useParams<{ id: string }>()
  const batchId = Number(id)

  const [batch,     setBatch]     = useState<BatchSummary | null>(null)
  const [records,   setRecords]   = useState<BatchRecord[]>([])
  const [banks,     setBanks]     = useState<BankInfo[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [selectedId,    setSelectedId]    = useState<number | null>(null)
  const [editingRecord, setEditingRecord] = useState<BatchRecord | null>(null)
  const [generatingId,  setGeneratingId]  = useState<number | null>(null)
  const [confirmingId,  setConfirmingId]  = useState<number | null>(null)
  const [discardingId,  setDiscardingId]  = useState<number | null>(null)
  const [generatingAll, setGeneratingAll] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const selectedRecord = records.find(r => r.id === selectedId) ?? null

  const loadAll = useCallback(async () => {
    try {
      const [b, recs] = await Promise.all([api.getBatch(batchId), api.getBatchRecords(batchId)])
      setBatch(b); setRecords(recs)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [batchId])

  useEffect(() => { loadAll(); api.getBanks().then(setBanks).catch(() => {}) }, [loadAll])
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  async function handleSaveRecord(vars: Record<string, string>) {
    if (!editingRecord) return
    const updated = await api.updateBatchRecord(batchId, editingRecord.id, vars)
    toast.success(`Row #${updated.row_number} saved`)
    setRecords(prev => prev.map(r => r.id === updated.id ? updated : r))
    await loadAll()
  }

  async function handleGenerate(rec: BatchRecord) {
    setGeneratingId(rec.id)
    try {
      const updated = await api.generateBatchRecord(batchId, rec.id)
      toast.success(`Row #${rec.row_number} — preview ready`)
      setRecords(prev => prev.map(r => r.id === updated.id ? updated : r))
      setSelectedId(updated.id)
      await loadAll()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Generation failed')
    } finally { setGeneratingId(null) }
  }

  async function handleGenerateAll() {
    setGeneratingAll(true)
    try {
      const res = await api.generateAllBatchRecords(batchId)
      toast.success(res.message)
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        const [b, recs] = await Promise.all([api.getBatch(batchId), api.getBatchRecords(batchId)])
        setBatch(b); setRecords(recs)
        if (b.draft === 0 && b.edited === 0) {
          clearInterval(pollRef.current!); pollRef.current = null
          setGeneratingAll(false)
          toast.success('All previews ready — review and save each one.')
        }
      }, 3000)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Generate all failed')
      setGeneratingAll(false)
    }
  }

  async function handleConfirm(rec: BatchRecord) {
    setConfirmingId(rec.id)
    try {
      toast.success(`Row #${rec.row_number} saved as Case #${rec.case_id}`)
      const idx = records.findIndex(r => r.id === rec.id)
      const next = records.slice(idx + 1).find(r => r.status === 'generated')
      setSelectedId(next?.id ?? null)
    } finally { setConfirmingId(null) }
  }

  async function handleDiscard(rec: BatchRecord) {
    setDiscardingId(rec.id)
    try {
      const updated = await api.discardBatchRecord(batchId, rec.id)
      toast.success(`Row #${rec.row_number} discarded`)
      setRecords(prev => prev.map(r => r.id === updated.id ? updated : r))
      if (selectedId === rec.id) setSelectedId(null)
      await loadAll()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Discard failed')
    } finally { setDiscardingId(null) }
  }

  const pendingCount   = batch ? batch.draft + batch.edited : 0
  const generatedCount = batch?.generated ?? 0
  const showPanel      = selectedRecord !== null

  if (loading) return <div className="loading"><div className="loading-spinner" />Loading…</div>
  if (error)   return <div className="alert alert-error">{error}</div>
  if (!batch)  return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div className="page-header-row" style={{ flexWrap: 'wrap', gap: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/batches" className="btn btn-ghost btn-sm">← Batches</Link>
          <div>
            <h2 style={{ fontSize: 20, margin: 0 }}>{batch.filename}</h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-2)' }}>
              {batch.template.split(/[\\/]/).pop()} · {batch.total} records · {formatDate(batch.created_at)}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href={api.exportBatchExcel(batchId)} className="btn btn-secondary btn-sm">↓ Export Excel</a>
          {pendingCount > 0 && (
            <button className="btn btn-primary" onClick={handleGenerateAll} disabled={generatingAll}>
              {generatingAll ? `Generating… (${generatedCount}/${batch.total})` : `⚡ Generate All (${pendingCount} pending)`}
            </button>
          )}
        </div>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, flexShrink: 0 }}>
        {[
          { label: 'Total',   val: batch.total,    bg: 'var(--surface-2)', fg: 'var(--text)' },
          { label: 'Draft',   val: batch.draft,    bg: '#f1f5f9',          fg: '#64748b' },
          { label: 'Edited',  val: batch.edited,   bg: '#fffbeb',          fg: '#d97706' },
          { label: 'Preview', val: generatedCount, bg: '#eff6ff',          fg: '#2563eb' },
        ].map(({ label, val, bg, fg }) => (
          <div key={label} style={{ background: bg, borderRadius: 8, padding: '8px 18px', minWidth: 80, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: fg, lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
        {generatingAll && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)', padding: '8px 14px' }}>
            <div className="loading-spinner" style={{ width: 16, height: 16 }} />Generating previews…
          </div>
        )}
      </div>

      {/* Hint */}
      {generatedCount > 0 && pendingCount === 0 && !generatingAll && (
        <div style={{
          background: 'var(--surface-2)', borderRadius: 8, padding: '10px 16px',
          fontSize: 13, color: 'var(--text-2)', marginBottom: 12, flexShrink: 0,
          border: '1px solid var(--border)',
        }}>
          <strong style={{ color: 'var(--text)' }}>All previews ready.</strong>{' '}
          Click a row to review → <strong>✓ Save as Case</strong> to keep it, <strong>✕ Discard</strong> to regenerate after editing.
        </div>
      )}

      {/* Split layout */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Table */}
        <div style={{
          width: showPanel ? 420 : '100%', flexShrink: 0, overflowY: 'auto',
          transition: 'width 0.2s ease',
          borderRight: showPanel ? '1px solid var(--border)' : 'none',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ width: 42, padding: '9px 12px', textAlign: 'center', fontSize: 12 }}>#</th>
                <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 12 }}>Data</th>
                <th style={{ width: 86, padding: '9px 12px', textAlign: 'center', fontSize: 12 }}>Status</th>
                <th style={{ padding: '9px 12px', fontSize: 12 }}></th>
              </tr>
            </thead>
            <tbody>
              {records.map(rec => {
                const isSelected = rec.id === selectedId
                const preview = Object.values(rec.variables).filter(Boolean).slice(0, 3).join(' · ')
                return (
                  <tr key={rec.id} onClick={() => setSelectedId(isSelected ? null : rec.id)} style={{
                    cursor: 'pointer',
                    background: isSelected ? '#eff6ff' : undefined,
                    borderBottom: '1px solid var(--border)',
                    borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                  }}>
                    <td style={{ textAlign: 'center', fontSize: 13, padding: '10px 12px', color: 'var(--text-2)' }}>{rec.row_number}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, maxWidth: 160 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: preview ? 'var(--text)' : 'var(--text-2)' }}>
                        {preview || '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                      <StatusBadge status={rec.status} />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={() => setEditingRecord(rec)} disabled={generatingId === rec.id}>Edit</button>
                        <button
                          className={`btn btn-sm ${rec.status === 'generated' ? 'btn-ghost' : 'btn-primary'}`}
                          style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={() => handleGenerate(rec)} disabled={generatingId === rec.id || generatingAll}
                        >
                          {generatingId === rec.id
                            ? <span className="loading-spinner" style={{ width: 12, height: 12, display: 'inline-block' }} />
                            : rec.status === 'generated' ? '↺' : '▶ Gen'}
                        </button>
                        {!showPanel && rec.status === 'generated' && (
                          <>
                            <button style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'none', border: '1px solid var(--error)', color: 'var(--error)', cursor: 'pointer' }}
                              onClick={() => handleDiscard(rec)} disabled={discardingId === rec.id}>
                              {discardingId === rec.id ? '…' : '✕'}
                            </button>
                            <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: '4px 10px' }}
                              onClick={() => handleConfirm(rec)} disabled={confirmingId === rec.id}>
                              {confirmingId === rec.id ? '…' : '✓ Save'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Preview panel */}
        {showPanel && selectedRecord && (
          <PreviewPanel
            record={selectedRecord}
            onClose={() => setSelectedId(null)}
            onConfirm={() => handleConfirm(selectedRecord)}
            onDiscard={() => handleDiscard(selectedRecord)}
            onEdit={() => setEditingRecord(selectedRecord)}
            onRegenerate={() => handleGenerate(selectedRecord)}
            confirming={confirmingId === selectedRecord.id}
            discarding={discardingId === selectedRecord.id}
            regenerating={generatingId === selectedRecord.id}
          />
        )}
      </div>

      {editingRecord && (
        <EditModal record={editingRecord} banks={banks} onSave={handleSaveRecord} onClose={() => setEditingRecord(null)} />
      )}
    </div>
  )
}
