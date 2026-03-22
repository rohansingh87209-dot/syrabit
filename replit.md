# Syrabit.ai - AHSEC AI-Powered Educational Platform

## Overview
Syrabit.ai is an AI-powered exam prep platform for AHSEC (Class 11-12) and Degree students (B.Com, B.A, B.Sc). It provides syllabus-aligned answers, PYQ insights, and a credit system for Assam students.

## Architecture

### Frontend (React + CRA + CRACO)
- Located in `/frontend`
- Runs on port **5000** (dev server via `PORT=5000 npm start`)
- Uses CRACO for webpack customization
- Key tech: React 19, React Router 7, TanStack Query, Tailwind CSS, Framer Motion
- Backend URL configured via `REACT_APP_BACKEND_URL` in `frontend/.env`

### Backend (FastAPI + Python)
- Located in `/backend`
- Runs on port **8000** (uvicorn dev server)
- Key tech: FastAPI, Motor (async MongoDB), Supabase, JWT auth, Redis (Upstash)
- Config in `backend/.env`
- Entry point: `backend/server.py`
- Local `emergentintegrations` package at `backend/emergentintegrations/` handles LLM calls

### Database
- Primary: MongoDB (`mongodb://localhost:27017`) — for content/syllabus data (boards, subjects, chapters, chunks). **Only available in development** (local mongod process). In production, backend gracefully handles MongoDB unavailability — content endpoints return empty arrays, dashboard returns 0 for subjects count, health shows "unavailable" status instead of crashing.
- Users/Auth: Supabase (`https://czeznmqogtwecidhpysa.supabase.co`) — always available in both dev and production
- Redis (Upstash): Rate limiting and caching with in-memory fallback
- MongoDB availability check: Fast-fail pattern with 60-second cooldown (`is_mongo_available()`) to avoid 5-second timeouts on every request when MongoDB is down

## Workflows
- **MongoDB**: `mkdir -p /home/runner/workspace/mongodb/data && mongod --dbpath /home/runner/workspace/mongodb/data --bind_ip 127.0.0.1 --port 27017 --noauth`
- **Backend API**: `cd backend && PORT=8000 python3 -m uvicorn server:app --host localhost --port 8000 --reload` (port 8000, console)
- **Start application**: `cd frontend && PORT=5000 npm start` (port 5000, webview)

## Key Configuration

### backend/.env
- `MONGO_URL=mongodb://localhost:27017` — local MongoDB
- `LLM_PROVIDER=groq` — active LLM provider
- `LLM_MODEL=openai/gpt-oss-20b` — Groq model (GPT-OSS-20B via Groq)
- `FIREWORKS_API_KEY` — kept for fallback (account is currently suspended)
- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` — for user storage
- `REDIS_URL` — Upstash Redis for caching/rate-limiting
- `ADMIN_EMAIL=admin@syrabit.ai` / `ADMIN_PASSWORD` — admin panel credentials

### Replit Secrets (environment variables)
- `GROQ_API_KEY` — active LLM API key (Groq, free tier) — **required for AI chat**

### frontend/.env
- `REACT_APP_BACKEND_URL=http://localhost:8000`

### CORS
- Configured in `backend/.env` via `CORS_ORIGINS`
- Includes localhost:5000, localhost:3000, and the Replit dev domain

## Auth Design (dual-mode)
- Backend returns JWT `access_token` in response body on signup/login
- Frontend stores token in `localStorage` (`syrabit:token`) and sends as `Authorization: Bearer` header
- Backend also sets `httponly` cookie (`syrabit_session`) as fallback for browsers that support it
- Cookie security: controlled by `SECURE_COOKIES` env var (`false` in dev = `SameSite=lax` no Secure flag; `true` in prod = `SameSite=none; Secure`)
- Admin token stored separately in `sessionStorage` (`syrabit:admin_token`) — cleared on tab close for GDPR compliance

## Feature Status (all working)
- Auth: signup, login, logout — dual Bearer token (localStorage) + cookie, works on both HTTP dev and HTTPS prod
- Library: 50 AHSEC subjects across boards/classes/streams, chapter browser
- AI Chat: fully functional via Groq (GPT-OSS-20B), native token-by-token streaming at max throughput (~240 tokens/sec), `<think>` tag filtering (cross-chunk safe), 6-message conversation history window, max_tokens=2048, with RAG, web search fallback, credit deduction
- **RAG System (Library Search + Syllabus Injection)** ✅ **COMPLETE**:
  - `GET /api/library_search?board={board}&class={class}&subject={subject}&chapter={chapter}&query={text}` — Queries MongoDB library_scrapes collection
  - `GET /api/syllabi/{board_id}/{class_id}` — Fetches syllabus for board/class (no auth)
  - `POST /api/admin/syllabi/{board_id}/{class_id}` — Creates/updates syllabus (admin auth)
  - `DELETE /api/admin/syllabi/{board_id}/{class_id}` — Deletes syllabus (admin auth)
  - **Chat Endpoint Integration** ✅: Both `/ai/chat` and `/ai/chat/stream` automatically:
    1. Fetch syllabus for `board_id`/`class_id` from request
    2. Inject syllabus as Tier -1 grounding (curriculum constraints) into system prompt
    3. Syllabus persists even when document/RAG content is present
  - **Admin Syllabus Manager** ✅ (NEW): Tab in Content Editor to create/edit/delete syllabi:
    - Select board + class → Add universal syllabus content
    - Define key topics, chapters, learning guidelines
    - Save → Automatically injected into all future chat answers for that board/class
  - **Frontend Integration** ✅: ChatPage now sends `board_id`/`class_id` in every chat request
    - Auto-injects user's board/class syllabus without requiring manual selection
    - Syllabus applies to all students with matching profile
- Frontend: MessageBubble memoized with React.memo, smooth auto-scroll with `behavior: 'smooth'`
- Library page: Optimized with memoized enrichment (O(1) lookups via Maps), memoized filtering, SubjectCard memoized, **all PDF features removed for instant load**
- UI/UX Design: **Professional startup aesthetic.** Animated mesh backgrounds (30s cycle, subtle radial gradients), grid overlay (70px pattern, 0.08 opacity), glassmorphism (10px blur + 1.2x saturate), glow borders (fade in on hover), 3D card lift (translateY -4px). All pages smooth with clean transitions (0.2-0.3s ease). AppLayout properly renders background elements for all pages.
- Cleanup: Removed 2 dead components (DocumentViewerModal, PdfViewer). Kept necessary dependencies (react-pdf used by AdminContentEditor for PDF upload). Build optimized with tree-shaking enabled. All production pages verified functional.
- Credit system: 30 credits on signup, 1 per chat message
- Admin panel: `/admin/login` — manage users, content, analytics (now resilient to MongoDB downtime in production)
- History: saved conversations per user
- Profile: credit balance, usage stats
- **MongoDB Resilience (Fixed):** All content read endpoints (library-bundle, search, chunks, documents, etc.) gracefully return empty arrays when MongoDB unavailable. Admin write endpoints (seed, create board/class/stream/subject) return clear 503 errors instead of crashing. Fast-fail pattern with `is_mongo_available()` check + 60s cache cooldown prevents timeout hangs. `mark_mongo_down()` helper immediately invalidates cache on failures.

## Deployment
- Build: compiles React frontend into `frontend/build`
- Run: gunicorn serves FastAPI + static React files
- Config: `backend/gunicorn.conf.py`

## Known Non-Issues
- `WebSocket to ws://localhost:443/ws failed` in browser console — harmless CRA dev HMR via Replit proxy, not a real error
- `duckduckgo-search` package renamed to `ddgs` — warning appears but instant-answer fallback still works
