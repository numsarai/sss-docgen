const BASE = '/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CaseStatus = 'pending' | 'generating' | 'generated' | 'error'

export interface CaseResponse {
  id: number
  created_at: string
  updated_at: string
  template: string
  variables: Record<string, string | null>
  docx_path: string | null
  pdf_path: string | null
  status: CaseStatus
  error: string | null
}

export interface AnalyticsResponse {
  cases: {
    total: number
    pending: number
    generating: number
    generated: number
    error: number
  }
  templates: {
    total: number
  }
}

export interface CaseList {
  total: number
  skip: number
  limit: number
  items: CaseResponse[]
}

export interface ExtractResponse {
  variables: Record<string, any>
  raw_text: string
  fields_found: number
  fields_total: number
  provider: string
}

export interface TemplateFields {
  fields: string[]
}

export interface TemplateResponse {
  id: number
  created_at: string
  updated_at: string
  name: string
  description: string | null
  path: string
  fields: string[]
  fields_count: number
}

export interface TemplateList {
  total: number
  skip: number
  limit: number
  items: TemplateResponse[]
}

export interface BankInfo {
  code: string
  name: string
  name_en: string
}

export interface BatchRecord {
  id: number
  batch_id: number
  row_number: number
  variables: Record<string, string>
  status: 'draft' | 'edited' | 'generated'
  case_id: number | null
  created_at: string
  updated_at: string
}

export interface BatchSummary {
  id: number
  created_at: string
  filename: string
  template: string
  total: number
  draft: number
  edited: number
  generated: number
}

export interface BatchListResponse {
  total: number
  items: BatchSummary[]
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = isForm
    ? (init?.headers as Record<string, string> ?? {})
    : { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string> ?? {}) }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
  })
  
  if (res.status === 401) {
    localStorage.removeItem('token')
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? res.statusText)
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const api = {
  login: (password: string) => {
    const form = new URLSearchParams()
    form.append('username', 'admin') // Required by OAuth2 form
    form.append('password', password)
    return request<{ access_token: string }>('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
  },

  getCases: (skip = 0, limit = 50, search?: string, status?: string) => {
    const params = new URLSearchParams()
    params.set('skip', String(skip))
    params.set('limit', String(limit))
    if (search) params.set('search', search)
    if (status) params.set('status', status)
    return request<CaseList>(`/cases?${params.toString()}`)
  },

  getCase: (id: number) =>
    request<CaseResponse>(`/cases/${id}`),

  createCase: (template: string, variables: Record<string, string>) =>
    request<CaseResponse>('/cases', {
      method: 'POST',
      body: JSON.stringify({ template, variables }),
    }),

  generate: (template: string, variables: Record<string, string>) =>
    request<CaseResponse>('/generate', {
      method: 'POST',
      body: JSON.stringify({ template, variables }),
    }),

  getTemplateFields: (path: string) =>
    request<TemplateFields>(`/templates/fields?path=${encodeURIComponent(path)}`),

  extract: (pdf_path: string, template: string) =>
    request<ExtractResponse>('/extract', {
      method: 'POST',
      body: JSON.stringify({ pdf_path, template }),
    }),

  extractUpload: (template: string, file: File, provider = 'claude') => {
    const form = new FormData()
    form.append('template', template)
    form.append('file', file)
    form.append('provider', provider)
    return request<ExtractResponse>('/extract/upload', { method: 'POST', body: form })
  },

  downloadDocx: (id: number) => {
    const t = localStorage.getItem('token')
    return `${BASE}/cases/${id}/download/docx${t ? `?token=${t}` : ''}`
  },
  downloadPdf: (id: number) => {
    const t = localStorage.getItem('token')
    return `${BASE}/cases/${id}/download/pdf${t ? `?token=${t}` : ''}`
  },
  previewPdf: (id: number) => {
    const t = localStorage.getItem('token')
    return `${BASE}/cases/${id}/preview/pdf${t ? `?token=${t}` : ''}`
  },

  // Templates
  getTemplates: (skip = 0, limit = 50) =>
    request<TemplateList>(`/templates?skip=${skip}&limit=${limit}`),

  getTemplateById: (id: number) =>
    request<TemplateResponse>(`/templates/${id}`),

  createTemplate: (name: string, description: string, file: File) => {
    const form = new FormData()
    form.append('name', name)
    form.append('description', description)
    form.append('file', file)
    return request<TemplateResponse>('/templates', { method: 'POST', body: form })
  },

  updateTemplate: (id: number, name: string, description: string, file?: File) => {
    const form = new FormData()
    form.append('name', name)
    form.append('description', description)
    if (file) form.append('file', file)
    return request<TemplateResponse>(`/templates/${id}`, { method: 'PUT', body: form })
  },

  deleteTemplate(id: number) {
    return request(`/templates/${id}`, { method: 'DELETE' })
  },
  downloadTemplate(id: number) {
    const token = localStorage.getItem('token') || ''
    return `${BASE}/templates/${id}/download?token=${token}`
  },
  downloadTemplateExcel(id: number) {
    const token = localStorage.getItem('token') || ''
    return `${BASE}/templates/${id}/excel-template?token=${token}`
  },
  
  // Analytics
  getAnalytics(): Promise<AnalyticsResponse> {
    return request('/analytics')
  },

  // Batch Download
  async batchDownloadCases(caseIds: number[]) {
    const res = await fetch(`${BASE}/cases/batch-download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      },
      body: JSON.stringify({ case_ids: caseIds })
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(text || res.statusText)
    }
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'batch_cases.zip'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  },

  deleteCase: (id: number) =>
    request<void>(`/cases/${id}`, { method: 'DELETE' }),

  // Banks
  getBanks: () =>
    request<BankInfo[]>('/banks'),

  // Batches
  getBatches: () =>
    request<BatchListResponse>('/batches'),

  getBatch: (id: number) =>
    request<BatchSummary>(`/batches/${id}`),

  uploadBatch: (template: string, file: File) => {
    const form = new FormData()
    form.append('template', template)
    form.append('file', file)
    return request<BatchSummary>('/batches/upload', { method: 'POST', body: form })
  },

  getBatchRecords: (batchId: number) =>
    request<BatchRecord[]>(`/batches/${batchId}/records`),

  updateBatchRecord: (batchId: number, recordId: number, variables: Record<string, string>) =>
    request<BatchRecord>(`/batches/${batchId}/records/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify({ variables }),
    }),

  generateBatchRecord: (batchId: number, recordId: number) =>
    request<BatchRecord>(`/batches/${batchId}/records/${recordId}/generate`, { method: 'POST' }),

  generateAllBatchRecords: (batchId: number) =>
    request<{ queued: number; message: string }>(`/batches/${batchId}/generate-all`, { method: 'POST' }),

  deleteBatch: (id: number) =>
    request<void>(`/batches/${id}`, { method: 'DELETE' }),

  discardBatchRecord: (batchId: number, recordId: number) =>
    request<BatchRecord>(`/batches/${batchId}/records/${recordId}/discard`, { method: 'POST' }),

  exportBatchExcel(id: number) {
    const token = localStorage.getItem('token') || ''
    return `${BASE}/batches/${id}/export-excel?token=${token}`
  },
}
