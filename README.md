# matchr — AI recruitment matching platform

## What it does
Candidates upload resume → AI parses + embeds → matched to jobs via pgvector cosine similarity.
Recruiters post jobs in plain text → AI structures them → get ranked candidate list.
Points system rewards profile completion. Stripe handles recruiter subscriptions.

## Architecture
Frontend: Next.js 16 (localhost:3000) → deployed to Vercel
Backend:  FastAPI (localhost:8000) → deployed to Railway
Database: PostgreSQL + pgvector (Railway)
Auth:     Supabase (Google OAuth, JWT validation)

## Local stack — what runs where
All services run LOCALLY. No external servers needed except:
- DeepSeek API (resume/job parsing) — platform.deepseek.com, free tier available
- OpenAI API (embeddings only) — platform.openai.com, ~$0.001 per resume
- Stripe (payments) — dashboard.stripe.com, test mode is free
- Supabase (auth) — supabase.com, free tier available
Everything works in mock mode if keys are missing.

## Prerequisites
- Ubuntu 22.04+
- Python 3.11+  →  sudo apt install python3.11 python3.11-venv python3-pip
- Node.js 18+   →  sudo apt install nodejs npm  (or use nvm)
- PostgreSQL 16 →  sudo apt install postgresql-16 postgresql-16-contrib
- pgvector      →  sudo apt install postgresql-16-pgvector

## Setup — first time only

### 1. Clone and enter project
git clone <repo_url> && cd matchr

### 2. Database setup
sudo systemctl start postgresql
sudo -u postgres psql -c "CREATE USER matchr WITH PASSWORD 'matchr';"
sudo -u postgres psql -c "CREATE DATABASE matchr OWNER matchr;"
sudo -u postgres psql -d matchr -c "CREATE EXTENSION IF NOT EXISTS vector;"

### 3. Backend
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — fill in API keys (or leave empty for mock mode)
nano .env
uvicorn app.main:app --reload --port 8000

### 4. Frontend
cd ../frontend
npm install
cp .env.local.example .env.local  # or create from .env.production.example
npm run dev

### 5. Verify
curl http://localhost:8000/health  → {"status":"ok"}
open http://localhost:3000         → matchr landing page

## Environment variables

### backend/.env
```
DATABASE_URL=postgresql+asyncpg://matchr:matchr@localhost:5432/matchr
DEEPSEEK_API_KEY=        # optional — mock works without it
OPENAI_API_KEY=          # optional — mock works without it
STRIPE_SECRET_KEY=       # optional — mock checkout without it
STRIPE_STARTER_PRICE_ID= # create in Stripe dashboard
STRIPE_PRO_PRICE_ID=     # create in Stripe dashboard
SECRET_KEY=change-me-in-production
SUPABASE_URL=            # optional — mock auth without it
SUPABASE_JWT_SECRET=     # optional — no auth enforcement without it
ALLOWED_ORIGINS=http://localhost:3000
```

### frontend/.env.local
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=     # optional — mock auth without it
NEXT_PUBLIC_SUPABASE_ANON_KEY= # optional
```

## API keys — how to get them (all have free tiers)

### DeepSeek (resume parsing)
1. Go to platform.deepseek.com → Sign up → API Keys → Create key
2. Free credits on signup (~$5, enough for hundreds of resumes)

### OpenAI (embeddings)
1. Go to platform.openai.com → Sign up → API keys → Create key
2. text-embedding-3-small: $0.02/1M tokens (~$0.00001 per resume)

### Stripe (payments)
1. Go to dashboard.stripe.com → Sign up → use Test Mode
2. Developers → API keys → copy Secret key (starts with sk_test_)
3. Create two products: Starter $49/mo, Pro $149/mo → copy Price IDs

## Supabase setup (5 minutes)

1. Go to supabase.com → New project
2. Settings → API → copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL` (frontend) and `SUPABASE_URL` (backend)
   - anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - JWT Secret → `SUPABASE_JWT_SECRET` (backend only — keep secret)
3. Authentication → Providers → Google → Enable
   (needs Google OAuth credentials from console.cloud.google.com)
4. Authentication → URL Configuration:
   - **Local dev** — go to Supabase → Authentication → URL Configuration:
     - Site URL: `http://localhost:3000`
     - Redirect URLs: `http://localhost:3000/auth/callback`
   - **Production** — add your Vercel domain:
     - Site URL: `https://your-app.vercel.app`
     - Redirect URLs: `https://your-app.vercel.app/auth/callback`

## Deploy checklist
- [ ] Supabase project created, JWT secret copied
- [ ] Railway: new project from GitHub, Postgres plugin added
- [ ] Railway env vars set: `DATABASE_URL`, `SECRET_KEY`, `SUPABASE_JWT_SECRET`, `ALLOWED_ORIGINS`
- [ ] Vercel: frontend deployed, env vars set (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_*`)
- [ ] `ALLOWED_ORIGINS` set to Vercel domain in Railway (e.g. `https://matchr.vercel.app`)
- [ ] Test: sign in with Google → onboarding → dashboard → see real matches

## Running after setup (daily)
```bash
sudo systemctl start postgresql
cd matchr/backend && source venv/bin/activate && uvicorn app.main:app --reload &
cd matchr/frontend && npm run dev
```
