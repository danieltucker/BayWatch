# Project Structure

> Last updated: 2026-11-20
> Status: UI redesign (ui-redesign branch) — new Bays/Drives/Reports/Search pages, shared fleet model, mobile layout

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
│   └── structure.md                # This file
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
└── frontend/                       # React SPA (Vite, Tailwind for layout, Watchtower tokens for style)
    ├── Dockerfile                  # Multi-stage: node build + nginx serve
    ├── Dockerfile.dev              # Dev: vite dev server with hot reload
    ├── .dockerignore
    ├── nginx.conf                  # nginx: serves static + proxies /api to backend
    ├── package.json                # React 18, react-router 7, axios, dnd-kit, lucide, recharts, xlsx (SheetJS CDN); Vitest
    ├── vite.config.js              # Vite + dev proxy for /api (VITE_API_TARGET)
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html                  # Loads Hanken Grotesk + JetBrains Mono; data-theme on <html>
    ├── dev/                        # Dev-only, never bundled
    │   ├── mock-api.mjs            # In-memory mock of /api with invented data (issues / --clear scenarios)
    │   └── dev-mock.mjs            # `npm run dev:mock`: starts mock (:8010) + vite pointed at it
    └── src/
        ├── watchtower.css          # Family design tokens + wt-* reference components (source of truth)
        ├── index.css               # BayWatch ink (--bw-*), bw-* app classes, mobile breakpoint (767px), 1180px column collapse
        ├── main.jsx                # React root
        ├── App.jsx                 # Providers, routes (/, /bays, /drives, /drives/:serial, /reports, /search), log console, settings, scan
        ├── lazy.js                 # React.lazy entry points for chart-heavy / on-demand components
        ├── api/
        │   └── client.js           # Axios instance (baseURL: /api) + one function per endpoint
        ├── context/
        │   ├── FleetContext.jsx          # Loads enclosures, bays, drives, profiles, pools, topology, federation once; derives locations/placement; 5-min refresh; disconnect toasts
        │   ├── ShellContext.jsx          # scan(), openLog(), openSettings(), alert count/severity
        │   ├── ThemeContext.jsx          # Dark/light/auto theme provider
        │   └── TempThresholdContext.jsx  # warnC/dangerC from alert config (drives temperature colours everywhere)
        ├── hooks/
        │   └── useMediaQuery.js    # useIsMobile() — matches the CSS breakpoint
        ├── lib/                    # Pure logic, no React — unit tested
        │   ├── fleet.js            # Status mapping (up/warn/down/muted), temp bands, bay state, pool groups, locations, attention items, gauge, temp spread
        │   ├── fleet.test.js       # Vitest suite for lib/
        │   ├── widgets.js          # Widget registry (IDs are persisted — never rename) + compute()
        │   ├── health.js           # Health score + healthState (shared by DriveCard and the new panels)
        │   ├── format.js           # Capacity/age/date/temperature formatters
        │   └── export.js           # Drive inventory CSV export + download helper
        ├── components/
        │   ├── shell/
        │   │   ├── AppHeader.jsx        # Dark header band: brand, nav, search (dims bays on Bays page), scan, alerts, settings
        │   │   ├── TabBar.jsx           # Mobile bottom tab bar
        │   │   └── Toasts.jsx           # Disconnect toasts
        │   ├── bays/
        │   │   ├── Hero.jsx             # Hero copy + per-drive health gauge
        │   │   ├── Widgets.jsx          # Widget grid: popover/sheet details, add, remove, reorder; persisted to /api/config/widgets
        │   │   ├── Chassis.jsx          # Location switcher, bay tiles (3 colour modes), small-array chips, offline shelf list, legend
        │   │   ├── Panels.jsx           # Temperature spread, Needs attention (+ mobile banner), Pool capacity
        │   │   └── DrivePanel.jsx       # Selected-drive panel + reusable HealthBlock/DriveStats/TempHistory; useDriveHistory
        │   ├── ui/
        │   │   ├── Dialog.jsx           # Modal: centred card on desktop, bottom sheet on mobile; focus trap, Escape
        │   │   └── bits.jsx             # StatusPill, SmartPill, Led, Sparkline, HealthRing, Kv, Stat, Spinner
        │   ├── EditBayDriveSheet.jsx    # Bay label/status/role, purchase/warranty/notes/vendor/price, move drive
        │   ├── PlaceDrivesSheet.jsx     # Guided placement: walk empty bays, match each to an unplaced drive by serial; skip/undo
        │   ├── EmptyBayModal.jsx        # Empty bay: create a manual drive or assign a detected one; bay status
        │   ├── DriveCard.jsx            # Full drive card (SMART, partitions, lifetime I/O, delete); also used for remote drives
        │   ├── DriveHistoryModal.jsx    # 90-day history charts
        │   ├── HealthBreakdownModal.jsx # Per-factor health score breakdown
        │   ├── PoolTopologyPanel.jsx    # Collapsible ZFS pool topology; vdev rows + drive chips; onDriveSelect
        │   ├── LogConsole.jsx           # Slide-down console: log level filters + terminal REPL; pinned alerts
        │   ├── SettingsModal.jsx        # Tabbed modal (General / Enclosures / Notifications / API Keys / Federation / Import / Appearance)
        │   └── WarningBadge.jsx
        ├── pages/
        │   ├── BaysPage.jsx             # Landing page: hero, widgets, chassis map, drive panel, attention, temp spread, pool capacity; ?loc= & ?bay=
        │   ├── DriveDetail.jsx          # /drives/:serial — mobile drive screen, also used on desktop
        │   ├── DrivesPage.jsx           # Sortable/filterable table (?q= ?status= ?sort= ?dir=), bulk edit, export; card list on mobile
        │   ├── Reports.jsx              # Generate/schedule/export reports; tabs synced to ?tab=
        │   ├── SearchPage.jsx           # /search?q= — grouped results + "where they are" mini map
        │   └── Settings.jsx             # (legacy, not routed)
        └── utils/
            └── driveIcon.js             # getDriveIcon(formFactor, rpm) → lucide icon
```

## Update Protocol

When adding, renaming, or deleting any file or directory:
1. Update this file to reflect the change
2. Update `CHANGELOG.md` (under `[Unreleased]` until a version is tagged)
3. Update `project/info.md` if the change affects the data model or tech stack
