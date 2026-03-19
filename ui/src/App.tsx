import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import CaseList from './pages/CaseList'
import CaseDetail from './pages/CaseDetail'
import GeneratePage from './pages/GeneratePage'
import AIExtract from './pages/AIExtract'
import TemplateList from './pages/TemplateList'
import TemplateForm from './pages/TemplateForm'
import DocumentEditor from './pages/DocumentEditor'
import CasePreview from './pages/CasePreview'
import BatchList from './pages/BatchList'
import BatchDetail from './pages/BatchDetail'
import Login from './pages/Login'
import { Toaster } from 'sonner'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!localStorage.getItem('token')) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Full-screen pages — no sidebar layout */}
        <Route path="/cases/:id/preview" element={
          <ProtectedRoute><CasePreview /></ProtectedRoute>
        } />
        <Route path="/cases/:id/edit" element={
          <ProtectedRoute><DocumentEditor type="case" /></ProtectedRoute>
        } />
        <Route path="/templates/:id/edit-file" element={
          <ProtectedRoute><DocumentEditor type="template" /></ProtectedRoute>
        } />

        {/* All other pages inside the sidebar layout */}
        <Route path="*" element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/cases" element={<CaseList />} />
                <Route path="/cases/:id" element={<CaseDetail />} />
                <Route path="/generate" element={<GeneratePage />} />
                <Route path="/extract" element={<AIExtract />} />
                <Route path="/templates" element={<TemplateList />} />
                <Route path="/templates/new" element={<TemplateForm />} />
                <Route path="/templates/:id/edit" element={<TemplateForm />} />
                <Route path="/batches" element={<BatchList />} />
                <Route path="/batches/:id" element={<BatchDetail />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } />
      </Routes>
    </>
  )
}
