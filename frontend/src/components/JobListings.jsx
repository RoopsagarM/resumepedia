export default function JobListings({ resume, accepted }) {
  const role = resume?.experience?.[0]?.role || ''
  const skills = resume?.skills?.slice(0,5) || []
  const location = resume?.location || ''
  const name = resume?.name || ''

  const q = encodeURIComponent(role)
  const s = encodeURIComponent(skills.slice(0,3).join(' '))
  const l = encodeURIComponent(location)

  const boards = [
    { name:'LinkedIn', color:'#0077b5', logo:'in', url:`https://www.linkedin.com/jobs/search/?keywords=${q}&location=${l}`, count:'100k+ jobs', tag:'Best for networking' },
    { name:'Indeed', color:'#003a9b', logo:'In', url:`https://www.indeed.com/jobs?q=${q}&l=${l}`, count:'250k+ jobs', tag:'Most listings' },
    { name:'Glassdoor', color:'#0caa41', logo:'G', url:`https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${q}`, count:'50k+ jobs', tag:'Salary insights' },
    { name:'Wellfound', color:'#ff6154', logo:'W', url:`https://wellfound.com/jobs?q=${q}`, count:'30k+ jobs', tag:'Startups' },
    { name:'Dice', color:'#e8212e', logo:'D', url:`https://www.dice.com/jobs?q=${q}&location=${l}`, count:'80k+ jobs', tag:'Tech focused' },
    { name:'Monster', color:'#6e1787', logo:'M', url:`https://www.monster.com/jobs/search?q=${q}&where=${l}`, count:'150k+ jobs', tag:'All industries' },
    { name:'ZipRecruiter', color:'#00b140', logo:'Z', url:`https://www.ziprecruiter.com/jobs-search?search=${q}&location=${l}`, count:'200k+ jobs', tag:'Quick apply' },
    { name:'Google Jobs', color:'#4285f4', logo:'G', url:`https://www.google.com/search?q=${encodeURIComponent(role+' jobs '+location)}&ibp=htl;jobs`, count:'Live listings', tag:'All sources' },
  ]

  const roleVariants = []
  if(role) {
    roleVariants.push({ label: role, url: `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${l}` })
    if(role.toLowerCase().includes('engineer')) roleVariants.push({ label:'Software Developer', url:`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent('Software Developer')}&location=${l}` })
    if(role.toLowerCase().includes('senior')) roleVariants.push({ label:role.replace(/senior/i,'Staff').trim(), url:`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(role.replace(/senior/i,'Staff').trim())}&location=${l}` })
    if(role.toLowerCase().includes('engineer')||role.toLowerCase().includes('developer')) roleVariants.push({ label:'Tech Lead', url:`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent('Tech Lead')}&location=${l}` })
  }

  const skillSearches = skills.slice(0,6).map(sk=>({
    label: sk,
    url: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(sk+' '+role)}&location=${l}`
  }))

  const remoteUrl = `https://www.linkedin.com/jobs/search/?keywords=${q}&f_WT=2`
  const hiringUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(role+' hiring')}&origin=GLOBAL_SEARCH_HEADER`

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
        <h2 className="text-xl font-bold mb-1">Jobs matching your resume</h2>
        <p className="text-blue-100 text-sm">
          {role && <>Searching for <strong>{role}</strong></>}
          {location && <> in <strong>{location}</strong></>}
          {skills.length>0 && <> · Skills: {skills.slice(0,3).join(', ')}</>}
        </p>
        <div className="flex gap-2 mt-4">
          <a href={remoteUrl} target="_blank" rel="noopener noreferrer"
            className="bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-4 py-2 rounded-lg transition-all">
            🌍 Remote only
          </a>
          <a href={hiringUrl} target="_blank" rel="noopener noreferrer"
            className="bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-4 py-2 rounded-lg transition-all">
            👤 Find hiring managers
          </a>
          <a href={`https://www.linkedin.com/jobs/search/?keywords=${q}&f_TPR=r86400`} target="_blank" rel="noopener noreferrer"
            className="bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-4 py-2 rounded-lg transition-all">
            🆕 Posted today
          </a>
        </div>
      </div>

      {/* Job boards grid */}
      <div>
        <h3 className="section-heading">Apply directly on top job boards</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {boards.map(b=>(
            <a key={b.name} href={b.url} target="_blank" rel="noopener noreferrer"
              className="card hover:shadow-md hover:border-blue-300 transition-all group cursor-pointer p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{background:b.color}}>
                  {b.logo}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{b.name}</p>
                  <p className="text-xs text-slate-400">{b.count}</p>
                </div>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full w-fit">{b.tag}</span>
              <span className="text-xs text-blue-600 font-medium group-hover:underline mt-auto">Search now →</span>
            </a>
          ))}
        </div>
      </div>

      {/* Role variants */}
      {roleVariants.length>0&&(
        <div className="card">
          <h3 className="section-heading">Also search for similar roles</h3>
          <div className="flex flex-wrap gap-2">
            {roleVariants.map((r,i)=>(
              <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-sm px-4 py-2 rounded-full hover:bg-blue-100 transition-all font-medium">
                {r.label}
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Search by skill */}
      {skillSearches.length>0&&(
        <div className="card">
          <h3 className="section-heading">Search by your top skills</h3>
          <div className="flex flex-wrap gap-2">
            {skillSearches.map((s,i)=>(
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200 text-xs px-3 py-1.5 rounded-full hover:bg-purple-100 transition-all">
                {s.label} jobs →
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Quick tips */}
      <div className="card bg-amber-50 border-amber-200">
        <h3 className="text-sm font-semibold text-amber-900 mb-3">Pro tips for applying</h3>
        <div className="space-y-2 text-sm text-amber-800">
          <p>💡 <strong>Tailor per application</strong> — paste the job description in the editor and regenerate to match keywords.</p>
          <p>📎 <strong>Upload your PDF</strong> — download your resume above and attach it to every application.</p>
          <p>🤝 <strong>Connect first</strong> — find the hiring manager on LinkedIn and connect before applying.</p>
          <p>⚡ <strong>Apply within 24hrs</strong> — jobs posted today get 3x more interview callbacks.</p>
        </div>
      </div>
    </div>
  )
}
