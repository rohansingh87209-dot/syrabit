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
- Also includes local `emergentintegrations` package for LLM integration

### Database
- Primary: MongoDB (`mongodb://localhost:27017`) - for content/syllabus data
- Fallback: Supabase - for users/conversations
- Redis (Upstash): Rate limiting and caching with in-memory fallback

## Workflows
- **Start application**: `cd frontend && PORT=5000 npm start` (port 5000, webview)
- **Backend API**: `cd backend && PORT=8000 python3 -m uvicorn server:app --host localhost --port 8000 --reload` (port 8000, console)

## Key Configuration
- `backend/.env`: All backend secrets/config (MongoDB URL, JWT secrets, LLM provider, Supabase keys)
- `frontend/.env`: `REACT_APP_BACKEND_URL=http://localhost:8000`
- CORS: Set `CORS_ORIGINS=*` in backend .env for development

## Deployment
- Deployment uses gunicorn to serve both the backend API and the built React frontend
- Build command builds the React frontend
- Run command: gunicorn serving the FastAPI app (which also serves static React files)
