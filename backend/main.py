from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
import os, json, hashlib, secrets, requests, io, time, re, random
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras

try:
    from pypdf import PdfReader
except ImportError:
    from PyPDF2 import PdfReader

load_dotenv()

app = FastAPI(title="Resumepedia")
security = HTTPBearer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")

# ── Database ──────────────────────────────────────────────────────────────

def get_db():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    return conn

def db_exec(sql, params=(), fetch=None):
    conn = get_db()
    cur = conn.cursor()
    cur.execute(sql, params)
    result = None
    if fetch == "one": result = cur.fetchone()
    elif fetch == "all": result = cur.fetchall()
    conn.commit()
    cur.close()
    conn.close()
    return result

def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL, password_hash TEXT NOT NULL,
        verified INTEGER DEFAULT 0, created_at BIGINT NOT NULL)""")
    cur.execute("""CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at BIGINT NOT NULL)""")
    cur.execute("""CREATE TABLE IF NOT EXISTS resumes (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL,
        title TEXT NOT NULL, data TEXT NOT NULL,
        created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL)""")
    cur.execute("""CREATE TABLE IF NOT EXISTS verification_codes (
        email TEXT PRIMARY KEY, code TEXT NOT NULL, expires_at BIGINT NOT NULL)""")
    conn.commit()
    cur.close()
    conn.close()

init_db()

# ── Auth helpers ──────────────────────────────────────────────────────────

def hash_password(p): return hashlib.sha256(p.encode()).hexdigest()
def make_token(): return secrets.token_hex(32)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    session = db_exec("SELECT user_id FROM sessions WHERE token = %s", (token,), fetch="one")
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    user = db_exec("SELECT * FROM users WHERE id = %s", (session["user_id"],), fetch="one")
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return dict(user)

# ── Email ─────────────────────────────────────────────────────────────────

def send_verification_email(email: str, code: str, name: str = ""):
    if not RESEND_API_KEY:
        raise Exception("RESEND_API_KEY not set")
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:16px">
      <div style="background:#2563eb;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <h1 style="color:white;margin:0;font-size:24px;font-weight:800">Resumepedia</h1>
        <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px">AI-powered resume builder</p>
      </div>
      <div style="background:white;border-radius:12px;padding:28px;border:1px solid #e2e8f0">
        <h2 style="margin:0 0 8px;color:#0f172a;font-size:18px">Verify your email</h2>
        <p style="color:#64748b;font-size:14px;margin:0 0 24px">{"Hi "+name+"! " if name else ""}Your verification code expires in <strong>10 minutes</strong>.</p>
        <div style="background:#eff6ff;border:2px dashed #3b82f6;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
          <p style="margin:0;font-size:42px;font-weight:800;letter-spacing:12px;color:#1d4ed8;font-family:monospace">{code}</p>
        </div>
        <p style="color:#94a3b8;font-size:12px;margin:0">If you didn't request this, ignore this email.</p>
      </div>
    </div>"""
    resp = requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
        json={"from":"Resumepedia <onboarding@resend.dev>","to":[email],
              "subject":f"{code} — Your Resumepedia verification code","html":html},
        timeout=15
    )
    if resp.status_code not in (200,201):
        raise Exception(f"Email failed: {resp.text[:200]}")

# ── LLM ───────────────────────────────────────────────────────────────────

def llm(prompt: str, system: str = "You are a helpful assistant.", temperature: float = 0.7) -> str:
    if not GROQ_API_KEY:
        raise Exception("GROQ_API_KEY not set")
    resp = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
        json={"model":"llama-3.3-70b-versatile",
              "messages":[{"role":"system","content":system},{"role":"user","content":prompt}],
              "temperature":temperature,"max_tokens":4096},
        timeout=60
    )
    if resp.status_code != 200:
        raise Exception(f"Groq error {resp.status_code}: {resp.text[:200]}")
    return resp.json()["choices"][0]["message"]["content"]

def clean_json(raw: str) -> str:
    raw = raw.strip()
    if "```" in raw:
        for block in raw.split("```"):
            block = block.strip()
            if block.startswith("json"): block = block[4:].strip()
            if block.startswith("{") or block.startswith("["): raw = block; break
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end != -1: raw = raw[start:end+1]
    raw = raw.replace("\u2018","'").replace("\u2019","'").replace("\u201c",'"').replace("\u201d",'"')
    raw = re.sub(r",\s*([}\]])", r"\1", raw)
    # Additional cleanup for LLM output issues
    cleaned = []
    in_string = False
    i = 0
    while i < len(raw):
        c = raw[i]
        if c == '"' and (i == 0 or raw[i-1] != '\\'):
            in_string = not in_string
        if in_string and c in '\n\r\t' and (i == 0 or raw[i-1] != '\\'):
            cleaned.append(' ')
        else:
            cleaned.append(c)
        i += 1
    raw = ''.join(cleaned)
    raw = re.sub(r",\s*([}\]])", r"\1", raw)
    return raw.strip()

def resume_to_text(r: dict) -> str:
    exp = "\n".join([
        f"{e.get('role','')} at {e.get('company','')} ({e.get('duration','')}):\n" +
        "\n".join(f"  - {b}" for b in e.get("bullets",[]))
        for e in r.get("experience",[])])
    edu = "\n".join([f"{e.get('degree','')} — {e.get('institution','')} ({e.get('year','')})"
                     for e in r.get("education",[])])
    return f"""Name: {r.get('name','')}
Email: {r.get('email','')}
Phone: {r.get('phone','')}
Location: {r.get('location','')}
Summary: {r.get('summary','')}
Skills: {', '.join(r.get('skills',[]))}
Experience:\n{exp}
Education:\n{edu}"""

SCHEMA = '{"name":"...","email":"...","phone":"...","location":"...","summary":"...","skills":["..."],"experience":[{"company":"...","role":"...","duration":"...","bullets":["..."]}],"education":[{"institution":"...","degree":"...","year":"..."}]}'

# ── Agents ────────────────────────────────────────────────────────────────

def agent_parser(raw_text):
    r = llm(f"Extract resume info. Return ONLY raw JSON.\n\n{raw_text[:4000]}\n\nReturn ONLY:\n{SCHEMA}",
            system="You are a data extraction agent. Return only valid JSON.")
    return json.loads(clean_json(r))

def agent_writer(resume, jd=""):
    jd_s = f"\nTarget Job:\n{jd}" if jd else ""
    r = llm(f"Rewrite this resume professionally. Return ONLY raw JSON.\n\n{resume_to_text(resume)}{jd_s}\n\nRules:\n- Summary: 2-3 sentences, no 'I'\n- Every bullet: action verb + achievement + metric\n- Keep all names/dates\n\nReturn ONLY:\n{SCHEMA}",
            system="You are an elite resume writer.")
    return json.loads(clean_json(r))

def agent_critic(resume, jd=""):
    jd_s = f"\nJob:\n{jd}" if jd else ""
    r = llm(f"Analyze this resume critically. Return ONLY raw JSON.\n\n{resume_to_text(resume)}{jd_s}\n\nReturn ONLY:\n{{\"overall_score\":0-100,\"ats_score\":0-100,\"scores\":{{\"impact\":0-100,\"clarity\":0-100,\"skills_match\":0-100,\"formatting\":0-100}},\"strengths\":[\"...\"],\"improvements\":[\"...\"],\"missing_keywords\":[\"...\"],\"verdict\":\"one sentence\"}}",
            system="You are a strict resume critic.", temperature=0.3)
    return json.loads(clean_json(r))

def agent_tailor(resume, jd):
    if not jd: return {"tailored":False,"matched_keywords":[],"added_keywords":[],"resume":resume}
    r = llm(f"Tailor this resume to the JD. Return ONLY raw JSON.\n\nResume:\n{resume_to_text(resume)}\n\nJD:\n{jd}\n\nDo NOT fabricate. Return ONLY:\n{{\"tailored\":true,\"matched_keywords\":[\"...\"],\"added_keywords\":[\"...\"],\"resume\":{SCHEMA}}}",
            system="You are a resume tailoring agent.")
    return json.loads(clean_json(r))

def agent_cover_letter(resume, jd=""):
    jd_s = f"\nJD:\n{jd}" if jd else "\nWrite a strong general cover letter."
    r = llm(f"Write a cover letter. Return ONLY raw JSON.\n\nResume:\n{resume_to_text(resume)}{jd_s}\n\nReturn ONLY:\n{{\"subject\":\"Application for [Role] — [Name]\",\"body\":\"full cover letter\"}}",
            system="You are an expert cover letter writer.")
    return json.loads(clean_json(r))

def agent_orchestrator(resume, jd="", mode="generate"):
    start = time.time()
    agent_log = []
    results = {}
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(agent_writer, resume, jd): "writer",
            executor.submit(agent_critic, resume, jd): "critic",
            executor.submit(agent_tailor, resume, jd): "tailor",
        }
        if mode == "generate":
            futures[executor.submit(agent_cover_letter, resume, jd)] = "cover_letter"
        for future in as_completed(futures):
            name = futures[future]
            try:
                results[name] = future.result()
                agent_log.append({"agent":name,"status":"success"})
            except Exception as e:
                agent_log.append({"agent":name,"status":"error","error":str(e)})
                results[name] = None

    if jd and results.get("tailor") and results["tailor"].get("resume"):
        final = results["tailor"]["resume"]
        agent_log.append({"agent":"orchestrator","decision":"using tailor output"})
    elif results.get("writer"):
        final = results["writer"]
        agent_log.append({"agent":"orchestrator","decision":"using writer output"})
    else:
        final = resume
        agent_log.append({"agent":"orchestrator","decision":"fallback to original"})

    return {
        "resume": final,
        "critique": results.get("critic"),
        "tailor_info": {"matched_keywords":results["tailor"].get("matched_keywords",[]) if results.get("tailor") else [],
                        "added_keywords":results["tailor"].get("added_keywords",[]) if results.get("tailor") else []} if jd else None,
        "cover_letter": results.get("cover_letter"),
        "agent_log": agent_log,
        "time_taken": round(time.time()-start, 2)
    }

# ── Models ────────────────────────────────────────────────────────────────

class SendCodeRequest(BaseModel):
    email: str; name: Optional[str] = ""

class VerifyCodeRequest(BaseModel):
    email: str; code: str; name: str; password: str

class LoginRequest(BaseModel):
    email: str; password: str

class ResumeData(BaseModel):
    name: str; email: str
    phone: Optional[str] = ""
    location: Optional[str] = ""
    summary: str
    skills: List[str]
    experience: List[dict]
    education: List[dict]
    job_description: Optional[str] = ""

class SaveResumeRequest(BaseModel):
    title: str; data: dict

class ImproveRequest(BaseModel):
    resume: dict; job_description: Optional[str] = ""

# ── Auth Routes ───────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status":"Resumepedia running","db":"postgresql"}

@app.post("/auth/send-code")
def send_code(req: SendCodeRequest):
    email = req.email.lower().strip()
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        raise HTTPException(400, "Invalid email address")
    existing = db_exec("SELECT id FROM users WHERE email = %s", (email,), fetch="one")
    if existing:
        raise HTTPException(400, "Email already registered. Please sign in.")
    code = str(random.randint(100000, 999999))
    expires_at = int(time.time()) + 600
    db_exec("INSERT INTO verification_codes (email,code,expires_at) VALUES (%s,%s,%s) ON CONFLICT (email) DO UPDATE SET code=EXCLUDED.code, expires_at=EXCLUDED.expires_at",
            (email, code, expires_at))
    try:
        send_verification_email(email, code, req.name)
    except Exception as e:
        raise HTTPException(500, f"Failed to send email: {str(e)}")
    return {"message":"Verification code sent"}

@app.post("/auth/verify-and-signup")
def verify_and_signup(req: VerifyCodeRequest):
    email = req.email.lower().strip()
    record = db_exec("SELECT code, expires_at FROM verification_codes WHERE email = %s", (email,), fetch="one")
    if not record:
        raise HTTPException(400, "No verification code found. Request a new one.")
    if int(time.time()) > record["expires_at"]:
        db_exec("DELETE FROM verification_codes WHERE email = %s", (email,))
        raise HTTPException(400, "Code expired. Request a new one.")
    if record["code"] != req.code.strip():
        raise HTTPException(400, "Incorrect code. Try again.")
    db_exec("DELETE FROM verification_codes WHERE email = %s", (email,))
    db_exec("INSERT INTO users (email,name,password_hash,verified,created_at) VALUES (%s,%s,%s,1,%s)",
            (email, req.name, hash_password(req.password), int(time.time())))
    user = db_exec("SELECT * FROM users WHERE email = %s", (email,), fetch="one")
    token = make_token()
    db_exec("INSERT INTO sessions (token,user_id,created_at) VALUES (%s,%s,%s)",
            (token, user["id"], int(time.time())))
    return {"token":token,"user":{"id":user["id"],"name":user["name"],"email":user["email"]}}

@app.post("/auth/login")
def login(req: LoginRequest):
    user = db_exec("SELECT * FROM users WHERE email = %s", (req.email.lower().strip(),), fetch="one")
    if not user or user["password_hash"] != hash_password(req.password):
        raise HTTPException(401, "Invalid email or password")
    token = make_token()
    db_exec("INSERT INTO sessions (token,user_id,created_at) VALUES (%s,%s,%s)",
            (token, user["id"], int(time.time())))
    return {"token":token,"user":{"id":user["id"],"name":user["name"],"email":user["email"]}}

@app.post("/auth/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    db_exec("DELETE FROM sessions WHERE token = %s", (credentials.credentials,))
    return {"ok":True}

@app.get("/auth/me")
def me(user=Depends(get_current_user)):
    return {"id":user["id"],"name":user["name"],"email":user["email"]}

# ── Resume CRUD ───────────────────────────────────────────────────────────

@app.get("/resumes")
def list_resumes(user=Depends(get_current_user)):
    rows = db_exec("SELECT id,title,created_at,updated_at FROM resumes WHERE user_id=%s ORDER BY updated_at DESC",
                   (user["id"],), fetch="all")
    return [dict(r) for r in rows] if rows else []

@app.post("/resumes")
def save_resume(req: SaveResumeRequest, user=Depends(get_current_user)):
    now = int(time.time())
    db_exec("INSERT INTO resumes (user_id,title,data,created_at,updated_at) VALUES (%s,%s,%s,%s,%s)",
            (user["id"], req.title, json.dumps(req.data), now, now))
    row = db_exec("SELECT id FROM resumes WHERE user_id=%s ORDER BY created_at DESC LIMIT 1",
                  (user["id"],), fetch="one")
    return {"id":row["id"],"title":req.title}

@app.get("/resumes/{rid}")
def get_resume(rid: int, user=Depends(get_current_user)):
    row = db_exec("SELECT * FROM resumes WHERE id=%s AND user_id=%s", (rid,user["id"]), fetch="one")
    if not row: raise HTTPException(404, "Resume not found")
    r = dict(row); r["data"] = json.loads(r["data"])
    return r

@app.put("/resumes/{rid}")
def update_resume(rid: int, req: SaveResumeRequest, user=Depends(get_current_user)):
    existing = db_exec("SELECT id FROM resumes WHERE id=%s AND user_id=%s", (rid,user["id"]), fetch="one")
    if not existing: raise HTTPException(404, "Resume not found")
    db_exec("UPDATE resumes SET title=%s,data=%s,updated_at=%s WHERE id=%s",
            (req.title, json.dumps(req.data), int(time.time()), rid))
    return {"id":rid,"title":req.title}

@app.delete("/resumes/{rid}")
def delete_resume(rid: int, user=Depends(get_current_user)):
    db_exec("DELETE FROM resumes WHERE id=%s AND user_id=%s", (rid,user["id"]))
    return {"ok":True}

# ── AI Routes ─────────────────────────────────────────────────────────────

@app.post("/generate")
def generate_resume(data: ResumeData, user=Depends(get_current_user)):
    try:
        return agent_orchestrator(data.dict(), jd=data.job_description or "", mode="generate")
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/parse-pdf")
async def parse_pdf(file: UploadFile = File(...), user=Depends(get_current_user)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "File must be a PDF")
    contents = await file.read()
    reader = PdfReader(io.BytesIO(contents))
    raw_text = "\n".join(page.extract_text() or "" for page in reader.pages)
    if not raw_text.strip(): raise HTTPException(400, "No text found in PDF")
    try:
        return agent_parser(raw_text)
    except Exception as e:
        raise HTTPException(500, str(e))

@app.post("/improve")
def improve_resume(req: ImproveRequest, user=Depends(get_current_user)):
    try:
        return agent_orchestrator(req.resume, jd=req.job_description or "", mode="improve")
    except Exception as e:
        raise HTTPException(500, str(e))
