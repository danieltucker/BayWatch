# Project Structure

> Last updated: 2026-05-24
> Status: v1.5.0 — hover-to-preview vdev peers, drive deletion, widget persistence, larger LG bays

## Current Layout

```
drive-position/
├── README.md                       # Project overview, TrueNAS iX Apps guide, Watchtower setup
├── Dockerfile                      # Combined image: node builder → python builder → nginx+supervisord
├── docker-compose.yml              # Production: single baywatch service
├── docker-compose.truenas.yml      # TrueNAS Scale: single baywatch service (combined image)
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
│   │   ├── deps.py                 # Shared DI: DB session + require_api_key (auth + rate limiter)
│   │   └── routes/
│   │       ├── drives.py           # /api/drives — scan, list, get
│   │       ├── bays.py             # /api/bays — list, assign, unassign, status
│   │       ├── enclosures.py       # /api/enclosures — CRUD + bay arrays
│   │       ├── profiles.py         # /api/profiles — drive profile CRUD
│   │       ├── alerts.py           # /api/alerts — list, config
│   │       ├── pools.py            # /api/pools — ZFS pool stats (GET)
│   │       ├── history.py          # /api/history — drive + pool time-series
│   │       ├── api_keys.py         # /api/api-keys — key generation, list, delete
│   │       ├── external.py         # /v1/ — authenticated external API (drives, bays, enclosures, pools, history)
│   │       ├── config.py           # /api/config — generic key-value config store (app_config table)
│   │       └── federation.py       # /api/federation — target CRUD, sync, data snapshot endpoint
│   ├── models/
│   │   ├── enclosure.py            # Enclosure ORM model
│   │   ├── bay_array.py            # BayArray ORM model
│   │   ├── bay.py                  # Bay ORM model
│   │   ├── drive.py                # Drive ORM model
│   │   ├── drive_history.py        # DriveHistory ORM model (temp + realloc + hours per scan)
│   │   ├── pool_history.py         # PoolHistory ORM model (capacity_pct per scan)
│   │   ├── drive_profile.py        # DriveProfile ORM model (+ warranty helpers)
│   │   ├── alert.py                # Alert ORM model
│   │   ├── notification_config.py  # NotificationConfig ORM model
│   │   ├── api_key.py              # ApiKey ORM model (prefix + SHA-256 hash; plaintext never stored)
│   │   └── federated_target.py     # FederatedTarget ORM model (remote instance URL + API key)
│   ├── services/
│   │   ├── scanner.py              # Orchestrates full disk scan pipeline
│   │   ├── diskstats.py            # /proc/diskstats reader; device name → (read_bytes, write_bytes)
│   │   ├── smartctl.py             # smartctl subprocess wrapper
│   │   ├── lsblk.py                # lsblk subprocess wrapper; ZFS pool detection via FSTYPE/LABEL
│   │   ├── nvme.py                 # nvme-cli wrapper
│   │   ├── ses.py                  # SES enclosure slot detection (best-effort)
│   │   ├── zpool.py                # zpool list/status wrapper; PoolStats + PoolTopology; vdev tree parser; graceful if ZFS absent
│   │   ├── notifications.py        # Pluggable notification dispatch
│   │   ├── log_buffer.py           # In-memory log ring buffer (500 entries); custom logging.Handler
│   │   ├── csv_import.py           # CSV bulk import: Drive + DriveProfile upsert + bay assignment
│   │   └── federation.py           # Remote instance polling; in-memory snapshot cache; poll_due_targets()
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
        ├── context/
        │   ├── ThemeContext.jsx          # Dark/light/auto theme provider
        │   └── TempThresholdContext.jsx  # warnC/dangerC from alert config; avoids prop drilling
        ├── components/
        │   ├── BayGrid.jsx              # Bay array grid with S/M/L size toggle (localStorage per array)
        │   ├── BayModal.jsx             # Unified bay+drive modal: status, label, assign, create, edit, remove
        │   ├── BaySlot.jsx              # Individual bay slot; health dot; status tile colors; three size variants
        │   ├── DriveCard.jsx            # Drive details card; form-factor icon; warranty expiry display
        │   ├── DriveList.jsx            # Sidebar list; search; hide-assigned toggle; form-factor icon
        │   ├── LogConsole.jsx           # Slide-down console: log level filters + terminal REPL; pinned alerts with Clear All
        │   ├── PoolTopologyPanel.jsx    # Collapsible ZFS pool topology panel; vdev rows + drive chips; onDriveSelect
        │   ├── ScanButton.jsx
        │   ├── SettingsModal.jsx        # Tabbed modal (General / Enclosures / Notifications / API Keys / Federation / Import / Appearance)
        │   ├── WarningBadge.jsx
        │   ├── WidgetBar.jsx            # Draggable widget bar; 13 widget types; fixed h-72px; localStorage config
        │   ├── WidgetDetailModal.jsx    # Per-widget detail modal (hottest, oldest, failed, warranty, reallocated)
        │   └── WidgetPickerModal.jsx    # Widget picker modal
        ├── pages/
        │   ├── Dashboard.jsx            # DnD context, WidgetBar, bay grid, topology panel, Remote Instances panel, drive sidebar; 5-min auto-refresh
        │   └── DriveDetail.jsx          # Drive detail + profile edit page
        └── utils/
            └── driveIcon.js             # getDriveIcon(formFactor, rpm) → lucide icon
```

## Update Protocol

When adding, renaming, or deleting any file or directory:
1. Update this file to reflect the change
2. Update `project/changelog.md` if the change is part of a versioned release
3. Update `project/info.md` if the change affects the data model or tech stack
