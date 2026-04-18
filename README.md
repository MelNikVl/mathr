7. Create README.md in project root with:

# matchr — AI recruitment matching platform

## What it does
Candidates upload resume → AI parses + embeds → matched to jobs via pgvector cosine similarity.
Recruiters post jobs in plain text → AI structures them → get ranked candidate list.
Points system rewards profile completion. Stripe handles recruiter subscriptions.

## Architecture
Frontend: Next.js 14 (localhost:3000) → deployed to Vercel
Backend:  FastAPI (localhost:8000) → deployed to Railway
Database: PostgreSQL + pgvector (Railway)
Cache:    Redis (Railway)

## Local stack — what runs where
All services run LOCALLY on your machine. No external servers needed except:
- DeepSeek API (resume/job parsing) — get key: platform.deepseek.com, free tier available
- OpenAI API (embeddings only) — get key: platform.openai.com, ~$0.001 per resume
- Stripe (payments) — get key: dashboard.stripe.com, test mode is free
Everything works with mock mode if keys are missing.

## Prerequisites
- Ubuntu 22.04+
- Python 3.11+  →  sudo apt install python3.11 python3.11-venv python3-pip
- Node.js 18+   →  sudo apt install nodejs npm  (or use nvm)
- PostgreSQL 16 →  sudo apt install postgresql-16 postgresql-16-contrib
- pgvector      →  sudo apt install postgresql-16-pgvector
- Redis         →  sudo apt install redis-server

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

# Run migrations
alembic upgrade head

# Start backend
uvicorn app.main:app --reload --port 8000

### 4. Frontend
cd ../frontend
npm install
cp .env.local.example .env.local
# Edit if needed (default points to localhost:8000)
npm run dev

### 5. Verify
curl http://localhost:8000/health  → {"status":"ok"}
open http://localhost:3000         → matchr landing page

## Environment variables

### backend/.env
DATABASE_URL=postgresql+asyncpg://matchr:matchr@localhost:5432/matchr
DEEPSEEK_API_KEY=        # optional — mock works without it
OPENAI_API_KEY=          # optional — mock works without it
STRIPE_SECRET_KEY=       # optional — mock checkout without it
STRIPE_STARTER_PRICE_ID= # create in Stripe dashboard
STRIPE_PRO_PRICE_ID=     # create in Stripe dashboard
SECRET_KEY=change-me-in-production

### frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=     # optional — mock auth without it
NEXT_PUBLIC_SUPABASE_ANON_KEY= # optional

## API keys — how to get them (all have free tiers)

### DeepSeek (resume parsing)
1. Go to platform.deepseek.com
2. Sign up → API Keys → Create key
3. Free credits on signup (~$5 worth, enough for hundreds of resumes)

### OpenAI (embeddings)
1. Go to platform.openai.com
2. Sign up → API keys → Create key
3. text-embedding-3-small costs $0.02 per 1M tokens
4. 1 resume ≈ 500 tokens = $0.00001 per resume

### Stripe (payments)
1. Go to dashboard.stripe.com
2. Sign up → use Test Mode (no real money)
3. Developers → API keys → copy Secret key (starts with sk_test_)
4. Create two products: Starter $49/mo, Pro $149/mo → copy Price IDs

## Running after setup (daily)
sudo systemctl start postgresql redis-server
cd matchr/backend && source venv/bin/activate && uvicorn app.main:app --reload &
cd matchr/frontend && npm run dev

## Deploy to production
Frontend → push to GitHub → connect repo to vercel.com → auto-deploy
Backend  → push to GitHub → connect repo to railway.app → add Postgres + Redis plugins
Update frontend .env.local: NEXT_PUBLIC_API_URL=https://your-backend.railway.app
