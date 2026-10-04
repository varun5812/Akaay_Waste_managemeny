# WasteWise

WasteWise is a complete local demonstration of a waste-management assistant, adapted from the supplied TechnologyMate starter application and the attached product brief.

## Features

- Resident chatbot for schedules, sorting guidance, e-waste, bulky-waste bookings, and missed-collection reporting.
- Voice bot using browser speech recognition (Chrome/Edge), the same backend AI service, and browser text-to-speech responses.
- Request and complaint forms persisted to local SQLite (`backend/wastewise.db`, created automatically).
- Chatbot and voice-bot dashboard metrics alongside operational KPI cards, collection-category chart, and recent activity tables.
- Seeded areas, waste types, schedules, collection centres, and representative activity. No API keys are required.

## Run it

Open four separate terminals from this project directory:

### Terminal 1: Citizen / User Backend API (Port 5056)
```powershell
cd backend
py -m pip install -r requirements.txt
py -m uvicorn user_app:app --reload --port 5056
# or alternatively: py user_app.py
```
*API Swagger Docs:* `http://localhost:5056/docs`

### Terminal 2: Citizen Public Frontend (Port 3056)
```powershell
cd frontend
npm install
npm run dev
```
*Citizen Portal:* `http://localhost:3056`

### Terminal 3: Municipal Admin Backend API (Port 5057)
```powershell
cd backend
py -m uvicorn admin_app:app --reload --port 5057
# or alternatively: py admin_app.py
```
*Admin API Swagger Docs:* `http://localhost:5057/docs`

### Terminal 4: Municipal Admin Command Portal (Port 3057)
```powershell
cd admin_portal
npm install
npm run dev
```
*Admin Portal:* `http://localhost:3057`  
*(Login: `admin` / `admin2026`)*

## API & Cloud Routing Convention

All backend routes are unified and namespaced under the `/api` prefix to ensure seamless reverse-proxy routing, load-balancing, and zero-configuration cloud deployments (e.g. Render, Vercel, AWS, Railway, Nginx):

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api` | GET | Root API status & route discovery |
| `/api/health` | GET | Service liveness & health check |
| `/api/areas` | GET | List registered wards & collection zones |
| `/api/waste-types` | GET | List waste classification streams & color codes |
| `/api/schedules` | GET | Ward collection schedules |
| `/api/centers` | GET | Drop-off & recycling centres |
| `/api/chat` | POST | 3-Level AI Citizen Chatbot (L1 FAQ, L2 RAG, L3 LLM) |
| `/api/voice/process` | POST | Voice assistant speech processing & audio response |
| `/api/complaints` | POST | Resident issue registration & SMS dispatch |
| `/api/complaints/track/{code}` | GET | Real-time issue tracking & SLA timeline |
| `/api/admin/login` | POST | Administrator JWT authentication |
| `/api/admin/metrics` | GET | Operational KPIs, AI telemetry, & Ward Scorecards |
| `/api/admin/issues` | GET | Filterable civic incident registry |
| `/api/admin/issues/{id}` | GET / PATCH | Issue audit details & status lifecycle updates |
| `/api/admin/chat-logs` | GET | AI query inspection logs & latency telemetry |
| `/api/admin/areas` | POST | Register new municipal ward & initialize schedules |

Interactive Swagger / OpenAPI docs are available at `/docs` (or `http://localhost:5056/docs`).

## Cloud Deployment Guide

Set the `NEXT_PUBLIC_API_URL` environment variable on your frontend / admin portal hosting (Vercel, Netlify, Cloudflare Pages):
```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```
The built-in `buildApiUrl()` automatically handles trailing slashes, prefixes `/api`, and prevents duplicate `/api/api` paths.

## Architecture

1. **Presentation Layer:** Next.js resident portal, floating AI chatbot & voice assistant, plus the CleanCity Command Centre admin portal.
2. **Application Layer:** FastAPI backend featuring 3-level AI routing (`ai_engine.py`), SMS notifications (Twilio / Fast2SMS), and audit logs.
3. **Data Layer:** SQLite (`backend/wastewise.db`) storing municipal wards, schedules, complaints, and AI telemetry logs.
