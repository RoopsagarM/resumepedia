import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import AuthPage from './pages/AuthPage.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Editor from './pages/Editor.jsx'

function AppInner() {
  const { user } = useAuth()
  const [page, setPage] = useState('dashboard') // dashboard | editor
  const [editingResume, setEditingResume] = useState(null)

  const openEditor = (resume = null) => {
    setEditingResume(resume)
    setPage('editor')
  }

  if (!user) return <AuthPage />

  if (page === 'editor') {
    return <Editor resume={editingResume} onBack={() => { setPage('dashboard'); setEditingResume(null) }} />
  }

  return <Dashboard onOpenEditor={openEditor} />
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>
}
