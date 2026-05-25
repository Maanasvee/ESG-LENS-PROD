# ESG Lens by Bevolve.ai

**Agentic ESG Policy Intelligence Platform** — monitors global and India-specific regulatory sources, classifies new policies using an AI agent pipeline, routes them through a Human-in-the-Loop editorial gate, and delivers verified policy intelligence to CSO users. 

Constructed with a premium, minimal **light enterprise SaaS design system** styled in professional deep-teal and emerald tones inspired by the **Sustainable Views** platform — corporate-ready, investor-grade, and free of all generic placeholder styling.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    GitHub Actions (Cron)                 │
│  • /run-pipeline every 30 min                           │
│  • /run-digest?phase=generate at 7:30 PM IST            │
│  • /run-digest?phase=dispatch at 8:00 AM IST            │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP (Pipeline Secret)
┌──────────────────────▼──────────────────────────────────┐
│                  FastAPI Backend (Railway)               │
│                                                         │
│  LangGraph Pipeline:                                    │
│  Scraper → Dedup → Classifier → Normaliser → DB → Alert │
│                                                         │
│  Services: PostgreSQL · ChromaDB · Firebase FCM · Resend│
└──────────────┬────────────────────────────────┬─────────┘
               │ SQLAlchemy                      │ REST API
  ┌────────────▼────────┐          ┌────────────▼──────────┐
  │   PostgreSQL (DB)   │          │   Next.js (Vercel)    │
  │   ChromaDB (vector) │          │   User Dashboard      │
  └─────────────────────┘          │   Admin Dashboard     │
                                   └───────────────────────┘
```

---

## Monorepo Structure

```
esglens/
├── backend/          # FastAPI + LangGraph (deploys to Railway)
├── frontend/         # Next.js 14 App Router (deploys to Vercel)
└── .github/
    └── workflows/    # GitHub Actions cron jobs
```

---

## Quick Start (Development)

### 1. Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL 15+ (or use Railway locally via tunnel)
- Git

### 2. Clone & Setup Backend

```bash
cd backend
cp .env.example .env
# Fill in all values in .env (see sections below)

pip install -r requirements.txt
playwright install chromium

# Run migrations (auto-runs on startup, but can run manually):
# alembic upgrade head

uvicorn app.main:app --reload --port 8000
```

### 3. Setup Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Fill in Firebase config values (see section below)

npm install
npm run dev
# Opens at http://localhost:3000
```

---

## 🔥 Firebase Setup (Required)

Firebase provides Authentication and Cloud Messaging (FCM). Follow these steps exactly:

### Step 1 — Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** → name it `eslens-bevolve` (or any name)
3. Disable Google Analytics (optional)
4. Click **"Create project"**

### Step 2 — Enable Authentication
1. In your Firebase project → **Build → Authentication**
2. Click **"Get started"**
3. Enable these Sign-in providers:
   - **Google** → Enable → set support email → Save
   - **Email/Password** → Enable → Save

### Step 3 — Enable Cloud Messaging (FCM)
1. Go to **Project Settings** (gear icon) → **Cloud Messaging** tab
2. Enable **Firebase Cloud Messaging API** (click the three-dot menu if needed)
3. Under **Web Push certificates**, click **"Generate key pair"**
4. Copy the **VAPID public key** — you'll need it for `NEXT_PUBLIC_FIREBASE_VAPID_KEY`

### Step 4 — Get Frontend Config
1. Go to **Project Settings** → **General** tab
2. Scroll to **"Your apps"** → click **"Add app"** → choose **Web** (`</>`)
3. Register app with nickname `ESG Lens Frontend`
4. Copy the `firebaseConfig` object values into your `frontend/.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
NEXT_PUBLIC_FIREBASE_VAPID_KEY=BNxx...  # From Step 3
```

### Step 5 — Get Backend Service Account Key
1. Go to **Project Settings** → **Service accounts** tab
2. Click **"Generate new private key"**
3. Download the JSON file
4. Place it at `backend/firebase-service-account.json`
5. Add to `backend/.env`:
```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

> ⚠️ **Security**: Never commit `firebase-service-account.json` to git. It's in `.gitignore`.

### Step 6 — Create Admin User (Role Management)

#### Development / Local Testing (Bypass Mode):
The system is equipped with an intelligent, domain-based development authenticator. During local development, you do not need to configure complex database records or run SQL scripts:
* **Editorial Manager (Admin)**: Simply log in with any email ending in **`@bevolve.ai`** (e.g., `maanas@bevolve.ai`, `admin@bevolve.ai`) or containing the word `admin`. The auth system will automatically register you in the local database and grant you full **Editorial Manager** access!
* **Policy Analyst (User)**: Log in with any standard email (e.g., your actual Google/Gmail IDs like `user@gmail.com`). The system will register you as a **Policy Analyst** to access the premium user feed.

#### Production Mode (Firebase & PostgreSQL):
After deploying to production and logging in via Google SSO or Email for the first time:
1. Log in with the target admin email at `/login` to create the initial user row.
2. Run this SQL query in your database console to elevate your account to the Admin role:
```sql
UPDATE users SET role = 'admin' WHERE email = 'your-admin@bevolve.ai';
```

---

## 🤖 LLM API Keys

### Google Gemini (Primary LLM)
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **"Create API Key"**
3. Add to `backend/.env`: `GOOGLE_API_KEY=AIzaSy...`

**Free tier limits**: 15 RPM, 1M TPM — sufficient for 5–20 new policies/day.

### Groq API (Fallback LLM)
1. Go to [Groq Console](https://console.groq.com/keys)
2. Create an API key
3. Add to `backend/.env`: `GROQ_API_KEY=gsk_...`

**Free tier**: generous for fallback use.

---

## 📧 Resend Email Setup

1. Go to [Resend](https://resend.com) → create account
2. Add and verify your domain (or use `onboarding@resend.dev` for testing)
3. Create an API key at [resend.com/api-keys](https://resend.com/api-keys)
4. Add to `backend/.env`:
```bash
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=eslens@yourdomain.com
```

**Free tier**: 3,000 emails/month — sufficient at launch.

---

## 🚀 Deployment

### Backend → Railway

1. Create account at [Railway](https://railway.app)
2. New Project → **"Deploy from GitHub repo"**
3. Select your forked repo → set **Root Directory** to `backend/`
4. Railway auto-detects the `Dockerfile`
5. Add a **PostgreSQL** plugin to your Railway project (free 500MB)
6. Railway auto-injects `DATABASE_URL` — copy it for reference
7. Add all env vars from `backend/.env` to Railway's **Variables** tab:
   - `GOOGLE_API_KEY`, `GROQ_API_KEY`
   - `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON` (paste JSON as string)
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
   - `PIPELINE_SECRET` (generate with `openssl rand -hex 32`)
   - `FRONTEND_URL` (your Vercel URL, added after frontend deploy)
8. Deploy. Your backend URL will be `https://your-service.up.railway.app`

### Frontend → Vercel

1. Go to [Vercel](https://vercel.com) → New Project → Import from GitHub
2. Set **Root Directory** to `frontend/`
3. Framework: Next.js (auto-detected)
4. Add all env vars from `frontend/.env.local` to Vercel's Environment Variables
5. Set `NEXT_PUBLIC_API_URL` to your Railway backend URL
6. Deploy. Your URL will be `https://your-app.vercel.app`

### GitHub Actions Setup (Cron Jobs)

1. Go to your repo on GitHub → **Settings → Secrets and variables → Actions**
2. Add these repository secrets:
   - `RAILWAY_BACKEND_URL` = `https://your-service.up.railway.app`
   - `PIPELINE_SECRET` = same value as backend env var

The three workflows in `.github/workflows/` will automatically run:
- **pipeline.yml** — every 30 minutes (scrape → classify → store)
- **digest_generate.yml** — daily at 7:30 PM IST (generate personalised briefs)
- **digest_dispatch.yml** — daily at 8:00 AM IST (send emails via Resend)

### Custom Domain (Optional)
To serve at `eslens.bevolve.ai`:
1. In Vercel: Project → Domains → Add `eslens.bevolve.ai`
2. Add CNAME record at your DNS: `eslens → cname.vercel-dns.com`

---

## 📁 Source Management

All 30+ data sources are pre-seeded from `config.yaml` on first startup. Admins can:
- **Add new sources** via `/admin/sources` UI → persisted to PostgreSQL + synced to `config.yaml`
- **Toggle sources on/off** without touching code
- **Edit polling frequency** per source
- **Add custom CSS selectors** for new Playwright portals

---

## 🔧 Modifying Without Code Changes

Edit `backend/config.yaml` to:
- Add/remove sources
- Modify the classification prompt
- Change urgency alert thresholds (which statuses/urgencies trigger immediate FCM)
- Adjust digest schedule
- Add new policy aliases

The config is hot-reloaded via the Admin Sources UI.

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL async connection string |
| `GOOGLE_API_KEY` | ✅ | Gemini API key |
| `GROQ_API_KEY` | ✅ | Groq API key (fallback LLM) |
| `FIREBASE_PROJECT_ID` | ✅ | Firebase project ID |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | ✅ | Path to service account JSON |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | — | JSON string (alternative to file) |
| `RESEND_API_KEY` | ✅ | Resend API key |
| `RESEND_FROM_EMAIL` | ✅ | Verified sender email |
| `PIPELINE_SECRET` | ✅ | Shared secret for cron endpoint |
| `FRONTEND_URL` | ✅ | For CORS (your Vercel URL) |
| `CHROMA_PERSIST_DIR` | — | ChromaDB storage path (default: `./chroma_data`) |
| `APP_ENV` | — | `development` or `production` |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend URL (`http://127.0.0.1:8000` for local dev; Railway for prod) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | ✅ | Firebase web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | ✅ | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ✅ | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | ✅ | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ✅ | FCM sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | ✅ | Firebase app ID |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | ✅ | FCM VAPID key for web push |

### GitHub Actions Secrets

| Secret | Description |
|---|---|
| `RAILWAY_BACKEND_URL` | Your Railway backend URL |
| `PIPELINE_SECRET` | Same as backend `PIPELINE_SECRET` |

---

## Tech Stack

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | Next.js 14 (App Router) | Vercel (free) |
| Backend API | FastAPI + Python 3.11 | Railway (free) |
| Agent Pipeline | LangGraph | — (runs in FastAPI) |
| Primary LLM | Gemini 2.0 Flash | Google AI (free tier) |
| Fallback LLM | Llama 3.3 70B | Groq (free tier) |
| Embeddings | Gemini text-embedding-004 | Google AI (free tier) |
| Vector Store | ChromaDB (self-hosted) | Railway (in-process) |
| Primary DB | PostgreSQL | Railway plugin (free 500MB) |
| Auth | Firebase Authentication | Google (free) |
| Push Notifications | Firebase Cloud Messaging | Google (free) |
| Web Scraping | Playwright (Chromium) | Railway |
| RSS Ingestion | feedparser | — |
| Email Delivery | Resend | Resend (free 3k/mo) |
| Scheduler | GitHub Actions Cron | GitHub (free 2k min/mo) |

**Total recurring cost at launch: ₹0**

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes to `backend/` or `frontend/` (never mix)
4. Push to `main` → auto-deploys to Railway (backend) and Vercel (frontend)
5. End-to-end deploy time: < 3 minutes

---

*Built with ❤️ by [Bevolve.ai](https://bevolve.ai)*
