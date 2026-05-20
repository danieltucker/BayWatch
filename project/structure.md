# Project Structure

> Last updated: 2026-05-19
> Status: v0.5.0 — Settings modal, log console, manual drive entry

## Current Layout

```
drive-position/
├── README.md                       # Project overview and quick start
├── docker-compose.yml              # Production: backend + frontend services
├── docker-compose.truenas.yml      # TrueNAS Scale custom app YAML (no custom network block)
├── docker-compose.dev.yml          # Dev overrides (hot reload, port exposure)
├── .env.example                    # Environment variable template
├── .gitignore
├── project/
│   ├── info.md                     # LLM context: data model, tech stack, decisions
│   ├── structure.md                # This file
│   └── changelog.md                # Version history
│
├── backend/                        # Python FastAPI service
│   ├── Dockerfile                  # Multi-stage: builder + slim runtime
│   ├── .dockerignore
│   ├── requirements.txt
│   ├── main.py                     # FastAPI app entrypoint + router registration
│   ├── api/
│   │   ├── deps.py                 # Shared DI: DB session
│   │   └── routes/
│   │       ├── drives.py           # /api/drives — scan, list, get
│   │       ├── bays.py             # /api/bays — list, assign, unassign
│   │       ├── enclosures.py       # /api/enclosures — CRUD + bay arrays
│   │       ├── profiles.py         # /api/profiles — drive profile CRUD
│   │       └── alerts.py           # /api/alerts — list, config
│   ├── models/
│   │   ├── enclosure.py            # Enclosure ORM model
│   │   ├── bay_array.py            # BayArray ORM model
│   │   ├── bay.py                  # Bay ORM model
│   │   ├── drive.py                # Drive ORM model
│   │   ├── drive_profile.py        # DriveProfile ORM model (+ warranty helpers)
│   │   ├── alert.py                # Alert ORM model
│   │   └── notification_config.py  # NotificationConfig ORM model
│   ├── services/
│   │   ├── scanner.py              # Orchestrates full disk scan pipeline
│   │   ├── smartctl.py             # smartctl subprocess wrapper
│   │   ├── lsblk.py                # lsblk subprocess wrapper
│   │   ├── nvme.py                 # nvme-cli wrapper
│   │   ├── ses.py                  # SES enclosure slot detection (best-effort)
│   │   ├── notifications.py        # Pluggable notification dispatch
│   │   ├── log_buffer.py           # In-memory log ring buffer (500 entries); custom logging.Handler
│   │   └── csv_import.py           # CSV bulk import: Drive + DriveProfile upsert + bay assignment
│   ├── db/
│   │   └── base.py                 # SQLAlchemy engine + SessionLocal + Base
│   └── tests/
│
└── frontend/                       # React + Tailwind SPA
    ├── Dockerfile                  # Multi-stage: node build + nginx serve
    ├── Dockerfile.dev              # Dev: vite dev server with hot reload
    ├── .dockerignore
    ├── nginx.conf                  # nginx: serves static + proxies /api to backend
    ├── package.json                # React 18, react-router, axios, dnd-kit, lucide
    ├── vite.config.js              # Vite + dev proxy for /api
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── index.css               # Tailwind directives
        ├── main.jsx                # React root
        ├── App.jsx                 # Router shell
        ├── api/
        │   └── client.js           # Axios instance (baseURL: /api)
        ├── components/
        │   ├── BayGrid.jsx
        │   ├── BaySlot.jsx
        │   ├── DriveCard.jsx
        │   ├── DriveList.jsx
        │   ├── EmptyBayModal.jsx   # Manual drive entry form; opens on empty bay click
        │   ├── LogConsole.jsx      # Quake-style slide-down log overlay (backtick key)
        │   ├── ScanButton.jsx
        │   ├── SettingsModal.jsx   # Tabbed settings modal (Enclosures / Notifications / Import)
        │   └── WarningBadge.jsx
        └── pages/
            ├── Dashboard.jsx
            └── DriveDetail.jsx
```

## Update Protocol

When adding, renaming, or deleting any file or directory:
1. Update this file to reflect the change
2. Update `project/changelog.md` if the change is part of a versioned release
3. Update `project/info.md` if the change affects the data model or tech stack
