from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
import os, json, sqlite3, hashlib, secrets, requests, io, time, re, random
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

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
DB_PATH = os.getenv("DB_PATH", "resume_ai.db")

# ── Database ──────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            verified INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS resumes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS verification_codes (
            email TEXT PRIMARY KEY,
            code TEXT NOT NULL,
            expires_at INTEGER NOT NULL
        );
    """)
    conn.commit()
    conn.close()

init_db()

# ── Auth helpers ──────────────────────────────────────────────────────────

def hash_password(p): return hashlib.sha256(p.encode()).hexdigest()
def make_token(): return secrets.token_hex(32)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    conn = get_db()
    session = conn.execute("SELECT user_id FROM sessions WHERE token = ?", (token,)).fetchone()
    if not session:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    user = conn.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return dict(user)

# ── Email via Resend ──────────────────────────────────────────────────────

def send_verification_email(email: str, code: str, name: str = ""):
    if not RESEND_API_KEY:
        raise Exception("RESEND_API_KEY not set in .env")
    
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8fafc;border-radius:16px">
      <div style="background:#2563eb;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <h1 style="color:white;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px">Resumepedia</h1>
        <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px">AI-powered resume builder</p>
      </div>
      <div style="background:white;border-radius:12px;padding:28px;border:1px solid #e2e8f0">
        <h2 style="margin:0 0 8px;color:#0f172a;font-size:18px">Verify your email</h2>
        <p style="color:#64748b;font-size:14px;margin:0 0 24px">
          {"Hi "+name+"! " if name else ""}Use the code below to verify your email address. It expires in <strong>10 minutes</strong>.
        </p>
        <div style="background:#eff6ff;border:2px dashed #3b82f6;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
          <p style="margin:0;font-size:42px;font-weight:800;letter-spacing:12px;color:#1d4ed8;font-family:monospace">{code}</p>
        </div>
        <p style="color:#94a3b8;font-size:12px;margin:0">If you didn't request this, you can safely ignore this email.</p>
      </div>
      <p style="color:#cbd5e1;font-size:11px;text-align:center;margin-top:16px">© Resumepedia</p>
    </div>
    """
    
    resp = requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
        json={
            "from": "Resumepedia <onboarding@resend.dev>",
            "to": [email],
            "subject": f"{code} — Your Resumepedia verification code",
            "html": html
        },
        timeout=15
    )
    if resp.status_code not in (200, 201):
        raise Exception(f"Email send failed: {resp.text[:200]}")
    return True

# ── Groq / Llama ──────────────────────────────────────────────────────────

def llm(prompt: str, system: str = "You are a helpful assistant.", temperature: float = 0.7) -> str:
    if not GROQ_API_KEY:
        raise Exception("GROQ_API_KEY not set in .env file")
    resp = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
        json={
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt}
            ],
            "temperature": temperature,
            "max_tokens": 4096
        },
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
            if block.startswith("{") or block.startswith("["):
                raw = block; break
    start, end = raw.find("{"), raw.rfind("}")
    if start != -1 and end != -1: raw = raw[start:end+1]
    raw = raw.replace("\u2018","'").replace("\u2019","'").replace("\u201c",'"').replace("\u201d",'"')
    raw = re.sub(r",\s*([}\]])", r"\1", raw)
    return raw.strip()

def resume_to_text(r: dict) -> str:
    exp = "\n".join([
        f"{e.get('role','')} at {e.get('company','')} ({e.get('duration','')}):\n" +
        "\n".join(f"  - {b}" for b in e.get("bullets", []))
        for e in r.get("experience", [])
    ])
    edu = "\n".join([
        f"{e.get('degree','')} — {e.get('institution','')} ({e.get('year','')})"
        for e in r.get("education", [])
    ])
    return f"""Name: {r.get('name','')}
Email: {r.get('email','')}
Phone: {r.get('phone','')}
Location: {r.get('location','')}
Summary: {r.get('summary','')}
Skills: {', '.join(r.get('skills', []))}
Experience:\n{exp}
Education:\n{edu}"""

SCHEMA = '{"name":"...","email":"...","phone":"...","location":"...","summary":"...","skills":["..."],"experience":[{"company":"...","role":"...","duration":"...","bullets":["..."]}],"education":[{"institution":"...","degree":"...","year":"..."}]}'

# ── Agents ────────────────────────────────────────────────────────────────

def agent_parser(raw_text: str) -> dict:
    result = llm(
        prompt=f"Extract all resume info from this text. Return ONLY raw JSON, no markdown.\n\nText:\n{raw_text[:4000]}\n\nReturn ONLY:\n{SCHEMA}",
        system="You are a precise data extraction agent. Return only valid JSON."
    )
    return json.loads(clean_json(result))

def agent_writer(resume: dict, jd: str = "") -> dict:
    jd_section = f"\nTarget Job:\n{jd}" if jd else ""
    result = llm(
        prompt=f"Rewrite this resume with powerful language. Return ONLY raw JSON, no markdown.\n\n{resume_to_text(resume)}{jd_section}\n\nRules:\n- Summary: 2-3 sentences, no 'I'\n- Every bullet: action verb + achievement + metric\n- Keep all names/dates exactly\n\nReturn ONLY:\n{SCHEMA}",
        system="You are an elite resume writer. Transform mediocre content into powerful descriptions."
    )
    return json.loads(clean_json(result))

def agent_critic(resume: dict, jd: str = "") -> dict:
    jd_section = f"\nJob Description:\n{jd}" if jd else ""
    result = llm(
        prompt=f"Analyze this resume critically. Return ONLY raw JSON, no markdown.\n\n{resume_to_text(resume)}{jd_section}\n\nReturn ONLY:\n{{\"overall_score\":0-100,\"ats_score\":0-100,\"scores\":{{\"impact\":0-100,\"clarity\":0-100,\"skills_match\":0-100,\"formatting\":0-100}},\"strengths\":[\"...\"],\"improvements\":[\"...\"],\"missing_keywords\":[\"...\"],\"verdict\":\"one sentence\"}}",
        system="You are a strict resume critic and experienced hiring manager. Be honest and specific.",
        temperature=0.3
    )
    return json.loads(clean_json(result))

def agent_tailor(resume: dict, jd: str) -> dict:
    if not jd:
        return {"tailored": False, "matched_keywords": [], "added_keywords": [], "resume": resume}
    result = llm(
        prompt=f"Tailor this resume to the job description. Return ONLY raw JSON, no markdown.\n\nResume:\n{resume_to_text(resume)}\n\nJob Description:\n{jd}\n\nDo NOT fabricate experience. Return ONLY:\n{{\"tailored\":true,\"matched_keywords\":[\"...\"],\"added_keywords\":[\"...\"],\"resume\":{SCHEMA}}}",
        system="You are a resume tailoring agent. Align resume to JD without fabricating experience."
    )
    return json.loads(clean_json(result))

def agent_cover_letter(resume: dict, jd: str = "") -> dict:
    jd_section = f"\nJob Description:\n{jd}" if jd else "\nWrite a strong general cover letter."
    result = llm(
        prompt=f"Write a compelling cover letter. Return ONLY raw JSON, no markdown.\n\nResume:\n{resume_to_text(resume)}{jd_section}\n\nReturn ONLY:\n{{\"subject\":\"Application for [Role] — [Name]\",\"body\":\"full cover letter with paragraph breaks\"}}",
        system="You are an expert cover letter writer. Write concise, compelling letters."
    )
    return json.loads(clean_json(result))

def agent_orchestrator(resume: dict, jd: str = "", mode: str = "generate") -> dict:
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
                agent_log.append({"agent": name, "status": "success"})
            except Exception as e:
                agent_log.append({"agent": name, "status": "error", "error": str(e)})
                results[name] = None

    if jd and results.get("tailor") and results["tailor"].get("resume"):
        final_resume = results["tailor"]["resume"]
        agent_log.append({"agent": "orchestrator", "decision": "using tailor output"})
    elif results.get("writer"):
        final_resume = results["writer"]
        agent_log.append({"agent": "orchestrator", "decision": "using writer output"})
    else:
        final_resume = resume
        agent_log.append({"agent": "orchestrator", "decision": "fallback to original"})

    return {
        "resume": final_resume,
        "critique": results.get("critic"),
        "tailor_info": {
            "matched_keywords": results["tailor"].get("matched_keywords", []) if results.get("tailor") else [],
            "added_keywords": results["tailor"].get("added_keywords", []) if results.get("tailor") else [],
        } if jd else None,
        "cover_letter": results.get("cover_letter"),
        "agent_log": agent_log,
        "time_taken": round(time.time() - start, 2)
    }

# ── Models ────────────────────────────────────────────────────────────────

class SendCodeRequest(BaseModel):
    email: str
    name: Optional[str] = ""

class VerifyCodeRequest(BaseModel):
    email: str
    code: str
    name: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

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
    resume: dict
    job_description: Optional[str] = ""

# ── Auth Routes ───────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "Resumepedia running"}

@app.post("/auth/send-code")
def send_code(req: SendCodeRequest):
    email = req.email.lower().strip()
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        raise HTTPException(400, "Invalid email address")

    # Check if already registered
    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    if existing:
        raise HTTPException(400, "Email already registered. Please sign in instead.")

    # Generate 6-digit code
    code = str(random.randint(100000, 999999))
    expires_at = int(time.time()) + 600  # 10 minutes

    conn = get_db()
    conn.execute("INSERT OR REPLACE INTO verification_codes (email, code, expires_at) VALUES (?,?,?)",
                 (email, code, expires_at))
    conn.commit()
    conn.close()

    try:
        send_verification_email(email, code, req.name)
    except Exception as e:
        raise HTTPException(500, f"Failed to send email: {str(e)}")

    return {"message": "Verification code sent to your email"}

@app.post("/auth/verify-and-signup")
def verify_and_signup(req: VerifyCodeRequest):
    email = req.email.lower().strip()

    conn = get_db()
    record = conn.execute(
        "SELECT code, expires_at FROM verification_codes WHERE email = ?", (email,)
    ).fetchone()

    if not record:
        conn.close()
        raise HTTPException(400, "No verification code found. Please request a new one.")

    if int(time.time()) > record["expires_at"]:
        conn.execute("DELETE FROM verification_codes WHERE email = ?", (email,))
        conn.commit(); conn.close()
        raise HTTPException(400, "Code expired. Please request a new one.")

    if record["code"] != req.code.strip():
        conn.close()
        raise HTTPException(400, "Incorrect code. Please try again.")

    # Code correct — create user
    conn.execute("DELETE FROM verification_codes WHERE email = ?", (email,))
    conn.execute(
        "INSERT INTO users (email, name, password_hash, verified, created_at) VALUES (?,?,?,1,?)",
        (email, req.name, hash_password(req.password), int(time.time()))
    )
    conn.commit()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    token = make_token()
    conn.execute("INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)",
                 (token, user["id"], int(time.time())))
    conn.commit(); conn.close()

    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"]}}

@app.post("/auth/login")
def login(req: LoginRequest):
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (req.email.lower().strip(),)).fetchone()
    if not user or user["password_hash"] != hash_password(req.password):
        conn.close()
        raise HTTPException(401, "Invalid email or password")
    token = make_token()
    conn.execute("INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)",
                 (token, user["id"], int(time.time())))
    conn.commit(); conn.close()
    return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"]}}

@app.post("/auth/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    conn = get_db()
    conn.execute("DELETE FROM sessions WHERE token = ?", (credentials.credentials,))
    conn.commit(); conn.close()
    return {"ok": True}

@app.get("/auth/me")
def me(user=Depends(get_current_user)):
    return {"id": user["id"], "name": user["name"], "email": user["email"]}

# ── Resume CRUD ───────────────────────────────────────────────────────────

@app.get("/resumes")
def list_resumes(user=Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute(
        "SELECT id,title,created_at,updated_at FROM resumes WHERE user_id=? ORDER BY updated_at DESC",
        (user["id"],)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/resumes")
def save_resume(req: SaveResumeRequest, user=Depends(get_current_user)):
    now = int(time.time())
    conn = get_db()
    conn.execute("INSERT INTO resumes (user_id,title,data,created_at,updated_at) VALUES (?,?,?,?,?)",
                 (user["id"], req.title, json.dumps(req.data), now, now))
    conn.commit()
    rid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()
    return {"id": rid, "title": req.title}

@app.get("/resumes/{rid}")
def get_resume(rid: int, user=Depends(get_current_user)):
    conn = get_db()
    row = conn.execute("SELECT * FROM resumes WHERE id=? AND user_id=?", (rid, user["id"])).fetchone()
    conn.close()
    if not row: raise HTTPException(404, "Resume not found")
    r = dict(row); r["data"] = json.loads(r["data"])
    return r

@app.put("/resumes/{rid}")
def update_resume(rid: int, req: SaveResumeRequest, user=Depends(get_current_user)):
    now = int(time.time())
    conn = get_db()
    if not conn.execute("SELECT id FROM resumes WHERE id=? AND user_id=?", (rid, user["id"])).fetchone():
        conn.close(); raise HTTPException(404, "Resume not found")
    conn.execute("UPDATE resumes SET title=?,data=?,updated_at=? WHERE id=?",
                 (req.title, json.dumps(req.data), now, rid))
    conn.commit(); conn.close()
    return {"id": rid, "title": req.title}

@app.delete("/resumes/{rid}")
def delete_resume(rid: int, user=Depends(get_current_user)):
    conn = get_db()
    conn.execute("DELETE FROM resumes WHERE id=? AND user_id=?", (rid, user["id"]))
    conn.commit(); conn.close()
    return {"ok": True}

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
    if not raw_text.strip():
        raise HTTPException(400, "No text found in PDF")
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
