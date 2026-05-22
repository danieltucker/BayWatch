# Project Structure

> Last updated: 2026-05-21
> Status: v0.12.0 — vdev peer highlighting, richer topology chips, sticky sidebar, array editing, CSV example data

## Current Layout

```
drive-position/
├── README.md                       # Project overview, TrueNAS iX Apps guide, Watchtower setup
├── Dockerfile                      # Combined image: node builder → python builder → nginx+supervisord
├── docker-compose.yml              # Production: single drivemap service
├── docker-compose.truenas.yml      # TrueNAS Scale: single drivemap service (combined image)
├── docker-compose.dev.yml          # Dev overrides (hot reload, port exposure)
├── .env.example                    # Environment variable template
├── .gitignore
├── docker/
│   ├── nginx.conf                  # nginx: serves static + proxies /api/ to localhost:8000
│   └── supervisord.conf            # supervisord: manages nginx + uvicorn processes
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
│   │       ├── bays.py             # /api/bays — list, assign, unassign, status
│   │       ├── enclosures.py       # /api/enclosures — CRUD + bay arrays
│   │       ├── profiles.py         # /api/profiles — drive profile CRUD
│   │       ├── alerts.py           # /api/alerts — list, config
│   │       └── pools.py            # /api/pools — ZFS pool stats (GET)
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
│   │   ├── lsblk.py                # lsblk subprocess wrapper; ZFS pool detection via FSTYPE/LABEL
│   │   ├── nvme.py                 # nvme-cli wrapper
│   │   ├── ses.py                  # SES enclosure slot detection (best-effort)
│   │   ├── zpool.py                # zpool list/status wrapper; PoolStats + PoolTopology; vdev tree parser; graceful if ZFS absent
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
        │   ├── BayGrid.jsx              # Bay array grid with S/M/L size toggle (localStorage per array)
        │   ├── BaySlot.jsx              # Individual bay slot; form-factor icon; three size variants
        │   ├── DriveCard.jsx            # Drive details card; form-factor icon; warranty expiry display
        │   ├── DriveEditModal.jsx       # Edit drive fields + profile; warranty in years
        │   ├── DriveList.jsx            # Sidebar list; search; hide-assigned toggle; form-factor icon
        │   ├── EmptyBayModal.jsx        # Manual drive entry form; opens on empty bay click
        │   ├── LogConsole.jsx           # Slide-down console: log level filters + terminal REPL; pinned alerts with Clear All
        │   ├── PoolTopologyPanel.jsx    # Collapsible ZFS pool topology panel; vdev rows + drive chips; onDriveSelect
        │   ├── ScanButton.jsx
        │   ├── SettingsModal.jsx        # Tabbed modal (General / Enclosures / Notifications / Import / Appearance)
        │   ├── WarningBadge.jsx
        │   ├── WidgetBar.jsx            # Draggable widget bar; 13 widget types; localStorage config
        │   └── WidgetPickerModal.jsx    # Widget picker modal
        ├── pages/
        │   ├── Dashboard.jsx            # DnD context, WidgetBar, bay grid, topology panel, drive sidebar; 5-min auto-refresh
        │   └── DriveDetail.jsx          # Drive detail + profile edit page
        └── utils/
            └── driveIcon.js             # getDriveIcon(formFactor, rpm) → lucide icon
```

## Update Protocol

When adding, renaming, or deleting any file or directory:
1. Update this file to reflect the change
2. Update `project/changelog.md` if the change is part of a versioned release
3. Update `project/info.md` if the change affects the data model or tech stack
