import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api, type ExtractResponse, type CaseResponse, type TemplateResponse } from '../api'

type Step = 'input' | 'review' | 'done'

const AI_PROVIDERS = [
  { value: 'claude', label: '🟠 Claude (Anthropic)', model: 'claude-opus-4-6' },
  { value: 'openai', label: '🟢 GPT-4o (OpenAI)',   model: 'gpt-4o' },
  { value: 'gemini', label: '🔵 Gemini 1.5 Flash (Google)', model: 'gemini-1.5-flash' },
]

function StepIndicator({ step }: { step: Step }) {
  const steps = [
    { id: 'input',  label: 'Upload PDF' },
    { id: 'review', label: 'Review Fields' },
    { id: 'done',   label: 'Generate' },
  ]
  const order = { input: 0, review: 1, done: 2 }

  return (
    <div className="steps">
      {steps.map((s, i) => {
        const cur  = order[step]
        const pos  = i
        const done = cur > pos
        const active = cur === pos
        return (
          <div key={s.id} className={`step${done ? ' done' : active ? ' active' : ''}`}>
            <div className="step-circle">{done ? '✓' : i + 1}</div>
            <span className="step-label">{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function Spinner({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0', color: 'var(--text-2)' }}>
      <div className="loading-spinner" style={{ width: 24, height: 24, flexShrink: 0 }} />
      <span style={{ fontSize: 15 }}>{label}</span>
    </div>
  )
}

export default function AIExtract() {
  const [step, setStep] = useState<Step>('input')
  const navigate = useNavigate()

  // Saved templates
  const [templates, setTemplates] = useState<TemplateResponse[]>([])
  useEffect(() => {
    api.getTemplates(0, 200).then(d => setTemplates(d.items)).catch(() => {})
  }, [])

  // Step 1 state
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([])
  const [file, setFile]             = useState<File | null>(null)
  const [provider, setProvider]     = useState('claude')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)

  // Step 2 state
  const [extracted, setExtracted]   = useState<ExtractResponse | null>(null)
  const [editedVars, setEditedVars] = useState<Record<string, {value: string, confidence?: number}>>({})
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError]     = useState<string | null>(null)

  // Step 3 state
  const [result, setResult] = useState<CaseResponse | null>(null)

  // ── Step 1 → extract ──────────────────────────────────────────────────────

  async function handleExtract() {
    if (selectedTemplates.length === 0) { setExtractError('Please select at least one template.'); return }
    if (!file) { setExtractError('Please select a PDF file.'); return }
    setExtractError(null)
    setExtracting(true)
    try {
      let totalFound = 0
      let totalTotal = 0
      const init: Record<string, { value: string, confidence?: number }> = {}
      let rawText = ''

      for (const t of selectedTemplates) {
        const res = await api.extractUpload(t, file, provider)
        totalFound += res.fields_found
        totalTotal += res.fields_total
        if (!rawText) rawText = res.raw_text

        for (const [k, rawV] of Object.entries(res.variables)) {
          let v: string | null = null
          let conf: number | undefined = undefined
          
          if (rawV && typeof rawV === 'object' && 'value' in rawV) {
            v = rawV.value
            conf = rawV.confidence
          } else {
            v = rawV as (string | null)
          }

          if (init[k] && !v) continue // keep previous valid value
          init[k] = { value: v ?? '', confidence: conf }
        }
      }

      setExtracted({
        variables: init,
        raw_text: rawText,
        fields_found: totalFound,
        fields_total: totalTotal,
        provider,
      })
      setEditedVars(init)
      setStep('review')
    } catch (e: unknown) {
      setExtractError(e instanceof Error ? e.message : 'Extraction failed')
    } finally {
      setExtracting(false)
    }
  }

  // ── Step 2 → generate ─────────────────────────────────────────────────────

  async function handleGenerate() {
    setGenError(null)
    setGenerating(true)
    try {
      const caseIds: number[] = []
      
      // Batch generate all selected templates
      for (const t of selectedTemplates) {
        const flatVars: Record<string, string> = {}
        for (const [k, obj] of Object.entries(editedVars)) {
          flatVars[k] = obj.value
        }
        const res = await api.generate(t, flatVars)
        caseIds.push(res.id)
      }

      // Poll all generated cases
      for (const id of caseIds) {
        let finalStatus = 'generating'
        let currentRes = null
        while (finalStatus === 'generating') {
          await new Promise(r => setTimeout(r, 2000))
          currentRes = await api.getCase(id)
          finalStatus = currentRes.status
          if (finalStatus === 'error') throw new Error(currentRes.error || `Generation failed for case ${id}`)
        }
        if (currentRes) setResult(currentRes) // Shows the last generated result if multiple
      }
      
      if (caseIds.length > 1) {
        toast.success(`${caseIds.length} cases generated successfully! Redirecting...`)
        setTimeout(() => navigate('/cases'), 1500)
        return
      }
      
      setStep('done')
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  function reset() {
    setStep('input')
    setSelectedTemplates([])
    setFile(null)
    setExtracted(null)
    setEditedVars({})
    setResult(null)
    setExtractError(null)
    setGenError(null)
  }

  const selectedProvider = AI_PROVIDERS.find(p => p.value === provider)!

  return (
    <>
      <div className="page-header">
        <h2>AI Extract</h2>
        <p>Upload a source PDF — AI extracts field values, you review, then generate.</p>
      </div>

      <StepIndicator step={step} />

      {/* ── Step 1: Input ─────────────────────────────────────────────────── */}
      {step === 'input' && (
        <div className="card">
          <div className="card-header"><h3>Upload Source PDF</h3></div>
          <div className="card-body">
            {extractError && (
              <div className="alert alert-error">{extractError}</div>
            )}

            {/* AI Provider Selector */}
            <div className="form-group">
              <label>AI Provider <small>choose which model extracts your fields</small></label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {AI_PROVIDERS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    className={`btn btn-sm ${provider === p.value ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setProvider(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="form-hint">
                Using <strong>{selectedProvider.label}</strong> ({selectedProvider.model}).
                {provider !== 'claude' && (
                  <> Make sure <code>{provider === 'openai' ? 'OPENAI_API_KEY' : 'GOOGLE_API_KEY'}</code> is set on the server.</>
                )}
              </p>
            </div>

            {templates.length > 0 && (
              <div className="form-group">
                <label>Pick saved templates <small>you can select multiple for batch extraction</small></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {templates.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      className={`btn btn-sm ${selectedTemplates.includes(t.path) ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => {
                        setSelectedTemplates(prev => 
                          prev.includes(t.path) ? prev.filter(x => x !== t.path) : [...prev, t.path]
                        )
                      }}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Template path(s) <small>absolute path to .docx (comma separated)</small></label>
              <input
                type="text"
                value={selectedTemplates.join(', ')}
                onChange={e => setSelectedTemplates(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="/path/to/template.docx"
              />
              <p className="form-hint">Defines which {'{{fields}}'} to extract.</p>
            </div>

            <div className="form-group">
              <label>Source PDF</label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="form-hint">
                The document {selectedProvider.label} will read to fill template fields.
              </p>
            </div>

            {extracting ? (
              <Spinner label={`Extracting with ${selectedProvider.label}… this may take a few seconds`} />
            ) : (
              <button
                className="btn btn-primary btn-lg"
                onClick={handleExtract}
                style={{ marginTop: 4 }}
              >
                Extract Fields
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Step 2: Review extracted fields ───────────────────────────────── */}
      {step === 'review' && extracted && (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          
          {/* Left Column: PDF Preview */}
          <div style={{ flex: 1, position: 'sticky', top: 20 }}>
            <div className="card">
              <div className="card-header"><h3>Source PDF</h3></div>
              <div className="card-body" style={{ padding: 0 }}>
                {file ? (
                  <iframe 
                    src={URL.createObjectURL(file)} 
                    width="100%" 
                    height="600" 
                    style={{ border: 'none', display: 'block' }}
                    title="PDF Preview"
                  />
                ) : (
                  <div style={{ padding: 20 }}>No PDF available for preview.</div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Fields Review */}
          <div style={{ flex: 1 }}>
            <div className="alert alert-info" style={{ marginBottom: 20 }}>
              Found <strong>{extracted.fields_found}</strong> of{' '}
              <strong>{extracted.fields_total}</strong> fields
              {' '}using <strong>{AI_PROVIDERS.find(p => p.value === extracted.provider)?.label ?? extracted.provider}</strong>.
              Review and edit before generating.
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <h3>Extracted Fields</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setStep('input')}>
                  ← Back
                </button>
              </div>
              <div className="card-body">
                {genError && <div className="alert alert-error">{genError}</div>}

                {Object.entries(editedVars).map(([k, vObj]) => {
                  const conf = vObj.confidence
                  const isLowConf = conf !== undefined && conf < 80
                  const rawVar = extracted.variables[k]
                  const isNull = rawVar === null || (typeof rawVar === 'object' && rawVar?.value === null)

                  return (
                  <div className="form-group" key={k}>
                    <label>
                      {k}
                      {conf !== undefined && (
                        <span style={{ 
                          marginLeft: 8, 
                          fontSize: 11, 
                          padding: '2px 6px', 
                          borderRadius: 4, 
                          background: isLowConf ? 'var(--warning-light)' : 'var(--success-light)', 
                          color: isLowConf ? 'var(--warning)' : 'var(--success)' 
                        }}>
                          {conf}% confidence
                        </span>
                      )}
                      {isNull && (
                        <small style={{ color: 'var(--warning)', marginLeft: 6 }}>not found</small>
                      )}
                    </label>
                    <input
                      type="text"
                      className={isLowConf ? 'low-conf-input' : ''}
                      style={isLowConf ? { borderLeft: '3px solid var(--warning)' } : {}}
                      value={vObj.value}
                      onChange={e => setEditedVars(prev => ({ 
                        ...prev, 
                        [k]: { ...prev[k], value: e.target.value } 
                      }))}
                      placeholder="(empty)"
                    />
                  </div>
                )})}
              </div>
            </div>

            {generating ? (
              <Spinner label="Generating DOCX + PDF via LibreOffice…" />
            ) : (
              <div className="flex gap-8">
                <button className="btn btn-primary btn-lg" onClick={handleGenerate}>
                  Generate Document
                </button>
                <button className="btn btn-secondary btn-lg" onClick={() => setStep('input')}>
                  Back
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 3: Done ──────────────────────────────────────────────────── */}
      {step === 'done' && result && (
        <div className="card">
          <div className="card-header"><h3>Document Ready</h3></div>
          <div className="card-body">
            <div className="alert alert-success" style={{ marginBottom: 20 }}>
              Case #{result.id} generated successfully.
            </div>
            <div className="flex gap-8">
              <Link to={`/cases/${result.id}`} className="btn btn-primary">
                View Case →
              </Link>
              {result.docx_path && (
                <a href={api.downloadDocx(result.id)} className="btn btn-secondary" download>
                  ↓ DOCX
                </a>
              )}
              {result.pdf_path && (
                <a href={api.downloadPdf(result.id)} className="btn btn-secondary" download>
                  ↓ PDF
                </a>
              )}
              <button className="btn btn-ghost" onClick={reset}>
                Extract Another
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
