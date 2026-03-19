import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api, type AnalyticsResponse } from '../api'

function StatCard({ title, value, colorClass }: { title: string; value: number | string; colorClass?: string }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 200 }}>
      <div className="card-body" style={{ padding: '24px' }}>
        <div style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500, marginBottom: 8 }}>{title}</div>
        <div className={`text-4xl font-bold ${colorClass || ''}`} style={{ fontSize: 48, lineHeight: 1 }}>
          {value}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getAnalytics()
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading"><div className="loading-spinner" /> Loading dashboard...</div>
  if (error) return <div className="alert alert-error">{error}</div>
  if (!data) return null

  const c = data.cases

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header-row mb-24">
        <div>
          <h2 style={{ fontSize: 28, marginBottom: 4 }}>System Analytics</h2>
          <p className="text-2">Overview of Saraithong Document Automation System</p>
        </div>
        <div className="flex gap-8">
          <Link to="/extract" className="btn btn-secondary">AI Extract</Link>
          <Link to="/generate" className="btn btn-primary">+ New Document</Link>
        </div>
      </div>

      <h3 style={{ marginBottom: 16 }}>Documents Generated</h3>
      <div className="flex gap-16 mb-32" style={{ flexWrap: 'wrap' }}>
        <StatCard title="Total Cases" value={c.total} />
        <StatCard title="Successfully Generated" value={c.generated} colorClass="text-success" />
        <StatCard title="Pending / Generating" value={c.pending + c.generating} colorClass="text-warning" />
        <StatCard title="Errors" value={c.error} colorClass="text-danger" />
      </div>

      <h3 style={{ marginBottom: 16 }}>Resources</h3>
      <div className="flex gap-16 mb-32" style={{ flexWrap: 'wrap' }}>
        <StatCard title="Active Templates" value={data.templates.total} />
      </div>

      <div className="card mb-32">
        <div className="card-header">
          <h3 style={{ margin: 0 }}>Quick Actions</h3>
        </div>
        <div className="card-body flex gap-16" style={{ padding: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 250, background: 'var(--surface-2)', padding: 20, borderRadius: 8 }}>
            <h4 style={{ marginBottom: 8 }}>Review Cases</h4>
            <p className="text-2" style={{ marginBottom: 16, fontSize: 13 }}>View and manage generated documents, or batch download them.</p>
            <Link to="/cases" className="btn btn-secondary btn-sm">Go to Cases</Link>
          </div>
          <div style={{ flex: 1, minWidth: 250, background: 'var(--surface-2)', padding: 20, borderRadius: 8 }}>
            <h4 style={{ marginBottom: 8 }}>Manage Templates</h4>
            <p className="text-2" style={{ marginBottom: 16, fontSize: 13 }}>Upload new DOCX templates or edit existing ones via OnlyOffice.</p>
            <Link to="/templates" className="btn btn-secondary btn-sm">Go to Templates</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
