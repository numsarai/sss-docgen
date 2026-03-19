import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { api } from '../api'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export default function CasePreview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [numPages, setNumPages] = useState<number>(0)
  const [pageWidth, setPageWidth] = useState(794)

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) setPageWidth(Math.min(node.clientWidth - 40, 900))
  }, [])

  if (!id) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#525659' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', background: '#1e2a3a', color: '#fff', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(`/cases/${id}`)} style={{
            background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff',
            padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
          }}>← Case</button>
          <span style={{ fontSize: 14, opacity: 0.8 }}>
            Case #{id} — PDF Preview{numPages > 0 ? ` (${numPages} pages)` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={api.downloadPdf(Number(id))} download style={{
            background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff',
            padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
            textDecoration: 'none',
          }}>↓ Download PDF</a>
          <button onClick={() => navigate(`/cases/${id}/edit`)} style={{
            background: '#3b82f6', border: 'none', color: '#fff',
            padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
          }}>Edit Document</button>
        </div>
      </div>

      {/* PDF pages */}
      <div ref={containerRef} style={{
        flex: 1, overflowY: 'auto', display: 'flex',
        flexDirection: 'column', alignItems: 'center', padding: '24px 0', gap: 16,
      }}>
        <Document
          file={api.previewPdf(Number(id))}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={<div style={{ color: '#fff', marginTop: 40 }}>Loading PDF…</div>}
          error={<div style={{ color: '#fca5a5', marginTop: 40 }}>Failed to load PDF.</div>}
        >
          {Array.from({ length: numPages }, (_, i) => (
            <Page
              key={i + 1}
              pageNumber={i + 1}
              width={pageWidth}
              renderTextLayer
              renderAnnotationLayer
            />
          ))}
        </Document>
      </div>
    </div>
  )
}
