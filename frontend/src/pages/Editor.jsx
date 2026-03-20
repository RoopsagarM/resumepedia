import { useState, useRef } from 'react'
import api from '../api.js'
import JobListings from '../components/JobListings.jsx'

const empty = {
  title:'My Resume', name:'', email:'', phone:'', location:'', summary:'',
  skills:[], experience:[{company:'',role:'',duration:'',bullets:['']}],
  education:[{institution:'',degree:'',year:''}], job_description:''
}
const sample = {
  title:'Sample Resume', name:'Alex Johnson', email:'alex@email.com',
  phone:'+1 555 234 5678', location:'San Francisco, CA',
  summary:'Software engineer with 5 years experience building web apps.',
  skills:['Python','React','Node.js','PostgreSQL','Docker','AWS','FastAPI'],
  experience:[{company:'TechCorp Inc.',role:'Senior Software Engineer',duration:'Jan 2022 – Present',
    bullets:['Built analytics dashboard used by 200+ team members','Developed REST APIs in Python serving 1M+ requests/day','Mentored 4 junior developers improving team velocity by 30%']},
    {company:'StartupXYZ',role:'Software Engineer',duration:'Jun 2019 – Dec 2021',
    bullets:['Shipped React frontend for 50k+ users','Set up CI/CD pipelines reducing deploy time by 60%']}],
  education:[{institution:'UC Berkeley',degree:'B.S. Computer Science',year:'2019'}],
  job_description:''
}

function Loader({ text, agents }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full px-6">
        <div className="dot-pulse flex gap-1.5 text-blue-500"><span/><span/><span/></div>
        <p className="text-slate-600 text-sm font-medium">{text}</p>
        {agents&&(
          <div className="w-full space-y-2">
            {agents.map(a=>(
              <div key={a.name} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm transition-all ${
                a.status==='running'?'bg-blue-50 border-blue-200 text-blue-700':
                a.status==='done'?'bg-green-50 border-green-200 text-green-700':
                'bg-slate-50 border-slate-200 text-slate-400'}`}>
                <span className="text-base">{a.status==='done'?'✓':a.status==='running'?'⟳':'○'}</span>
                <span className="font-medium">{a.label}</span>
                {a.status==='running'&&<span className="ml-auto text-xs">working...</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SkillsInput({ skills, onChange }) {
  const [val,setVal]=useState('')
  const add=()=>{ const v=val.trim(); if(v&&!skills.includes(v)) onChange([...skills,v]); setVal('') }
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[24px]">
        {skills.map(s=>(
          <span key={s} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full border border-blue-200">
            {s}<button onClick={()=>onChange(skills.filter(x=>x!==s))} className="hover:text-red-500 ml-0.5 text-base leading-none">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="Add a skill and press Enter" value={val}
          onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),add())}/>
        <button onClick={add} className="btn-secondary px-3">Add</button>
      </div>
    </div>
  )
}

// ── Beautiful Resume Template ──────────────────────────────────────────────
function ResumePreview({ data }) {
  return (
    <div id="resume-print" style={{
      fontFamily:'"Helvetica Neue",Arial,sans-serif',
      color:'#1a1a2e',background:'#fff',
      padding:'48px 52px',fontSize:'12px',lineHeight:'1.6',
      maxWidth:'800px',margin:'0 auto'
    }}>
      {/* Header */}
      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'30px',fontWeight:'800',margin:'0 0 4px',letterSpacing:'-0.5px',color:'#0f172a'}}>{data.name}</h1>
        <div style={{display:'flex',flexWrap:'wrap',gap:'16px',marginTop:'6px'}}>
          {data.email&&<span style={{color:'#3b82f6',fontSize:'12px'}}>✉ {data.email}</span>}
          {data.phone&&<span style={{color:'#64748b',fontSize:'12px'}}>✆ {data.phone}</span>}
          {data.location&&<span style={{color:'#64748b',fontSize:'12px'}}>⌖ {data.location}</span>}
        </div>
        <div style={{height:'3px',background:'linear-gradient(90deg,#3b82f6,#8b5cf6)',borderRadius:'2px',marginTop:'14px'}}/>
      </div>

      {/* Summary */}
      {data.summary&&(
        <div style={{marginBottom:'20px'}}>
          <h2 style={{fontSize:'10px',fontWeight:'700',letterSpacing:'0.15em',textTransform:'uppercase',
            color:'#3b82f6',marginBottom:'8px',display:'flex',alignItems:'center',gap:'8px'}}>
            <span>Professional Summary</span>
          </h2>
          <p style={{margin:0,color:'#374151',lineHeight:'1.75',fontSize:'12.5px'}}>{data.summary}</p>
        </div>
      )}

      {/* Skills */}
      {data.skills?.length>0&&(
        <div style={{marginBottom:'20px'}}>
          <h2 style={{fontSize:'10px',fontWeight:'700',letterSpacing:'0.15em',textTransform:'uppercase',color:'#3b82f6',marginBottom:'8px'}}>Core Skills</h2>
          <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
            {data.skills.map((s,i)=>(
              <span key={i} style={{background:'#eff6ff',color:'#1d4ed8',border:'1px solid #bfdbfe',
                padding:'3px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:'500'}}>{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Experience */}
      {data.experience?.length>0&&(
        <div style={{marginBottom:'20px'}}>
          <h2 style={{fontSize:'10px',fontWeight:'700',letterSpacing:'0.15em',textTransform:'uppercase',color:'#3b82f6',marginBottom:'12px'}}>Professional Experience</h2>
          {data.experience.map((e,i)=>(
            <div key={i} style={{marginBottom:'18px',paddingLeft:'14px',borderLeft:'2px solid #e0e7ff'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'3px'}}>
                <div>
                  <span style={{fontWeight:'700',fontSize:'13px',color:'#0f172a'}}>{e.role}</span>
                  <span style={{color:'#6366f1',fontWeight:'600',fontSize:'12px'}}> · {e.company}</span>
                </div>
                <span style={{fontSize:'11px',color:'#94a3b8',background:'#f8fafc',padding:'2px 8px',borderRadius:'4px',whiteSpace:'nowrap',marginLeft:'12px'}}>{e.duration}</span>
              </div>
              <ul style={{margin:'6px 0 0',paddingLeft:'16px'}}>
                {e.bullets?.filter(b=>b?.trim()).map((b,j)=>(
                  <li key={j} style={{marginBottom:'4px',color:'#374151',lineHeight:'1.65'}}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {data.education?.length>0&&(
        <div>
          <h2 style={{fontSize:'10px',fontWeight:'700',letterSpacing:'0.15em',textTransform:'uppercase',color:'#3b82f6',marginBottom:'10px'}}>Education</h2>
          {data.education.map((e,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
              padding:'8px 14px',background:'#f8fafc',borderRadius:'8px',marginBottom:'6px'}}>
              <div>
                <span style={{fontWeight:'700',fontSize:'12.5px',color:'#0f172a'}}>{e.degree}</span>
                <span style={{color:'#6366f1',fontSize:'12px'}}> · {e.institution}</span>
              </div>
              <span style={{fontSize:'11px',color:'#94a3b8',fontWeight:'500'}}>{e.year}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ScoreRing({ score, label, color }) {
  const r=28, circ=2*Math.PI*r, dash=(score/100)*circ
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6"/>
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 36 36)"/>
        <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="700" fill="#0f172a">{score}</text>
      </svg>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  )
}

function CritiquePanel({ critique }) {
  if(!critique) return null
  return (
    <div className="card space-y-5">
      <h3 className="section-heading flex items-center gap-2">AI Critique <span className="text-xs font-normal text-slate-400">Critic Agent</span></h3>
      <div className="flex justify-around py-2">
        <ScoreRing score={critique.overall_score||0} label="Overall" color="#3b82f6"/>
        <ScoreRing score={critique.ats_score||0} label="ATS" color="#8b5cf6"/>
        <ScoreRing score={critique.scores?.impact||0} label="Impact" color="#f59e0b"/>
        <ScoreRing score={critique.scores?.clarity||0} label="Clarity" color="#10b981"/>
      </div>
      {critique.verdict&&<div className="bg-slate-50 rounded-lg px-4 py-3 text-sm text-slate-700 italic">"{critique.verdict}"</div>}
      <div className="grid grid-cols-2 gap-4">
        {critique.strengths?.length>0&&(
          <div>
            <p className="label text-green-600">Strengths</p>
            <ul className="space-y-1">{critique.strengths.map((s,i)=><li key={i} className="flex gap-2 text-sm text-slate-700"><span className="text-green-500 flex-shrink-0">✓</span>{s}</li>)}</ul>
          </div>
        )}
        {critique.improvements?.length>0&&(
          <div>
            <p className="label text-amber-600">Improvements</p>
            <ul className="space-y-1">{critique.improvements.map((s,i)=><li key={i} className="flex gap-2 text-sm text-slate-700"><span className="text-amber-500 flex-shrink-0">→</span>{s}</li>)}</ul>
          </div>
        )}
      </div>
      {critique.missing_keywords?.length>0&&(
        <div>
          <p className="label">Missing keywords</p>
          <div className="flex flex-wrap gap-1.5">
            {critique.missing_keywords.map(k=><span key={k} className="bg-red-50 text-red-600 border border-red-200 text-xs px-2.5 py-1 rounded-full">{k}</span>)}
          </div>
        </div>
      )}
    </div>
  )
}

function CoverLetterPanel({ cover_letter }) {
  const [copied,setCopied]=useState(false)
  if(!cover_letter) return null
  const copy=()=>{ navigator.clipboard.writeText(cover_letter.body); setCopied(true); setTimeout(()=>setCopied(false),2000) }
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-heading mb-0 flex items-center gap-2">Cover Letter <span className="text-xs font-normal text-slate-400">Cover Letter Agent</span></h3>
        <button onClick={copy} className="btn-secondary text-xs py-1.5">{copied?'✓ Copied':'Copy'}</button>
      </div>
      {cover_letter.subject&&<p className="text-xs text-slate-500 mb-3 font-mono bg-slate-50 px-3 py-2 rounded">{cover_letter.subject}</p>}
      <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line border-l-2 border-blue-200 pl-4">{cover_letter.body}</div>
    </div>
  )
}

function AgentLog({ log, time_taken }) {
  const [open,setOpen]=useState(false)
  if(!log?.length) return null
  return (
    <div className="card bg-slate-50 border-slate-200">
      <button onClick={()=>setOpen(o=>!o)} className="flex items-center justify-between w-full">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Agent log — {log.length} events · {time_taken}s</span>
        <span className="text-slate-400 text-xs">{open?'▲':'▼'}</span>
      </button>
      {open&&<div className="mt-3 space-y-1">{log.map((e,i)=>(
        <div key={i} className="flex gap-3 text-xs font-mono">
          <span className={`font-semibold ${e.status==='error'?'text-red-500':e.agent==='orchestrator'?'text-purple-600':'text-blue-600'}`}>[{e.agent}]</span>
          <span className="text-slate-600">{e.status||e.decision||e.error}</span>
        </div>
      ))}</div>}
    </div>
  )
}

// ── Accept / Regenerate Banner ─────────────────────────────────────────────
function AcceptBanner({ onAccept, onRegenerate, accepted }) {
  if(accepted) return (
    <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">✓</div>
        <div>
          <p className="font-semibold text-green-900 text-sm">Resume accepted!</p>
          <p className="text-xs text-green-700">Scroll down to browse job listings and apply directly.</p>
        </div>
      </div>
      <button onClick={onRegenerate} className="btn-secondary text-xs py-1.5">Regenerate</button>
    </div>
  )
  return (
    <div className="bg-white border-2 border-blue-200 rounded-xl px-6 py-5 flex items-center justify-between gap-4">
      <div>
        <p className="font-semibold text-slate-900 text-sm mb-0.5">Happy with your resume?</p>
        <p className="text-xs text-slate-500">Accept to unlock job listings, or regenerate for a fresh take.</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button onClick={onRegenerate} className="btn-secondary text-sm">
          ↺ Regenerate
        </button>
        <button onClick={onAccept} className="btn-primary text-sm">
          ✓ Accept resume
        </button>
      </div>
    </div>
  )
}

export default function Editor({ resume: initialResume, onBack }) {
  const [resume,setResume]=useState(initialResume?{...empty,...initialResume}:{...empty})
  const [tab,setTab]=useState('edit')
  const [aiLoading,setAiLoading]=useState(false)
  const [aiText,setAiText]=useState('')
  const [agentStatuses,setAgentStatuses]=useState(null)
  const [saveMsg,setSaveMsg]=useState('')
  const [error,setError]=useState('')
  const [aiResult,setAiResult]=useState(null)
  const [accepted,setAccepted]=useState(false)
  const fileRef=useRef()
  const isEdit=!!initialResume?.id

  const set=(k,v)=>setResume(r=>({...r,[k]:v}))
  const setExp=(i,k,v)=>setResume(r=>{const e=[...r.experience];e[i]={...e[i],[k]:v};return{...r,experience:e}})
  const setExpBullet=(ei,bi,v)=>setResume(r=>{const e=[...r.experience];const b=[...e[ei].bullets];b[bi]=v;e[ei]={...e[ei],bullets:b};return{...r,experience:e}})
  const addExpBullet=i=>setResume(r=>{const e=[...r.experience];e[i]={...e[i],bullets:[...e[i].bullets,'']};return{...r,experience:e}})
  const removeExpBullet=(ei,bi)=>setResume(r=>{const e=[...r.experience];e[ei]={...e[ei],bullets:e[ei].bullets.filter((_,j)=>j!==bi)};return{...r,experience:e}})
  const addExp=()=>setResume(r=>({...r,experience:[...r.experience,{company:'',role:'',duration:'',bullets:['']}]}))
  const removeExp=i=>setResume(r=>({...r,experience:r.experience.filter((_,j)=>j!==i)}))
  const setEdu=(i,k,v)=>setResume(r=>{const e=[...r.education];e[i]={...e[i],[k]:v};return{...r,education:e}})
  const addEdu=()=>setResume(r=>({...r,education:[...r.education,{institution:'',degree:'',year:''}]}))
  const removeEdu=i=>setResume(r=>({...r,education:r.education.filter((_,j)=>j!==i)}))

  const handlePDF=async e=>{
    const file=e.target.files[0];if(!file)return
    setAiLoading(true);setAiText('Parser Agent extracting your PDF...')
    try{const form=new FormData();form.append('file',file);const{data}=await api.post('/parse-pdf',form);setResume(r=>({...r,...data}))}
    catch(err){setError('PDF failed: '+(err.response?.data?.detail||err.message))}
    setAiLoading(false);setAiText('')
  }

  const runAgents=async(mode)=>{
    setError('');setAiLoading(true);setAccepted(false)
    const agentList=[
      {name:'writer',label:'Writer Agent — polishing bullets',status:'running'},
      {name:'critic',label:'Critic Agent — scoring resume',status:'running'},
      {name:'tailor',label:'Tailor Agent — matching keywords',status:'running'},
      {name:'cover',label:'Cover Letter Agent — writing letter',status:'running'},
    ]
    setAgentStatuses(agentList);setAiText('Orchestrator dispatching all agents in parallel...')
    try{
      const endpoint=mode==='generate'?'/generate':'/improve'
      const payload=mode==='generate'?resume:{resume,job_description:resume.job_description}
      const{data}=await api.post(endpoint,payload)
      setAgentStatuses(agentList.map(a=>({...a,status:'done'})))
      setResume(r=>({...r,...data.resume}))
      setAiResult(data)
      setTab('results')
    }catch(err){setError('Failed: '+(err.response?.data?.detail||err.message))}
    setAiLoading(false);setAiText('');setAgentStatuses(null)
  }

  const handleSave=async()=>{
    setError('')
    try{
      const payload={title:resume.title||'My Resume',data:resume}
      if(isEdit) await api.put(`/resumes/${initialResume.id}`,payload)
      else await api.post('/resumes',payload)
      setSaveMsg('Saved!');setTimeout(()=>setSaveMsg(''),2000)
    }catch(err){setError('Save failed: '+(err.response?.data?.detail||err.message))}
  }

  const handleDownload=async()=>{
    try {
      const el=document.getElementById('resume-print')
      if(!el){setError('Please switch to Preview tab first, then download.');return}
      const{default:html2pdf}=await import('html2pdf.js')
      await html2pdf().set({
        margin:[8,8,8,8],
        filename:`${(resume.name||'resume').toLowerCase().replace(/\s+/g,'-')}-resume.pdf`,
        image:{type:'jpeg',quality:1},
        html2canvas:{scale:3,useCORS:true,letterRendering:true},
        jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
      }).from(el).save()
    } catch(err) { setError('Download failed: '+err.message) }
  }

  if(aiLoading) return <Loader text={aiText} agents={agentStatuses}/>

  const tabs=[
    {key:'edit',label:'Edit'},
    {key:'preview',label:'Preview'},
    {key:'results',label:aiResult?'✦ AI Results':'AI Results'},
    {key:'jobs',label:accepted?'✦ Apply for Jobs':'Find Jobs'},
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="btn-secondary py-1.5 px-3 text-xs">← Back</button>
            <input className="font-semibold text-slate-900 bg-transparent border-none outline-none text-sm w-48"
              value={resume.title} onChange={e=>set('title',e.target.value)} placeholder="Resume title"/>
          </div>
          <div className="flex items-center gap-2">
            {saveMsg&&<span className="text-xs text-green-600 font-medium">{saveMsg}</span>}
            {error&&<span className="text-xs text-red-600 font-medium truncate max-w-xs">{error}</span>}
            <div className="flex rounded-lg bg-slate-100 p-0.5">
              {tabs.map(t=>(
                <button key={t.key} onClick={()=>setTab(t.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    tab===t.key?'bg-white text-slate-900 shadow-sm':'text-slate-500 hover:text-slate-700'
                  } ${(t.key==='results'&&aiResult)||(t.key==='jobs'&&accepted)?'text-blue-600':''}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <button onClick={handleSave} className="btn-secondary text-xs py-1.5">Save</button>
            <button onClick={handleDownload} className="btn-primary text-xs py-1.5">Download PDF</button>
          </div>
        </div>
      </header>

      {/* PREVIEW */}
      {tab==='preview'&&(
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
          <AcceptBanner
            accepted={accepted}
            onAccept={()=>{setAccepted(true);setTab('jobs')}}
            onRegenerate={()=>runAgents('generate')}
          />
          <div className="card p-0 overflow-hidden shadow-lg">
            <div className="bg-slate-100 p-4">
              <ResumePreview data={resume}/>
            </div>
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={()=>runAgents('improve')} className="btn-secondary">Run agents again</button>
            <button onClick={()=>setTab('results')} className="btn-secondary">View AI scores</button>
          </div>
        </div>
      )}

      {/* AI RESULTS */}
      {tab==='results'&&(
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6 fade-in">
          {!aiResult?(
            <div className="card text-center py-12">
              <p className="text-slate-500 text-sm mb-4">Generate your resume first to see AI results.</p>
              <button onClick={()=>setTab('edit')} className="btn-primary">Go to editor</button>
            </div>
          ):(
            <>
              <AcceptBanner
                accepted={accepted}
                onAccept={()=>{setAccepted(true);setTab('jobs')}}
                onRegenerate={()=>runAgents('generate')}
              />
              <div className="card bg-blue-50 border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-blue-900 text-sm">All agents completed successfully</p>
                    <p className="text-xs text-blue-700 mt-0.5">{aiResult.agent_log?.length} events · {aiResult.time_taken}s total</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={()=>setTab('preview')} className="btn-secondary text-xs py-1.5">View resume</button>
                    <button onClick={handleDownload} className="btn-primary text-xs py-1.5">Download PDF</button>
                  </div>
                </div>
              </div>
              <CritiquePanel critique={aiResult.critique}/>
              {aiResult.cover_letter&&<CoverLetterPanel cover_letter={aiResult.cover_letter}/>}
              <AgentLog log={aiResult.agent_log} time_taken={aiResult.time_taken}/>
            </>
          )}
        </div>
      )}

      {/* JOBS */}
      {tab==='jobs'&&(
        <div className="max-w-4xl mx-auto px-6 py-8 fade-in">
          {!accepted&&(
            <div className="card bg-amber-50 border-amber-200 mb-6">
              <p className="text-sm text-amber-800 font-medium">Accept your resume first to get personalized job listings.</p>
              <div className="flex gap-2 mt-3">
                <button onClick={()=>setTab('preview')} className="btn-secondary text-xs">View resume</button>
                <button onClick={()=>{setAccepted(true)}} className="btn-primary text-xs">Accept & browse jobs</button>
              </div>
            </div>
          )}
          <JobListings resume={resume} accepted={accepted}/>
        </div>
      )}

      {/* EDIT */}
      {tab==='edit'&&(
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6 fade-in">
          <div className="flex gap-2 flex-wrap">
            <button onClick={()=>fileRef.current.click()} className="btn-secondary text-xs">Upload PDF</button>
            <button onClick={()=>setResume({...sample})} className="btn-secondary text-xs">Load sample</button>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handlePDF}/>
          </div>
          <div className="card">
            <h3 className="section-heading">Personal info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Full name *</label><input className="input" placeholder="Alex Johnson" value={resume.name} onChange={e=>set('name',e.target.value)}/></div>
              <div><label className="label">Email *</label><input className="input" placeholder="alex@email.com" value={resume.email} onChange={e=>set('email',e.target.value)}/></div>
              <div><label className="label">Phone</label><input className="input" placeholder="+1 555 000 0000" value={resume.phone} onChange={e=>set('phone',e.target.value)}/></div>
              <div><label className="label">Location</label><input className="input" placeholder="San Francisco, CA" value={resume.location} onChange={e=>set('location',e.target.value)}/></div>
            </div>
            <div className="mt-4">
              <label className="label">Summary <span className="normal-case font-normal text-slate-400">(Writer Agent will improve this)</span></label>
              <textarea className="input resize-none" rows={3} placeholder="Brief professional summary..." value={resume.summary} onChange={e=>set('summary',e.target.value)}/>
            </div>
          </div>
          <div className="card">
            <h3 className="section-heading">Skills</h3>
            <SkillsInput skills={resume.skills} onChange={v=>set('skills',v)}/>
          </div>
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-heading mb-0">Experience</h3>
              <button onClick={addExp} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add role</button>
            </div>
            <div className="space-y-6">
              {resume.experience.map((exp,ei)=>(
                <div key={ei} className="pl-4 border-l-2 border-slate-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 font-mono">Role {ei+1}</span>
                    {resume.experience.length>1&&<button onClick={()=>removeExp(ei)} className="text-xs text-slate-400 hover:text-red-500">Remove</button>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">Company</label><input className="input" placeholder="Acme Corp" value={exp.company} onChange={e=>setExp(ei,'company',e.target.value)}/></div>
                    <div><label className="label">Job title</label><input className="input" placeholder="Software Engineer" value={exp.role} onChange={e=>setExp(ei,'role',e.target.value)}/></div>
                    <div className="col-span-2"><label className="label">Duration</label><input className="input" placeholder="Jan 2022 – Present" value={exp.duration} onChange={e=>setExp(ei,'duration',e.target.value)}/></div>
                  </div>
                  <div>
                    <label className="label">Bullets</label>
                    <div className="space-y-2">
                      {exp.bullets.map((b,bi)=>(
                        <div key={bi} className="flex gap-2 items-center">
                          <span className="text-slate-300 text-lg">·</span>
                          <input className="input flex-1" placeholder="What did you do?" value={b} onChange={e=>setExpBullet(ei,bi,e.target.value)}/>
                          {exp.bullets.length>1&&<button onClick={()=>removeExpBullet(ei,bi)} className="text-slate-300 hover:text-red-400 text-lg leading-none">×</button>}
                        </div>
                      ))}
                      <button onClick={()=>addExpBullet(ei)} className="text-xs text-blue-600 hover:text-blue-700 ml-4">+ Add bullet</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-heading mb-0">Education</h3>
              <button onClick={addEdu} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Add</button>
            </div>
            <div className="space-y-3">
              {resume.education.map((edu,i)=>(
                <div key={i} className="grid grid-cols-3 gap-3">
                  <div><label className="label">Institution</label><input className="input" placeholder="UC Berkeley" value={edu.institution} onChange={e=>setEdu(i,'institution',e.target.value)}/></div>
                  <div><label className="label">Degree</label><input className="input" placeholder="B.S. Computer Science" value={edu.degree} onChange={e=>setEdu(i,'degree',e.target.value)}/></div>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1"><label className="label">Year</label><input className="input" placeholder="2023" value={edu.year} onChange={e=>setEdu(i,'year',e.target.value)}/></div>
                    {resume.education.length>1&&<button onClick={()=>removeEdu(i)} className="btn-secondary px-2 py-2 mb-0.5 text-sm">×</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 className="section-heading">Job description <span className="text-slate-400 font-normal text-sm">(optional)</span></h3>
            <p className="text-xs text-slate-500 mb-3">Paste a job description — the Tailor Agent will align your resume to it.</p>
            <textarea className="input resize-none" rows={5} placeholder="Paste job description here..." value={resume.job_description} onChange={e=>set('job_description',e.target.value)}/>
          </div>
          {error&&<div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
          <div className="flex justify-end gap-3 pb-8">
            <button onClick={handleSave} className="btn-secondary">Save draft</button>
            <button onClick={()=>runAgents('generate')} disabled={!resume.name||!resume.email} className="btn-primary">
              Run all agents →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
