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

## [0.12.0] — 2026-05-21

### Added
- **vdev peer highlighting** — selecting a drive highlights all other drives in the same vdev with a cyan ring on every BaySlot in the grid. Computed from `selectedDrive.vdev_name`; passed as `highlightVdev` prop through Dashboard → BayGrid → BaySlot.
- **Richer topology panel chips** — each drive chip in the Pool Topology panel is now 120 px wide and shows: last-6 serial + SMART status dot, model (truncated), capacity, and temperature. Previously only showed serial + temp.
- **Sticky drive details sidebar** — on large screens the right-hand drive details / drive list sidebar is now `position: sticky` (`lg:sticky lg:top-[49px] lg:h-[calc(100vh-49px)]`). It stays in the viewport as you scroll down through a long enclosure list.
- **Array editing** — each bay array row in Settings → Enclosures now has a pencil icon that opens an inline edit form. Editable fields: name, rows, cols, group type, purpose. Reducing grid size removes out-of-bounds bays (and their drive assignments) with a warning shown before save.
- **`PUT /api/enclosures/{id}/arrays/{array_id}`** — new endpoint; updates any combination of name, rows, cols, group_type, purpose. Automatically adds bays for newly-in-bounds positions and deletes bays outside the new bounds.
- **CSV template with example data** — "Download Template" in Settings → Import now includes 3 example rows (a fully-populated HDD, a partial HDD, and an SSD with no bay position) so users can see exactly what each field expects.

### Backend
- `api/schemas.py`: added `BayArrayUpdate` schema (all fields optional).
- `api/routes/enclosures.py`: added `PUT /{enclosure_id}/arrays/{array_id}` route; imports `or_` from SQLAlchemy for out-of-bounds bay query.

---

## [0.11.0] — 2026-05-21

### Added
- **Silent auto-refresh** — Dashboard fetches all data (drives, bays, pools, topology, profiles) silently every 5 minutes via `setInterval`; temperatures and pool stats update without user action or a loading spinner.
- **vdev membership** — each drive now carries a `vdev_name` field populated at scan time from `zpool status -P` output. Shows as a coloured badge on BaySlot (all three sizes):
  - `mirror-N` → `M{N}` blue · `raidz1-N` → `Z1` green · `raidz2-N` → `Z2` teal · `raidz3-N` → `Z3` cyan
  - `spare` → `SP` violet · `cache` → `L2` amber · `log` → `LOG` orange · single-disk → `ZFS` slate
- **Pool Topology panel** — collapsible panel in Dashboard (below enclosures); collapsed by default, state persisted to `localStorage pool-topology-open`. Shows per-pool state badge + usage bar, then a row per vdev with drive chips. Each chip shows last-6 serial, SMART status border colour, temperature; clicking selects the drive in the sidebar.
- **`GET /api/pools/topology`** — new endpoint; parses `zpool status -P` into a structured vdev tree (`PoolTopologyRead`).
- **General tab in Settings** — new first tab with a "Tilde always opens/closes console" toggle. Stored in `localStorage console-tilde-override`; when enabled the backtick key opens/closes the console even when an input field is focused.
- **Notification dismiss contrast** — dismiss × button on pinned alerts changed from `text-gray-700` to `text-gray-400 hover:text-gray-100` for legibility on the dark console background.
- **Version badge contrast** — version string in console header wrapped in `bg-gray-800 border border-gray-700 text-gray-300` badge for better readability.
- **Clear All notifications** — "Clear all" button added next to the "Notifications" label in the console pinned-alerts section; calls `onDismissAlert` for every alert.

### Backend
- `Drive` model: new `vdev_name` field (`VARCHAR(32)`, nullable).
- `services/zpool.py`: extended with `VdevDisk`, `Vdev`, `PoolTopology` dataclasses; `get_pool_topology()` runs `zpool status -P` and parses the indentation-based tree; `build_disk_to_vdev_map()` returns `{device_path: vdev_name}`.
- `api/schemas.py`: added `VdevDiskRead`, `VdevRead`, `PoolTopologyRead`; `DriveRead` gets `vdev_name: Optional[str]`.
- `api/routes/pools.py`: added `GET /topology` route.
- `scanner.py`: builds `disk_to_vdev` map at scan start; populates `drive.vdev_name` for each discovered disk.
- `main.py`: version bumped to `0.11.0`; new migration `ALTER TABLE drives ADD COLUMN vdev_name VARCHAR(32)`.

---

## [0.10.0] — 2026-05-21

### Added
- **Click outside to close console** — clicking the backdrop behind the log console closes it (in addition to the backtick toggle).
- **Version in console header** — console title bar now shows the running app version (e.g. `v0.10.0`) fetched from `GET /api/health`; replaces the old `` ` to close `` hint text.
- **ZFS pool detection** — after each scan, `lsblk` is extended with `FSTYPE` and `LABEL` columns; drives whose disk or partition has `fstype: zfs_member` get their `zfs_pool` field populated with the pool name. ZFS pool badge shown in DriveList sidebar.
- **Pool usage stats** — `GET /api/pools` returns live pool stats via `zpool list` (name, size, alloc, free, capacity %). Pool usage bar shown in DriveCard when a drive's pool is identified.
- **Power-on hours bar** — DriveCard now shows a visual progress bar for power-on hours (scale 0–50,000h), color-coded blue/amber/orange by wear level.
- **Bay status** — bays can be marked as `normal`, `damaged`, `hot_spare`, or `cold_spare`:
  - Status is set via the new **Bay Status** tab in the bay click modal (works for both empty and occupied bays via `EmptyBayModal`).
  - Visual treatment in BaySlot: `damaged` → orange `DMG` badge, `hot_spare` → cyan `HS` badge, `cold_spare` → violet `CS` badge, across all three slot sizes (SM/MD/LG).
  - Status banner shown in DriveCard sidebar for occupied bays with non-normal status.
- **`GET /api/pools`** — new endpoint returning `list[PoolRead]`; returns `[]` gracefully when ZFS is unavailable.
- **`PUT /api/bays/{id}/status`** — new endpoint accepting `BayStatusUpdate { status }`.

### Backend
- `Bay` model: new `status` field (`VARCHAR(16)`, default `"normal"`).
- `Drive` model: new `zfs_pool` field (`VARCHAR(64)`, nullable).
- `lsblk.py`: extended `BlockDevice` with `zfs_pool`; lsblk command now includes `FSTYPE,LABEL`; `_extract_zfs_pool()` checks disk + child partitions.
- `services/zpool.py`: new service; `get_pool_stats()` runs `zpool list -Hp`; returns `[]` if `zpool` not installed or no pools exist.
- `api/routes/pools.py`: new router registered at `/api/pools`.
- `main.py`: version bumped to `0.10.0`; two new migrations (`bays.status`, `drives.zfs_pool`); `/api/health` now returns `version`.
- `Dockerfile`: added `zfsutils-linux` to apt-get install.

---

## [0.9.0] — 2026-05-21

### Fixed
- **CRITICAL: nginx welcome screen** — Debian nginx installs a default site at `/etc/nginx/sites-enabled/default` with `default_server` flag that took priority over `conf.d/default.conf`. Added `RUN rm -f /etc/nginx/sites-enabled/default` to the combined `Dockerfile`. All deployments using `danielgt/drivemap:0.8.x` were affected.

### Added
- **Bay array group types** — When adding an array to an enclosure, users can now specify the group type: Drive Bays, ZFS Pool, ZFS Mirror, ZFS RAIDZ1, ZFS RAIDZ2, HW RAID, PCIe Slots, Standalone, or Other. An optional purpose/notes field is also available. Group type badge shown in the bay array header.
- **Enclosure edit button** — Pencil icon on each enclosure row opens an inline edit form (name + type) with Save/Cancel.
- **Bell notification icon** — Bell in the nav bar changes color based on unread alert severity (red = critical, amber = status). Clicking opens the log console.
- **Pinned console notifications** — Undismissed alerts appear pinned at the top of the console (above log output). Each has a dismiss button; dismissed state stored in `localStorage`. Alerts are always written to the DB regardless of Telegram configuration.
- **CSV import template download** — "Download Template" button in Settings → Import generates a blank `drivemap-import-template.csv` with all supported column headers.
- **Bay grid fills enclosure width** — Bay arrays now use `repeat(cols, minmax(0, 1fr))` grid layout, spreading bays evenly across the available panel width.
- **SM/MD/LG bay slot redesign**:
  - **SM** — Excel-style flat row (h-8): serial in SMART status color, temperature indicator, status dot. No icon.
  - **MD** — Medium card (min-h-[80px]): drive icon, serial, make, temperature.
  - **LG** — Rich card (min-h-[150px]): gradient background, drive icon + model/make, full serial, temperature bar, capacity, device path, warranty badge.
- **In-app temperature threshold + log level** — `TEMP_ALERT_THRESHOLD_C` and `LOG_LEVEL` moved from env vars to Settings → Notifications. Log level change applies immediately at runtime. Both fields also added to `NotificationConfig` DB model with auto-migration.

### Changed
- `docker-compose.truenas.yml` — version bumped to `0.9.0`; `TEMP_ALERT_THRESHOLD_C`, `WARRANTY_WARNING_DAYS`, `LOG_LEVEL` env vars removed (now configured in-app). Only `DATABASE_URL` and `SCAN_INTERVAL_MINUTES` remain.
- Scheduler reads `temp_alert_threshold_c` from DB at each scan run (not locked in at startup).
- Notifications are always logged to the `alerts` table before Telegram dispatch, so alerts appear in the console even when Telegram is not configured.
- Bay grid gap is size-aware: `gap-1` (SM), `gap-1.5` (MD), `gap-2` (LG).

### Backend
- `BayArray` model: new `group_type` (VARCHAR 32, default `drive_bays`) and `purpose` (TEXT) columns.
- `NotificationConfig` model: new `temp_alert_threshold_c` (INTEGER, default 55) and `log_level` (VARCHAR 16, default `INFO`) columns.
- `main.py`: `_run_migrations()` runs `ALTER TABLE` for all new columns on startup (safe to run on existing DBs).
- `log_buffer.set_level(level)` — new function to update runtime log level without restart.

---

## [0.8.0] — 2026-05-21

### Added
- **Terminal console command interface** — command input bar at the bottom of the log console; full REPL with up-arrow history. Commands: `drives`, `drive <serial>`, `find <query>`, `scan`, `edit <serial> <field> <value>`, `profile <serial>`, `bays`, `assign <serial> <label>`, `unassign <label>`, `logs [level]`, `clear`, `help [cmd]`.
- **Console log level filters** — DEBUG / INFO / WARNING / ERROR toggle buttons in the console title bar; DEBUG hidden by default. Filters apply to backend log entries only; command output always shows.
- **Customizable widget bar** — replaces the static stats row. 13 widget types: Total Drives, Healthy, Failed, Avg Temp, Hottest Drive, Oldest Drive, Total Capacity, Assigned Bays, Drive Health %, Reallocated Sectors, SSD Count, HDD Count, Warranty Warnings. Plus button opens a picker modal. Drag to reorder. Selection and order persisted to `localStorage`.
- **Widget close button** — X button appears on hover for each widget card.
- **Drive icons by form factor** — `getDriveIcon(formFactor, rpm)` utility maps 3.5"/2.5" → HardDrive, M.2 → MemoryStick, U.2 → Server, SSD (rpm=0) → Cpu. Applied in BaySlot, DriveCard, and DriveList.
- **Single combined container** — new root-level `Dockerfile` bundles nginx + uvicorn under supervisord into a single image (`danielgt/drivemap`). Replaces the separate backend/frontend images for production deployments.
- **iX Apps install guide** — README updated with a step-by-step guide for configuring DriveMap as a TrueNAS Scale Custom App, including Watchtower auto-update setup.

### Changed
- `docker-compose.truenas.yml` — migrated from two services (`backend` + `frontend`) to a single `drivemap` service using the combined image.
- Widget bar uses `@dnd-kit/sortable` nested inside the existing bay DndContext; activation requires 6 px movement to preserve click behavior.

### Added (infrastructure)
- `Dockerfile` — root-level multi-stage build: node builder → python builder → combined nginx + supervisord runtime.
- `docker/nginx.conf` — nginx config proxying `/api/` to `localhost:8000`.
- `docker/supervisord.conf` — supervisord config managing nginx and uvicorn processes.
- `src/utils/driveIcon.js` — drive icon selector utility.
- `src/components/WidgetBar.jsx` — sortable widget bar with all widget definitions.
- `src/components/WidgetPickerModal.jsx` — widget picker modal.

---

## [0.7.0] — 2026-05-21

### Added
- **Warranty in years** — warranty field now entered and displayed in years (e.g. "3 yrs"); converted to/from months on save/load with no schema change.
- **Warranty expiry display** — expiry row on DriveCard shows date + time remaining or elapsed (e.g. "Jan 15 2028 · 2.3y left" / "6mo ago").
- **Array size toggle** — each bay array header has an S / M / L toggle; S = 72 px slots (current default), M = 88 px + model name, L = 108 px + model + capacity. Selection persisted to `localStorage` per array.
- **Live enclosure/array refresh** — adding or deleting enclosures and arrays in Settings now immediately reloads the Dashboard map without a full page refresh. SettingsModal accepts an `onUpdate` callback; Dashboard passes `loadAll`.
- **All Drives search** — sidebar drive list has a search input that filters across serial, model, make, device path, and firmware version.
- **Hide assigned drives** — assigned drives are hidden from the sidebar list by default; an Eye toggle reveals them (dimmed) and shows the count. Active search always shows all matching drives.

---

## [0.6.0] — 2026-05-21

### Added
- **Drag-and-drop assignment** — sidebar drive items are now draggable; drop onto any bay slot to assign. DnD context moved to Dashboard level so sidebar drag sources and bay-grid drop targets share one context. Uses MouseSensor (8 px activation distance) and TouchSensor (200 ms delay) for reliable click vs. drag distinction.
- **Assign Existing tab** — clicking an empty bay now shows two tabs: "Assign Existing" (searchable list of all drives; filter by model, make, or serial) and "Create New" (unchanged prior form). Backend already clears conflicting bay assignments on reassign.
- **Drive Edit modal** — DriveCard now shows a pencil button that opens a `DriveEditModal`. Editable fields: make, model, form factor, type (SSD / HDD + rpm), purchase date, warranty months, notes. Drive fields patched via `PATCH /api/drives/{serial}`; profile fields upserted via `PUT /api/profiles/{serial}`.
- **Light / Dark / Auto theme** — Appearance tab added to the Settings modal with a three-button toggle. Selection persisted to `localStorage`; "Auto" follows the system color-scheme preference. Dark is the default.
- **Notes displayed on DriveCard** — drive profile notes now shown in the details card when present.

### Changed
- **Settings modal anchors from top** — modal position is now fixed at a top offset; height changes grow the panel downward instead of shifting its vertical center.
- **Full light mode support** — all frontend components updated with `dark:` Tailwind variants; app renders correctly in both light and dark modes.

### Backend
- `PATCH /api/drives/{serial}` — new endpoint; accepts `DrivePatch` body with optional `make`, `model`, `form_factor`, `rpm` fields.
- `DrivePatch` Pydantic schema added to `api/schemas.py`.

---

## [0.5.2] — 2026-05-20

### Fixed
- **TrueNAS healthcheck gate** — removed healthcheck from `docker-compose.truenas.yml`; TrueNAS was treating any defined healthcheck as `condition: service_healthy` on `depends_on`, causing the frontend to refuse to start if the backend healthcheck hadn't passed yet
- **Frontend image tag** — `drivemap-frontend:0.5.1` pushed (same image as `0.5.0`; frontend had no changes in 0.5.1)
- **SMART device type fallback** — `smartctl` now retries with `-d sat`, `-d scsi`, and `-d auto` when the default invocation returns no serial number; fixes drives behind HBA/SAS controllers on TrueNAS Scale where passthrough requires an explicit device type hint

---

## [0.5.1] — 2026-05-20

### Fixed
- **Backend runs as root** — removed `USER appuser` from Dockerfile; `smartctl` requires root to open raw block devices on TrueNAS Scale even with `SYS_RAWIO` + `SYS_ADMIN` caps granted
- **smartctl error logging** — when `smartctl` returns no output, the exit code and stderr are now logged so the cause is visible in the log console

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
