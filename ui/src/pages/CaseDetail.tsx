import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api, type CaseResponse } from '../api'
import StatusBadge from '../components/StatusBadge'

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="detail-field">
      <label>{label}</label>
      <div>{children}</div>
    </div>
  )
}

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [c, setC]           = useState<CaseResponse | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    api.getCase(Number(id))
      .then(setC)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load case'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="loading"><div className="loading-spinner" />Loading…</div>
  )
  if (error) return <div className="alert alert-error">{error}</div>
  if (!c) return null

  const vars = Object.entries(c.variables)

  return (
    <>
      <div className="page-header-row">
        <div className="flex gap-12" style={{ alignItems: 'center' }}>
          <Link to="/cases" className="btn btn-ghost btn-sm">← Cases</Link>
          <h2 style={{ fontSize: 20 }}>Case #{c.id}</h2>
          <StatusBadge status={c.status} />
        </div>
        <div className="flex gap-8">
          {c.pdf_path && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate(`/cases/${c.id}/preview`)}
            >
              Preview
            </button>
          )}
          {c.docx_path && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/cases/${c.id}/edit`)}
            >
              Edit Document
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/generate', { state: { template: c.template, variables: c.variables } })}
          >
            Re-Generate
          </button>
          {c.docx_path && (
            <a href={api.downloadDocx(c.id)} className="btn btn-secondary btn-sm" download>
              ↓ DOCX
            </a>
          )}
          {c.pdf_path && (
            <a href={api.downloadPdf(c.id)} className="btn btn-secondary btn-sm" download>
              ↓ PDF
            </a>
          )}
        </div>
      </div>

      {c.error && (
        <div className="alert alert-error" style={{ marginBottom: 24 }}>
          <strong>Error:</strong> {c.error}
        </div>
      )}

      {/* Metadata */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h3>Details</h3></div>
        <div className="card-body">
          <div className="detail-grid">
            <DetailField label="Template">
              <span className="font-mono">{c.template}</span>
            </DetailField>
            <DetailField label="Status">
              <StatusBadge status={c.status} />
            </DetailField>
            <DetailField label="Created">
              <span>{formatDate(c.created_at)}</span>
            </DetailField>
            <DetailField label="Updated">
              <span>{formatDate(c.updated_at)}</span>
            </DetailField>
            {c.docx_path && (
              <DetailField label="DOCX Path">
                <span className="font-mono text-2">{c.docx_path}</span>
              </DetailField>
            )}
            {c.pdf_path && (
              <DetailField label="PDF Path">
                <span className="font-mono text-2">{c.pdf_path}</span>
              </DetailField>
            )}
          </div>
        </div>
      </div>

      {/* Variables */}
      <div className="card">
        <div className="card-header">
          <h3>Variables</h3>
          <span className="text-2" style={{ fontSize: 13 }}>{vars.length} fields</span>
        </div>
        {vars.length === 0 ? (
          <div className="card-body text-2">No variables.</div>
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Field</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {vars.map(([k, v]) => (
                  <tr key={k}>
                    <td className="td-mono">{k}</td>
                    <td style={{ color: v == null ? 'var(--text-2)' : undefined }}>
                      {v == null ? <em>null</em> : String(v)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
