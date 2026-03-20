import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../api.js'

function timeAgo(ts) {
  const s = Math.floor((Date.now()/1000) - ts)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  return `${Math.floor(s/86400)}d ago`
}

export default function Dashboard({ onOpenEditor }) {
  const { user, logout } = useAuth()
  const [resumes, setResumes] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchResumes = async () => {
    try {
      const { data } = await api.get('/resumes')
      setResumes(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchResumes() }, [])

  const deleteResume = async (id, e) => {
    e.stopPropagation()
    if (!confirm('Delete this resume?')) return
    await api.delete(`/resumes/${id}`)
    setResumes(r => r.filter(x => x.id !== id))
  }

  const openResume = async (id) => {
    const { data } = await api.get(`/resumes/${id}`)
    onOpenEditor({ id: data.id, title: data.title, ...data.data })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <span className="font-semibold text-slate-900">Resumepedia</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">Hi, {user.name}</span>
            <button onClick={logout} className="btn-secondary text-xs py-1.5 px-3">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Resumes</h1>
            <p className="text-slate-500 text-sm mt-1">Create, edit and manage your resumes</p>
          </div>
          <button onClick={() => onOpenEditor(null)} className="btn-primary">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            New resume
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="dot-pulse flex gap-1.5 text-blue-500"><span/><span/><span/></div>
          </div>
        ) : resumes.length === 0 ? (
          <div className="text-center py-24 card border-dashed">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <p className="text-slate-500 text-sm mb-4">No resumes yet. Create your first one!</p>
            <button onClick={() => onOpenEditor(null)} className="btn-primary">Create resume</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {resumes.map(r => (
              <div key={r.id} onClick={() => openResume(r.id)}
                className="card cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group fade-in">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                  </div>
                  <button onClick={(e) => deleteResume(r.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all p-1 rounded">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
                <h3 className="font-semibold text-slate-900 text-sm mb-1 truncate">{r.title}</h3>
                <p className="text-xs text-slate-400">Updated {timeAgo(r.updated_at)}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
