# Changelog

All notable changes to Drive Position are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Planned
- Tests (backend scanner, route integration)
- SES auto-detection surfaced as bay assignment suggestions
- CSV/JSON export of drive inventory
- Optional basic auth

---

## [0.3.0] — 2026-05-18

### Added
- **SQLAlchemy models**: Enclosure, BayArray, Bay, Drive, DriveProfile, Alert, NotificationConfig
- **Scanner services**: `lsblk.py` (disk discovery + by-id resolution), `smartctl.py` (full SMART parse), `nvme.py` (NVMe enumeration), `ses.py` (SES slot detection, best-effort)
- **Scanner orchestrator** (`scanner.py`): upserts Drive rows from combined lsblk + smartctl data
- **REST API** — all routes fully implemented:
  - `GET/POST/PUT/DELETE /api/enclosures` + bay array sub-routes
  - `GET/PUT /api/bays/{id}/assign` (drive assignment with conflict clearing)
  - `GET /api/drives`, `POST /api/drives/scan` (async), `POST /api/drives/scan/sync`
  - `GET/PUT/DELETE /api/profiles/{serial}` (warranty + purchase metadata)
  - `GET /api/alerts`, `GET/PUT /api/alerts/config` (Telegram config + frequency)
- **Pydantic schemas** (`api/schemas.py`): request/response models for all entities
- **Notification service** (`notifications.py`): pluggable channel dispatch; `dispatch_critical` and `dispatch_status` helpers; Alert rows logged on send
- **Background scheduler** (`scheduler.py`): APScheduler with periodic scan + critical condition checks (SMART FAILED, overtemp, reallocated sectors) + daily status digest gated by config
- **Frontend — API client** (`src/api/client.js`): typed wrappers for all endpoints
- **Frontend — Components**: BayGrid (DnD via @dnd-kit), BaySlot, DriveCard, DriveList, ScanButton, WarningBadge
- **Frontend — Pages**: Dashboard (enclosure map + drive sidebar), DriveDetail (profile edit form), Settings (enclosure/array CRUD + Telegram config)
- **Frontend — App shell**: react-router with nav bar

---

## [0.2.0] — 2026-05-18

### Added
- `docker-compose.yml` — production orchestration (backend + nginx frontend, internal network)
- `docker-compose.dev.yml` — development overrides with hot reload
- `backend/Dockerfile` — multi-stage build (builder → slim runtime with smartmontools, nvme-cli)
- `frontend/Dockerfile` — multi-stage build (node builder → nginx static serve)
- `frontend/Dockerfile.dev` — vite dev server container
- `frontend/nginx.conf` — serves React SPA, proxies `/api/` to backend service
- `backend/requirements.txt` — FastAPI, SQLAlchemy, APScheduler, python-telegram-bot
- `backend/main.py` — FastAPI app with router registration and DB init on startup
- `backend/db/base.py` — SQLAlchemy engine, SessionLocal, DeclarativeBase
- `backend/api/deps.py` — DB session dependency injection
- Route stubs: drives, bays, enclosures, profiles, alerts
- Service stubs: scanner, smartctl, lsblk, nvme, ses, notifications
- Frontend skeleton: package.json, vite.config.js, tailwind, App.jsx, api/client.js
- `.env.example`, `.gitignore`

### Decisions locked
- Docker: `SYS_RAWIO` + `SYS_ADMIN` capabilities, no `privileged: true`
- Frontend: Vite + React 18 + Tailwind + dnd-kit (drag-and-drop bay assignment)
- No authentication in v1 (LAN-only deployment)

---

## [0.1.0] — 2026-05-18

### Added
- Project scaffolding: README.md, project/info.md, project/structure.md, project/changelog.md
- Defined data model for Drive, BayArray, Bay, Enclosure, DriveProfile, Alert, NotificationConfig
- Documented planned automation sources (smartctl, lsblk, udevadm, nvme-cli, SES)
- Established tech stack: FastAPI + React + SQLite + Docker + Telegram
