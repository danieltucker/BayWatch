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

## [0.5.0] — 2026-05-19

### Added
- **Quake-style log console** — press backtick (`` ` ``) to slide down a terminal-style overlay that streams live backend logs at 1 Hz; auto-scrolls to latest entry; opens automatically when a scan is triggered
- **Manual drive entry** — clicking an empty bay slot opens a form modal to create and assign a drive without scanning; fields: serial (required), make, model, size, form factor, device path, type (SSD / HDD rpm)
- **`POST /api/drives`** — new endpoint to create a drive record manually (returns 201; 409 on duplicate serial)
- **`GET /api/drives/logs`** — streams in-memory log ring buffer entries; accepts `after` cursor for incremental polling
- **`backend/services/log_buffer.py`** — thread-safe in-memory ring buffer (500 entries); custom `logging.Handler` captures all Python log output; installed at startup

### Changed
- **Settings moved to modal** — Settings is now a tabbed modal dialog (Enclosures | Notifications | Import) triggered from the nav bar; the `/settings` page route has been removed
- **Scanner preserves manually-entered data** — identity fields (make, model, capacity, form factor, firmware, rpm) are only written if currently null; SMART telemetry (status, temperature, power-on hours, reallocated/pending/uncorrectable sectors) always updates
- **Scanner now logs progress** — "Scan started", devices discovered, per-drive new/updated messages for log console visibility

### Fixed
- **Route order bug** — `GET /api/drives/logs` was declared after `GET /api/drives/{serial}`, causing FastAPI to match `logs` as a serial value (404). Route is now correctly ordered before the `/{serial}` catch-all.

---

## [0.4.0] — 2026-05-19

### Fixed
- **TrueNAS deployment** — removed explicit `networks: driver: bridge` block from `docker-compose.truenas.yml`; TrueNAS Scale manages its own bridge network and rejected the override. All services remain reachable by name on Docker's default network.

### Added
- **`docker-compose.truenas.yml`** — dedicated compose file for TrueNAS Scale; no custom network block, path quoted for pool name with spaces
- **CSV import** — `POST /api/drives/import` accepts a `.csv` file and upserts Drive + DriveProfile records, with optional bay assignment by position label
  - Supported columns: Position, Dev Name, Make, Model, Serial, Size, Mfg Date, Source, Warranty, Notes (all optional except Serial)
  - Size parsed from `4 TB` / `500 GB` / `4000 GB` etc.
  - Warranty parsed from plain integer months, `24 months`, `2 years`
  - Mfg Date parsed from `YYYY-MM-DD`, `MM/DD/YYYY`, `DD/MM/YYYY`
  - Position matched case-insensitively to bay labels; ambiguous or missing matches reported in response
  - Returns `{imported, updated, assigned, skipped}` summary
- **`mfg_date` field** on `DriveProfile` — stores manufacturing date imported from CSV or entered manually
- **CSV import UI** in Settings page — file picker with upload button, success summary (new/updated/assigned counts), skipped-row detail, and error display
- **`python-multipart`** dependency added to backend for multipart file upload support

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
