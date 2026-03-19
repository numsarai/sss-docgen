import { NavLink, useNavigate } from 'react-router-dom'
import { ReactNode, useEffect, useState } from 'react'
function HomeIcon() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function FileIcon() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  )
}

function ScanIcon() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 7 4 4 7 4"/>
      <polyline points="17 4 20 4 20 7"/>
      <polyline points="20 17 20 20 17 20"/>
      <polyline points="7 20 4 20 4 17"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
    </svg>
  )
}

function BatchIcon() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="4" rx="1"/>
      <rect x="3" y="10" width="18" height="4" rx="1"/>
      <rect x="3" y="17" width="18" height="4" rx="1"/>
    </svg>
  )
}

function TemplateIcon() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="9" y1="21" x2="9" y2="9"/>
    </svg>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')

  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  function handleLogout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="layout">
      <nav className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>
          <div className="sidebar-brand" style={{ padding: '24px 16px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <img src="/sss-logo.png" alt="SSS Logo" style={{ width: '80%', height: 'auto', display: 'block' }} />
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-2)' }}>Saraithong</h1>
              <p style={{ fontSize: 11, color: 'var(--text-2)', opacity: 0.8 }}>Superassistant System</p>
            </div>
          </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Overview</div>
          <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <HomeIcon />
            Dashboard
          </NavLink>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Cases</div>
          <NavLink to="/cases" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <FolderIcon />
            All Cases
          </NavLink>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Generate</div>
          <NavLink to="/generate" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <FileIcon />
            Generate
          </NavLink>
          <NavLink to="/batches" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <BatchIcon />
            Batch History
          </NavLink>
          <NavLink to="/extract" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <ScanIcon />
            AI Extract
          </NavLink>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Settings</div>
          <NavLink to="/templates" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <TemplateIcon />
            Templates
          </NavLink>
        </div>
        </div>

        <div className="sidebar-section" style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button 
            className="nav-item"
            style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 8 }}
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
          
          <button 
            className="nav-item"
            style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: 'var(--error)' }}
            onClick={handleLogout}
          >
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Log Out
          </button>
        </div>
      </nav>

      <main className="main">
        <div className="page">
          {children}
        </div>
      </main>
    </div>
  )
}
