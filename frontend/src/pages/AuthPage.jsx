import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../api.js'

export default function AuthPage() {
  const { login } = useAuth()
  const [mode, setMode] = useState('login') // login | signup
  const [step, setStep] = useState(1) // 1=details, 2=code, 3=password
  const [form, setForm] = useState({ name:'', email:'', code:'', password:'', confirm:'' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [codeSent, setCodeSent] = useState(false)

  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const switchMode = (m) => {
    setMode(m); setStep(1); setError(''); setCodeSent(false)
    setForm({ name:'', email:'', code:'', password:'', confirm:'' })
  }

  // STEP 1: Send verification code
  const handleSendCode = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('Please enter your full name')
    if (!form.email.trim()) return setError('Please enter your email')
    setError(''); setLoading(true)
    try {
      await api.post('/auth/send-code', { email: form.email, name: form.name })
      setCodeSent(true)
      setStep(2)
    } catch(err) {
      setError(err.response?.data?.detail || 'Failed to send code. Try again.')
    }
    setLoading(false)
  }

  // STEP 2: Verify code
  const handleVerifyCode = async (e) => {
    e.preventDefault()
    if (form.code.length !== 6) return setError('Enter the 6-digit code')
    setError(''); setStep(3)
  }

  // STEP 3: Set password and complete signup
  const handleSignup = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) return setError('Password must be at least 8 characters')
    if (form.password !== form.confirm) return setError('Passwords do not match')
    setError(''); setLoading(true)
    try {
      const { data } = await api.post('/auth/verify-and-signup', {
        email: form.email,
        code: form.code,
        name: form.name,
        password: form.password
      })
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      window.location.reload()
    } catch(err) {
      setError(err.response?.data?.detail || 'Signup failed. Try again.')
      if (err.response?.data?.detail?.includes('code')) setStep(2)
    }
    setLoading(false)
  }

  // LOGIN
  const handleLogin = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await login(form.email, form.password)
    } catch(err) {
      setError(err.response?.data?.detail || 'Invalid email or password')
    }
    setLoading(false)
  }

  const resendCode = async () => {
    setError(''); setLoading(true)
    try {
      await api.post('/auth/send-code', { email: form.email, name: form.name })
      setError('')
    } catch(err) {
      setError('Failed to resend. Try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-4 shadow-lg">
            <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Resumepedia</h1>
          <p className="text-slate-500 text-sm mt-1">AI-powered resume builder</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">

          {/* Mode tabs */}
          <div className="flex border-b border-slate-100">
            {['login','signup'].map(m=>(
              <button key={m} onClick={()=>switchMode(m)}
                className={`flex-1 py-3.5 text-sm font-semibold transition-all ${
                  mode===m ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-400 hover:text-slate-600'
                }`}>
                {m==='login'?'Sign in':'Create account'}
              </button>
            ))}
          </div>

          <div className="p-6">

            {/* ── LOGIN ── */}
            {mode==='login'&&(
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="label">Email</label>
                  <input className="input" type="email" placeholder="you@example.com"
                    value={form.email} onChange={e=>set('email',e.target.value)} required/>
                </div>
                <div>
                  <label className="label">Password</label>
                  <input className="input" type="password" placeholder="••••••••"
                    value={form.password} onChange={e=>set('password',e.target.value)} required/>
                </div>
                {error&&<div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-sm">
                  {loading ? <span className="dot-pulse flex gap-1 justify-center"><span/><span/><span/></span> : 'Sign in'}
                </button>
              </form>
            )}

            {/* ── SIGNUP STEP 1: Name + Email ── */}
            {mode==='signup'&&step===1&&(
              <form onSubmit={handleSendCode} className="space-y-4">
                <div className="flex gap-2 mb-2">
                  {[1,2,3].map(n=>(
                    <div key={n} className={`flex-1 h-1.5 rounded-full transition-all ${n<=step?'bg-blue-500':'bg-slate-200'}`}/>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mb-4">Step 1 of 3 — Your details</p>
                <div>
                  <label className="label">Full name</label>
                  <input className="input" placeholder="Alex Johnson"
                    value={form.name} onChange={e=>set('name',e.target.value)} required/>
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input" type="email" placeholder="you@gmail.com"
                    value={form.email} onChange={e=>set('email',e.target.value)} required/>
                </div>
                {error&&<div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-sm">
                  {loading
                    ? <span className="dot-pulse flex gap-1 justify-center"><span/><span/><span/></span>
                    : 'Send verification code →'}
                </button>
              </form>
            )}

            {/* ── SIGNUP STEP 2: Verify Code ── */}
            {mode==='signup'&&step===2&&(
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="flex gap-2 mb-2">
                  {[1,2,3].map(n=>(
                    <div key={n} className={`flex-1 h-1.5 rounded-full transition-all ${n<=step?'bg-blue-500':'bg-slate-200'}`}/>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mb-1">Step 2 of 3 — Verify your email</p>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                  <p className="text-2xl mb-2">📬</p>
                  <p className="text-sm font-semibold text-blue-900">Code sent to</p>
                  <p className="text-sm text-blue-700 font-mono">{form.email}</p>
                  <p className="text-xs text-blue-500 mt-1">Check your inbox (and spam folder)</p>
                </div>

                <div>
                  <label className="label">6-digit verification code</label>
                  <input className="input text-center text-2xl font-mono tracking-widest"
                    placeholder="• • • • • •" maxLength={6}
                    value={form.code} onChange={e=>set('code',e.target.value.replace(/\D/g,''))} required/>
                </div>

                {error&&<div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

                <button type="submit" disabled={loading||form.code.length!==6} className="btn-primary w-full justify-center py-3 text-sm">
                  Verify code →
                </button>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <button type="button" onClick={()=>setStep(1)} className="hover:text-slate-600">← Change email</button>
                  <button type="button" onClick={resendCode} disabled={loading} className="hover:text-blue-600 text-blue-500">Resend code</button>
                </div>
              </form>
            )}

            {/* ── SIGNUP STEP 3: Set Password ── */}
            {mode==='signup'&&step===3&&(
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="flex gap-2 mb-2">
                  {[1,2,3].map(n=>(
                    <div key={n} className={`flex-1 h-1.5 rounded-full transition-all ${n<=step?'bg-blue-500':'bg-slate-200'}`}/>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mb-1">Step 3 of 3 — Set your password</p>

                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
                  <span className="text-green-500 text-lg">✓</span>
                  <p className="text-sm text-green-800 font-medium">Email verified successfully!</p>
                </div>

                <div>
                  <label className="label">Password</label>
                  <input className="input" type="password" placeholder="Min 8 characters"
                    value={form.password} onChange={e=>set('password',e.target.value)} required minLength={8}/>
                  {form.password.length>0&&(
                    <div className="flex gap-1 mt-1.5">
                      {[1,2,3,4].map(n=>(
                        <div key={n} className={`flex-1 h-1 rounded-full transition-all ${
                          form.password.length>=n*3
                            ? form.password.length>=12?'bg-green-500':form.password.length>=8?'bg-amber-400':'bg-red-400'
                            : 'bg-slate-200'
                        }`}/>
                      ))}
                      <span className="text-xs text-slate-400 ml-1">
                        {form.password.length>=12?'Strong':form.password.length>=8?'Good':'Weak'}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">Confirm password</label>
                  <input className="input" type="password" placeholder="Type password again"
                    value={form.confirm} onChange={e=>set('confirm',e.target.value)} required/>
                  {form.confirm.length>0&&(
                    <p className={`text-xs mt-1 ${form.password===form.confirm?'text-green-600':'text-red-500'}`}>
                      {form.password===form.confirm?'✓ Passwords match':'✗ Passwords do not match'}
                    </p>
                  )}
                </div>

                {error&&<div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

                <button type="submit"
                  disabled={loading||form.password!==form.confirm||form.password.length<8}
                  className="btn-primary w-full justify-center py-3 text-sm">
                  {loading
                    ? <span className="dot-pulse flex gap-1 justify-center"><span/><span/><span/></span>
                    : 'Create my account →'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
