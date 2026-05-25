# Changelog

All notable changes to Drive Position are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Planned
- Tests (backend scanner, route integration)
- SES auto-detection surfaced as bay assignment suggestions

---

## [1.5.0] — 2026-05-24

### Added
- **Hover-to-preview** — hovering over a bay slot highlights all vdev peers (drives sharing the same `vdev_name`) and shows the hovered drive's details in the sidebar. Hover is transient: the permanent selection is preserved when the cursor leaves. Clicking a bay still opens BayModal.
- **Drive deletion** — drives can be permanently deleted via a trash icon + inline confirmation in DriveCard. Cascades manually (SQLite FK enforcement off): clears `Bay.drive_serial`, deletes `DriveHistory` rows, nullifies `Alert.drive_serial`. `DriveProfile` is deleted by SQLAlchemy ORM cascade. Detected drives reappear after next scan (without history); manually-created drives are gone permanently.
- **Widget persistence** — widget selection and order are now saved to the backend (`app_config` table, key `widgets`) and synced across browsers. localStorage is still used for fast initial render; backend is source of truth. Persistence is best-effort (localStorage fallback if backend unreachable).
- **Backend config endpoint** — `GET/PUT /api/config/{key}` — generic key-value store backed by new `app_config` SQLite table. Used by widget persistence; available for future settings.

### Changed
- **LG bay size** — min-height increased from 160px to 190px; inner gap and padding increased; icon bumped from 28px to 32px; make text from 11px to 12px; model text from 10px to 11px. More breathing room and more readable make/model at large size.

### Frontend
- `components/BaySlot.jsx` — `onHover`/`onHoverEnd` props wired to `onMouseEnter`/`onMouseLeave`; LG size metrics increased.
- `components/BayGrid.jsx` — `onBayHover`/`onBayHoverEnd` props forwarded to each `BaySlot`.
- `components/DriveCard.jsx` — `onDelete` prop; `Trash2` icon button; inline delete confirmation banner; `confirmDelete` state.
- `components/WidgetBar.jsx` — loads widget config from backend on mount; saves to backend on every change; localStorage retained as write-through cache.
- `pages/Dashboard.jsx` — `hoveredBay` state; derived `displayBay`/`displayDrive`/`displayProfile`/`highlightVdev`; sidebar uses display vars; `onDelete` handler wired to `DriveCard`; `deleteDrive` imported.
- `api/client.js` — `deleteDrive(serial)`, `getAppConfig(key)`, `saveAppConfig(key, value)`.

### Backend
- `api/routes/drives.py` — `DELETE /api/drives/{serial}`: manual FK cascade + ORM delete.
- `api/routes/config.py` — new route: `GET/PUT /api/config/{key}` key-value config store.
- `main.py` — `app_config` table migration added; `config` router registered; version bumped to `1.5.0`.
- `api/routes/external.py` — `_VERSION` bumped to `1.5.0`.
- `docker-compose.truenas.yml` — image tag bumped to `1.5.0`.

---

## [1.4.0] — 2026-05-24

### Fixed
- **I/O chart Y-axis truncation** — values ≥ 1,000 MB now auto-scale to GB. `ioUnit` is computed from the dataset max; all chart values and the Y-axis unit string update accordingly. Tooltip formatter also uses the dynamic unit.

### Changed
- **I/O chart clarity** — added a subtitle line below the "I/O Activity (30d)" heading: `"MB/GB per scan interval · this drive"`. Makes clear the data is per-drive cumulative delta between scans, not per-second throughput, and not pool/vdev-level.
- **Bay health indicator** — all three bay sizes (SM/MD/LG) now show a colored dot reflecting drive health: emerald=PASSED (no errors), amber=PASSED (with reallocated/pending/uncorrectable sectors), red=FAILED, slate=unknown, dark-slate=empty. Dot is positioned bottom-right of the bay tile. LG dot moved from top-right to bottom-right to coexist with the bay status badge. Dot is always visible regardless of bay status.
- **Bay status tile colors** — the bay tile's background and border now reflect `bay.status`: `damaged` = red tint + red border; `hot_spare` = amber tint + amber border; `cold_spare` = sky tint + sky border; `normal` = default SMART-status styling (unchanged). Replaces the previous ring-only approach. Status badge (DMG/HS/CS) retained for quick identification at small sizes.
- **LG bay text sizes** — model, pool, vdev, temp label, capacity, and device path labels bumped from `text-[9px]` to `text-[10px]`. Tile min-height increased from 150px to 160px.
- **Unified bay+drive modal** — `DriveEditModal` and `EmptyBayModal` replaced by a single `BayModal` component. Clicking any bay (empty or occupied) opens one modal covering: bay label, bay status picker, drive fields (make/model/form factor/type), ownership profile (purchase date, warranty, notes), assign-existing (search list), create-new drive, and remove-from-bay (inline confirmation). Drive data is preserved on removal.

### Frontend
- `components/DriveCard.jsx` — I/O chart auto-scaling: `ioMaxMB`, `ioUnit`, `ioData` derived from `ioHistory`; Y-axis unit and tooltip formatter use `ioUnit`; subtitle added.
- `components/BaySlot.jsx` — `healthDotColor(drive)` function; `STATUS_TILE` and `STATUS_TILE_HOVER` constants; SM/MD/LG dot uses `healthDotColor`; MD/LG dot repositioned to bottom-right and always rendered; tile classes conditioned on `STATUS_TILE[bay.status]`; LG text sizes bumped; LG min-h increased.
- `components/BayModal.jsx` — new unified modal; handles all bay + drive + profile actions; makes API calls internally; `onSaved()` called on any successful action.
- `pages/Dashboard.jsx` — imports swapped to `BayModal`; `emptyBay`/`editTarget` state replaced by `bayModal`; `findArrayName(bayId)` helper; `onBayClick` always opens `BayModal`; `onEdit` in `DriveCard` opens `BayModal` with bay context when available.

### Backend
- `main.py` — version bumped to `1.4.0`.
- `api/routes/external.py` — `_VERSION` bumped to `1.4.0`.
- `docker-compose.truenas.yml` — image tag bumped to `1.4.0`.

---

## [1.3.0] — 2026-05-24

### Fixed
- **API key generate/regen list not updating** — replaced bare `try/finally` with `try/catch/finally` in both `handleGenerateKey` and `handleRegenerateKey`. Previously, any exception from the API call (including the Pydantic v2 bug in older images) silently swallowed the error and skipped all state updates. Now on failure: an inline error banner is shown and `loadApiKeys()` is called anyway so any partially-created key surfaces immediately without the user needing to close and reopen settings. Removed the optimistic list prepend that was masking the real issue.

### Changed
- **API Keys table — "Prefix" column replaced with "Key" column** — the column now always shows the full plaintext key (from `sessionStorage`) when available, or the key prefix + `…` when not. A copy button is always present: it copies the full key if in session, or the prefix otherwise. The separate Show/Hide toggle is removed. The Regenerate button (↺ with confirm) only appears for rows without a session key (i.e. keys generated in a prior session).

### Added
- **Array temperature sparkline** — each bay array now shows a 30-day daily-average temperature sparkline spanning the full width of the array stats strip, between the health bar and the occupied/status counts. Color-coded: sky-blue below warn threshold, amber between warn and danger, red above danger. Renders only when at least 2 days of history exist; hidden otherwise. Data fetched from the new `GET /api/history/arrays/{array_id}?days=30` endpoint.

### Backend
- `api/routes/history.py` — new `GET /history/arrays/{array_id}` endpoint: joins `DriveHistory` with `Bay` on `drive_serial`, filters by `array_id` and date range, groups by date, returns daily avg temps as `[{date, avg_temp_c}]`.
- `main.py` — version bumped to `1.3.0`.
- `docker-compose.truenas.yml` — image tag bumped to `1.3.0`.

### Frontend
- `api/client.js` — added `getArrayTempHistory(arrayId, days)`.
- `components/BayGrid.jsx` — `ArrayTempSparkline` component: fetches array history on mount, renders a recharts `AreaChart` in a 28px `ResponsiveContainer`, color-coded via `useTempThreshold()`.
- `components/SettingsModal.jsx` — fixed generate/regen error handling; redesigned Key column; added `keyError` state with inline error banner; version footer bumped to `v1.3.0`.

---

## [1.2.0] — 2026-05-23

### Fixed
- **API key generation bug** — `create_api_key` was calling `ApiKeyCreated.model_validate(orm_obj)` which fails in Pydantic v2 because the `key: str` field is required but not present on the ORM object. This caused a 500 response on every create, which the frontend caught as an exception — the key was committed to the DB but the response never arrived, so the list never refreshed and the plaintext key was never returned. Fixed by validating as `ApiKeyRead` first, then constructing `ApiKeyCreated(**read.model_dump(), key=plaintext)`.

### Added
- **API key Show/Hide toggle** — rows in the API Keys table that have a session-cached plaintext key now show a "Show" button. Clicking reveals the full key inline in the Prefix column as a monospace code element; clicking the key text copies it to the clipboard. A Copy icon button and a "Hide" button appear in the Key column. The key collapses back when "Hide" is clicked or when a different row is revealed.
- **README — Screenshots section** — ten labelled screenshots added: Dashboard overview, Drive Details, Widget Bar, ZFS Pool Topology, Terminal Console, Dark Mode, and all four Settings tabs (Enclosures, Notifications, API Keys, Federation).
- **README — Full API request/response documentation** — each `/v1/` endpoint now documents the full HTTP request (method, URL, headers), all query parameters with types/defaults/limits, the complete success response JSON with field-level notes, and every possible error status code (`401`, `404`, `422`, `429`) with example response bodies.
- **README — general polish** — features list expanded to cover ZFS integration, health score, REST API, and federation; first-time setup, CSV import, and installation sections tightened; Federation section updated with Sync Now detail and failure behaviour.

### Backend
- `api/routes/api_keys.py` — `create_api_key` Pydantic v2 fix.
- `main.py` — version bumped to `1.2.0`.
- `docker-compose.truenas.yml` — image tag bumped to `1.2.0`.

### Frontend
- `components/SettingsModal.jsx` — `revealedKeyId` state; Show/Hide/Copy UX in API Keys table; version footer updated to `v1.2.0`.

---

## [1.1.0] — 2026-05-23

### Changed
- **Settings modal — left-nav layout** — replaced the horizontal top tab bar with a fixed left sidebar navigation. Each tab shows an icon and label; the active tab is highlighted in blue. The right panel displays the section title and a one-line description in its header alongside the close button. On narrow screens the modal collapses to a single-column flow: the sidebar list fills the screen first, tapping a tab pushes to the content view with a "← Back" button at the top.
- **Settings version footer** — the sidebar shows "DriveMap v1.1.0" at the bottom, matching the WatchTower-style pattern.

### Fixed
- **API keys not appearing after generate** — `loadApiKeys()` was fire-and-forget; the list now refreshes immediately via an optimistic state update (new key appended) followed by an awaited server fetch. The key table updates without leaving the tab.

### Added
- **API key session reveal** — after generating a key, its plaintext is stored in `sessionStorage` keyed by ID. Switching tabs and returning within the same browser session shows a Copy button on that key's row. On page reload the session value is gone (intentional — no plaintext persistence).
- **API key regenerate** — rows without a session key show a Regenerate button (↺). Clicking asks for confirmation, then deletes the old key and creates a new one with the same name, stores it in `sessionStorage`, and shows it in the amber one-time box. The old key immediately stops working.
- **README: Drive Health Score section** — documents the 0–100 composite score formula: starting at 100 for PASSED, 0 for FAILED, with deduction table for reallocated sectors (−4/ea, max −40), pending sectors (−5/ea, max −25), uncorrectable errors (−10/ea, max −35), power-on hours tiers (−5/−12/−20), and temperature tiers (−3/−8/−15). Score label thresholds (Excellent/Good/Fair/Poor/Critical) also documented.

### Backend
- `main.py` — version bumped to `1.1.0`.
- `docker-compose.truenas.yml` — image tag bumped to `1.1.0`.

---

## [1.0.0] — 2026-05-23

### Added
- **External API** — all key drive data (drives, bays, enclosures, pools, history) accessible via authenticated `/v1/` REST endpoints. Optional `?serial=X` and `?days=N` query parameters. Unauthenticated `/v1/health` for connectivity checks. Full documentation in README.
- **API key management** — generate named API keys in Settings → API Keys. Each key is displayed once in plaintext at creation time; only the SHA-256 hash is stored. Keys show a display prefix (e.g. `dm_xK9p…`), creation date, and last-used timestamp. Keys can be deleted at any time.
- **Federation** — configure remote DriveMap instances as federation targets (Settings → Federation). Each target requires a URL and the target's API key. The host polls enabled targets on each scheduler tick (configurable interval: 5/15/30/60 min) and caches their drive, bay, and pool snapshots in memory. The Dashboard shows a collapsible "Remote Instances" panel with a compact per-instance drive list when any snapshots are available.

### Security
- API keys generated with `secrets.token_urlsafe(32)`, prefixed `dm_`, stored as SHA-256 hashes only.
- Constant-time comparison (`hmac.compare_digest`) on every auth check to prevent timing attacks.
- In-memory sliding-window rate limiter: 120 requests/minute per key prefix; returns 429 on exceed.
- Federation target API keys stored as plaintext (same threat model as the Telegram bot token — local SQLite, LAN-only). Documented in code.
- CORS remains permissive (`allow_origins=["*"]`) — LAN appliance; restrict origins before any internet exposure.

### Backend
- `models/api_key.py` — `ApiKey` ORM model (id, name, key_prefix, key_hash, created_at, last_used_at).
- `models/federated_target.py` — `FederatedTarget` ORM model (id, name, url, api_key, enabled, sync_interval_minutes, last_synced_at, last_error).
- `api/deps.py` — `require_api_key` FastAPI dependency: reads `Authorization: Bearer` header, rate-checks, constant-time hash compare, schedules `last_used_at` update as a background task.
- `api/routes/api_keys.py` — `GET/POST/DELETE /api/api-keys`.
- `api/routes/external.py` — `GET /v1/health`, `GET /v1/drives`, `GET /v1/drives/{serial}`, `GET /v1/drives/{serial}/history`, `GET /v1/bays`, `GET /v1/enclosures`, `GET /v1/pools`.
- `api/routes/federation.py` — `GET/POST/PATCH/DELETE /api/federation/targets`, `POST /api/federation/targets/{id}/sync`, `GET /api/federation/data`.
- `services/federation.py` — `RemoteSnapshot` dataclass; in-memory `_snapshots` cache; `poll_due_targets()` (called by scheduler); `poll_target_by_id()` (on-demand sync).
- `services/scheduler.py` — federation polling added to each scheduler tick via `run_in_executor`.
- `main.py` — two new `CREATE TABLE IF NOT EXISTS` migrations; routers registered; version bumped to `1.0.0`.
- `api/schemas.py` — `ApiKeyCreate`, `ApiKeyRead`, `ApiKeyCreated`, `ExternalBayRead`, `FederatedTargetCreate`, `FederatedTargetUpdate`, `FederatedTargetRead`.

### Frontend
- `components/SettingsModal.jsx` — two new tabs: **API Keys** (generate form, one-time key display with copy button, key table) and **Federation** (add-target form, target list with enable toggle, sync now, error badge, delete with confirmation).
- `pages/Dashboard.jsx` — `federationData` state fetched from `/api/federation/data` on load and 5-min refresh; collapsible "Remote Instances" panel below pool topology; per-instance collapsible drive list (status dot, serial, model, temp, ZFS pool).
- `api/client.js` — `getApiKeys`, `createApiKey`, `deleteApiKey`, `getFederationTargets`, `createFederationTarget`, `updateFederationTarget`, `deleteFederationTarget`, `syncFederationTarget`, `getFederationData`.
- `docker-compose.truenas.yml` — image tag bumped to `1.0.0`.

---

## [0.19.0] — 2026-05-23

### Added
- **Used space trend chart** — DriveCard now shows a "Used Space (30d)" AreaChart with a teal gradient fill, replacing the uninformative power-on-hours trend. Data is captured at each scan via `os.statvfs()` across all mounted partitions on the drive and stored as `used_bytes` in `DriveHistory`. ZFS member disks and unmounted partitions contribute nothing and degrade gracefully to null. The current POH progress bar (snapshot) is retained.
- **CSV export: enclosure and bay columns** — The drive inventory export now includes three additional columns at the end: `Enclosure`, `Array`, and `Bay`. Bay labels use the user-assigned label if set, otherwise fall back to `R{row}C{col}` position notation. Drives not assigned to any bay export empty strings for these columns.

### Backend
- `models/drive_history.py` — added `used_bytes` nullable integer column.
- `services/scanner.py` — `_drive_used_bytes()` helper computes total used bytes across mounted partitions via `os.statvfs()`; called once per drive per scan.
- `api/schemas.py` — `DriveHistoryRead` now includes `used_bytes` optional field.
- `main.py` — startup migration for `used_bytes` column; version bumped to `0.19.0`.
- `docker-compose.truenas.yml` — image tag bumped to `0.19.0`.

---

## [0.18.0] — 2026-05-23

### Added
- **I/O activity chart** — DriveCard now shows a 30-day read/write history chart below the reallocated-sectors trend. Data is captured from `/proc/diskstats` at each scan and stored as cumulative `read_bytes`/`write_bytes` columns in `drive_history`. The chart displays per-interval deltas in MB with green (read) and violet (write) gradient fills. Negative deltas (counter reset after reboot) are automatically skipped. Non-Linux hosts (no `/proc/diskstats`) degrade gracefully with null values.

### Backend
- `services/diskstats.py` — new service; reads `/proc/diskstats`, maps device name → (read_bytes, write_bytes). Sector size is hardcoded to 512 bytes (kernel invariant).
- `models/drive_history.py` — added `read_bytes` and `write_bytes` nullable integer columns.
- `services/scanner.py` — reads diskstats once per scan, attaches per-device I/O bytes to each `DriveHistory` entry.
- `api/schemas.py` — `DriveHistoryRead` now includes `read_bytes` and `write_bytes` optional fields.
- `main.py` — two new startup migrations (`ALTER TABLE drive_history ADD COLUMN read_bytes/write_bytes INTEGER`); version bumped to `0.18.0`.
- `docker-compose.truenas.yml` — image tag bumped to `0.18.0`.

---

## [0.17.0] — 2026-05-23

### Added
- **Drive health score** — composite 0–100 score shown as an SVG ring gauge in DriveCard. Factors: SMART pass/fail, reallocated/pending/uncorrectable sector counts, power-on hours age, and current temperature. Labels: Excellent (90+), Good (75+), Fair (60+), Poor (40+), Critical (<40).
- **Temperature history chart redesign** — switched from LineChart to AreaChart with sky-blue gradient fill. Y-axis now defaults to [25°C, 65°C] (expands automatically if actual temps are outside that range). Warn and danger reference lines now include temperature labels at the right edge.
- **Power-on hours trend chart** — new AreaChart in DriveCard showing POH accumulation over 30 days, using indigo gradient fill. Complements the reallocated-sectors chart below it.
- **Four new clickable widget modals** — `Healthy` (clean vs. degraded breakdown + full PASSED drive list), `Avg Temp` (temperature distribution histogram + 5 hottest drives), `Drive Health %` (donut chart + per-category progress bars), `Total Drives` (SSD/HDD split + by-form-factor bars).
- **Widget modal redesign** — all detail modals now open with a rounded icon chip header, `StatPill` summary row at the top, and richer per-row content: `TempBar` and `PohBar` inline progress indicators, error-count grids for FAILED drives, bar chart for reallocated sectors distribution.
- **CSV data export** — "Export" button next to the Scan button downloads a full drive inventory as `drivemap-export-YYYY-MM-DD.csv`. Columns: serial, make, model, capacity, form factor, RPM, firmware, device path, SMART status, temperature, power-on hours, error counts, ZFS pool/vdev, last scanned, purchase date, warranty months, vendor, notes. Client-side only — no backend changes required.
- **Array health bar** — a 3 px segmented bar above each array's stats text shows the proportional split of healthy (green) / degraded (amber) / failed (red) / empty (slate) bays at a glance.
- **Array reorder buttons integrated into header** — up/down arrows now live in the BayGrid header row (left of the SM/MD/LG toggle), eliminating the z-index conflict with the size buttons. Passed as `onMoveUp`/`onMoveDown` props; hidden when array has no siblings.

### Changed
- **SM bay slot** — primary text changed from last-8 serial to `Make · Size` (e.g. "Seagate · 16 TB"). Falls back to serial if make and capacity are both absent. vdev badge (Z1/Z2 etc.) removed.
- **MD bay slot** — primary text changed from serial to make; serial (last 6) moved to secondary line below. vdev badge removed. Layout otherwise unchanged.
- **LG bay slot** — vdev peer highlight now applies a proper blue gradient (`from-blue-50 to-white`) instead of a flat `!bg-blue-50` override that killed the gradient. Ring is `ring-1 ring-blue-400/50`. vdev badge removed from card body; vdev name still visible as plain text in the pool line.
- **Array stats wording** — "All OK" → "All healthy"; failure count uses "failure/failures"; warn count uses "degraded" for clearer language.
- **Array reorder** — removed wrapper `div` + absolute-positioned buttons from Dashboard; reorder is now a BayGrid-level prop pattern.

### Backend
- `main.py`: version bumped to `0.17.0`.
- `docker-compose.truenas.yml`: image tag bumped to `0.17.0`.

### Not yet implemented (needs backend)
- **I/O metrics** — read/write throughput and IOPS require `/proc/diskstats` or `iostat` integration in the scanner service. No frontend-ready data exists yet.
- **Disk space history** — per-drive partition utilization over time requires a new column in `DriveHistory`. POH trend chart is the current proxy for "drive activity over time."

---

## [0.16.0] — 2026-05-22

### Fixed
- **Sub-1 GB partition display** — `formatSize()` replaces `formatGB()` throughout DriveCard; values below 1 GB now render as MB (e.g. "512 MB") instead of rounding to "0 GB". Fixes lingering "0 GB unknown" slices in the partition donut for BIOS/protective partitions that survived the 1 MB filter.

### Added
- **Drive health gradient colours** — DriveCard background and border now reflect health state: green gradient for healthy (`PASSED`, no errors), amber/yellow for degraded (`PASSED` with reallocated/pending/uncorrectable sectors > 0), red for failed (`FAILED`). Uses a `healthState()` function that returns `ok | warn | failed | unknown`.
- **vdev peer highlighting — blue gradient** — drives sharing a vdev with the selected drive now show a blue-tinted background (`!bg-blue-50 dark:!bg-blue-950/30`) with a blue ring, replacing the previous subtle cyan ring. More visually distinct when scanning which drives belong to the same vdev group.
- **DriveCard UI redesign** — full structural rewrite:
  - `formatSize()` helper shows TB / GB / MB / KB based on magnitude
  - Serial number moved to header row (under make/model, `text-[10px] font-mono`)
  - Spec chips row: capacity, form factor, firmware, device path
  - Temp + power-on hours rendered side-by-side in a two-column grid
  - Health block: green "No SMART errors detected" checkmark OR three error count cards (reallocated / pending / uncorrectable) + SMART failure banner
  - ZFS pool section card-styled with vdev badge chip
  - Profile section card-styled with purchase / warranty label
  - Partition donut uses `formatSize()` for slice labels
- **ZFS Pool Topology — scan status** — each pool header now shows the `scan:` line from `zpool status` (e.g. last scrub date/result or in-progress scrub %). Coloured amber when the string contains "error", "fault", or "degraded".
- **ZFS Pool Topology — per-disk error counts** — disk chips in the topology panel show `R:N W:N C:N` (read / write / checksum error counts) in red when any count is non-zero. Backend `VdevDisk` and `_parse_zpool_status` updated to capture and pass error columns.
- **Array stats strip** — each bay array now shows a compact stats line above its grid: `occupied/total` drive count, FAIL/WARN counts (coloured red/amber), "All OK" when clean, and average temperature across occupied bays.
- **Collapsible arrays** — each bay array has a collapse toggle (chevron) next to its name. Collapsed state persisted per-array in `localStorage array-collapsed-{id}`. Stats strip remains visible when collapsed.
- **Collapsible enclosures** — each enclosure header has a collapse toggle (chevron). Collapsed state persisted per-enclosure in `localStorage enc-collapsed-{id}`.
- **Enclosure reorder** — up/down arrow buttons in each enclosure header reorder enclosures by updating `display_order` on the backend. Disabled when already first/last.
- **Array reorder** — up/down arrow buttons appear on array hover (absolute-positioned, top-right). Reorders arrays within an enclosure by updating `display_order`. Hidden when only one array exists.

### Backend
- `models/enclosure.py`: added `display_order: Mapped[int]` column; arrays relationship now ordered by `BayArray.display_order, BayArray.id`.
- `api/schemas.py`: `EnclosureBase` gains `display_order: Optional[int]`; `BayArrayUpdate` gains `display_order: Optional[int]`; `VdevDiskRead` gains `read_errors`, `write_errors`, `cksum_errors`; `PoolTopologyRead` gains `scan_status`.
- `api/routes/enclosures.py`: `list_enclosures` orders by `display_order, id`; `update_enclosure` uses `exclude_none=True`; `update_bay_array` handles `display_order`.
- `services/zpool.py`: `VdevDisk` gets error count fields; `PoolTopology` gets `scan_status`; `_parse_zpool_status` captures scan line and per-disk READ/WRITE/CKSUM columns.
- `main.py`: migration for `enclosures.display_order`; version bumped to `0.16.0`.

### Frontend
- `components/DriveCard.jsx`: full rewrite — `formatSize()`, `healthState()`, `healthGradient()`; new chip/section layout; health block with checkmark or error cards; ZFS + profile card sections.
- `components/BaySlot.jsx`: vdev peer class changed from cyan ring to blue gradient background.
- `components/BayGrid.jsx`: collapse toggle with localStorage persistence; `computeStats()` helper; stats strip (occupied/total, FAIL/WARN counts, avg temp).
- `pages/Dashboard.jsx`: enclosure collapse toggle; `moveEnclosure()` / `moveArray()` using sequential `display_order` reassignment; arrow reorder buttons in enclosure header and per-array hover overlay; imports `updateEnclosure`, `updateBayArray`.
- `components/PoolTopologyPanel.jsx`: scan_status line under pool header (amber when errors); per-disk R/W/C error row on disk chips when non-zero.
- `docker-compose.truenas.yml`: image tag bumped to `0.16.0`.

---

## [0.15.0] — 2026-05-22

### Fixed
- **Partition donut: 0 GB "unknown" slices** — BIOS boot and protective MBR partitions (≤ 1 MB, no fstype) now filtered from the donut chart with a `MIN_CHART_BYTES = 1 MB` threshold. An empty-after-filter guard prevents rendering an empty chart.
- **vdev topology drive matching** — `PoolTopologyPanel` pathMap now indexes both `device_path` (`/dev/sda`) and `by_id_path` (`/dev/disk/by-id/ata-...`). Disk paths from `zpool status -P` also have `-partN` suffix stripped before lookup, so drives reliably appear as clickable chips in the topology view.

### Added
- **Whole-disk filesystem support** — `get_partitions()` in `lsblk.py` now detects drives with no partition table but a direct filesystem (unRAID XFS, raw-formatted drives, some USB drives). Returns the disk itself as a single partition entry so the donut chart still renders correctly.
- **Extended fstype palette** — Partition donut now correctly colors and labels: LVM (`lvm2_member` → pink), LUKS (`crypto_luks` → purple), Linux RAID (`linux_raid_member` → red), ReiserFS (cyan), HFS+ / APFS (indigo), UDF / ISO9660 (lime), nilfs2, squashfs, tmpfs. Fallback label shows the raw fstype string instead of "unknown" for unrecognized types.
- **Bay slot text legibility** — All three BaySlot sizes bumped up by 1–2px: SM serial is now `text-xs` (12px), MD serial `text-[10px]`, LG make primary `text-[11px]`. Badge and annotation text also bumped across all sizes.

### Changed
- **Partition donut legend labels** — LVM2_member shows as "LVM", linux_raid_member as "RAID", crypto_LUKS as "LUKS", hfsplus as "HFS+". All other fstypes display their raw string rather than "unknown".

### Backend
- `services/lsblk.py`: `get_partitions()` now handles partitioned disks (existing) and whole-disk filesystems (new) via a single unified return path.
- `main.py`: version bumped to `0.15.0`.

### Frontend
- `components/DriveCard.jsx`: extended `FSTYPE_COLORS` and `FSTYPE_LABELS` maps; added `MIN_CHART_BYTES` constant; `visiblePartitions` filter applied before computing `usedBytes` and `pieData`; empty `pieData` guard added.
- `components/PoolTopologyPanel.jsx`: pathMap built from both `device_path` and `by_id_path`; disk path lookup strips `-partN` suffix before map lookup.
- `components/BaySlot.jsx`: font sizes bumped in SM, MD, and LG variants for improved readability.

---

## [0.14.0] — 2026-05-22

### Fixed
- **PARTUUID → drive mapping** — `zpool status -P` can return `/dev/disk/by-partuuid/UUID` paths. These are now resolved to their parent block device via `/sys/block` symlink traversal (`_partuuid_to_parent_dev`) before indexing into the vdev map, so drives using by-partuuid paths are correctly matched.

### Added
- **Partition donut chart** — DriveCard Drive Details panel now shows a donut chart of partition layout when the drive has a `device_path`. Slices are coloured by filesystem type (zfs_member → blue, ext4 → green, btrfs → teal, xfs → violet, swap → amber, ntfs/vfat/exfat → orange). Unpartitioned space shown as a gray remainder slice when total capacity is known. Legend lists fstype + size per slice.
- **Bay reassignment** — selecting a drive in the sidebar now shows an `ArrowLeftRight` button in DriveCard header. Clicking it opens the existing Assign Bay modal pre-targeted to that bay, supporting reassign, replace, or remove in one flow.
- **Unassign drive from bay** — Assign Bay modal (Assign Existing tab) now shows a "Remove drive from this bay" button at the top when the bay already has a drive assigned. Calls `PUT /api/bays/{id}/assign` with `drive_serial: null`.
- **`GET /api/drives/{serial}/partitions`** — new endpoint; runs `lsblk -J -b` on the drive's `device_path` and returns partition list with name, path, size_bytes, fstype, label, mountpoint, partuuid.

### Changed
- **Make/model order** — make is now the primary label (larger/bold) and model is secondary (smaller/muted) across all views: DriveCard header, BaySlot MD subtext, BaySlot LG card header, DriveList sidebar items, Assign Bay drive list, Pool Topology drive chips.

### Backend
- `services/zpool.py`: added `_partuuid_to_parent_dev()` using `/sys/block` symlink resolution; `build_disk_to_vdev_map` now handles by-partuuid paths.
- `services/lsblk.py`: added `get_partitions(device_path)` function returning partition list from `lsblk -J -b`.
- `api/schemas.py`: added `PartitionRead` schema.
- `api/routes/drives.py`: added `GET /{serial}/partitions` route; imports `lsblk` service.
- `main.py`: version bumped to `0.14.0`.

### Frontend
- `api/client.js`: added `getDrivePartitions(serial)`.
- `components/DriveCard.jsx`: fetches partitions on mount; renders donut chart (recharts PieChart); make/model swapped in header; reassign button wired to `onReassign` prop.
- `components/BaySlot.jsx`: MD subtext now shows `drive.model` (was `drive.make`); LG primary shows `drive.make`, secondary shows `drive.model`.
- `components/DriveList.jsx`: primary label is now `drive.make`, secondary is `drive.model`.
- `components/EmptyBayModal.jsx`: imports `unassignDrive`; Assign Existing tab shows "Remove drive from this bay" button when `bay.drive_serial` is set; drive list primary label swapped to make.
- `components/PoolTopologyPanel.jsx`: drive chip subtitle now shows `drive.make` (falls back to `drive.model`).
- `pages/Dashboard.jsx`: passes `onReassign` to DriveCard when a bay is selected.

---

## [0.13.0] — 2026-05-22

### Fixed
- **vdev parser depth bug** — `_parse_zpool_status` in `zpool.py` used hardcoded absolute depth values (`depth == 4` for vdev groups, `depth >= 8` for leaf disks). With tab+space mixed indentation, actual relative depths are 2 and 4. Fixed to match correctly.
- **vdev path normalization** — `build_disk_to_vdev_map` only indexed the exact path from `zpool status -P`, which includes a `-partN` suffix (e.g. `/dev/disk/by-id/ata-...-part1`). lsblk by-id paths point to the whole disk without the suffix. Fixed by also inserting a stripped key for each path using `re.sub(r"-part\d+$", "", path)`.

### Added
- **Drive history** — `DriveHistory` model records temperature, reallocated sectors, and power-on hours after each scan. Pruned to 90 days. `GET /api/history/drives/{serial}?days=30` returns the series.
- **Pool history** — `PoolHistory` model records capacity_pct, size_bytes, alloc_bytes per pool per scan. `GET /api/history/pools/{pool_name}?days=30` returns the series.
- **Temperature warning threshold** — new `temp_warn_threshold_c` column on `notification_configs` (default 55°C, amber). Existing `temp_alert_threshold_c` is now the danger threshold (default 60°C, red).
- **`TempThresholdContext`** — React context fetched from `/api/alerts/config` on mount; provides `warnC`/`dangerC` to all components without prop drilling.
- **MD BaySlot temp bar** — compact 3 px colour bar with temp value added to the medium-size bay slot card.
- **Threshold-aware temp colours** — all temperature indicators (SM/MD/LG BaySlot, DriveCard) now use amber at `warnC` and red at `dangerC` instead of a hardcoded 55°C cutoff.
- **Temperature history chart** — DriveCard shows a line chart of temperature over 30 days with reference lines at warn and danger thresholds (requires at least 2 history points).
- **Reallocated sectors history chart** — DriveCard shows an area chart of reallocated sectors over 30 days when any non-zero data exists.
- **Pool capacity history chart** — PoolTopologyPanel shows a per-pool area chart of capacity % over 30 days when the panel is expanded.
- **Widget uniform height** — all widget cards are now fixed at `h-[72px]`; subtitle text removed from cards.
- **Widget detail modals** — clicking a widget with rich data opens a modal: Hottest Drive (top 10), Oldest Drive (top 10), Failed (list), Warranty Warnings, Reallocated Sectors.
- **Last updated indicator** — "Updated X min ago" label appears next to the Scan button; refreshes every 60 s.
- **Settings temp threshold fields** — Notifications tab now has separate "Temperature warning threshold" and "Temperature danger threshold" inputs.

### Backend
- `models/drive_history.py`: new `DriveHistory` ORM model.
- `models/pool_history.py`: new `PoolHistory` ORM model.
- `models/__init__.py`: registers both new models.
- `api/routes/history.py`: new routes file with `GET /history/drives/{serial}` and `GET /history/pools/{pool_name}`.
- `api/schemas.py`: added `DriveHistoryRead`, `PoolHistoryRead`; added `temp_warn_threshold_c` to `NotificationConfigRead` / `NotificationConfigUpdate`.
- `models/notification_config.py`: added `temp_warn_threshold_c` (default 55); changed `temp_alert_threshold_c` default to 60.
- `api/routes/alerts.py`: handles `temp_warn_threshold_c` in `PUT /alerts/config`.
- `services/scanner.py`: appends `DriveHistory` + `PoolHistory` rows after each scan; prunes >90 days.
- `services/zpool.py`: fixed depth values; added `re.sub` partition-suffix normalization.
- `main.py`: version bumped to `0.13.0`; new migration `ALTER TABLE notification_configs ADD COLUMN temp_warn_threshold_c INTEGER DEFAULT 55`.

### Frontend
- `context/TempThresholdContext.jsx`: new context provider.
- `App.jsx`: wraps app in `<TempThresholdProvider>`.
- `api/client.js`: added `getDriveHistory`, `getPoolHistory`.
- `pages/Dashboard.jsx`: added `lastRefreshed` state + "Updated X min ago" label; 60 s tick for display refresh.
- `components/BaySlot.jsx`: imports threshold context; MD temp bar; threshold-aware colours in SM/MD/LG.
- `components/DriveCard.jsx`: imports recharts; fetches drive history; temp + reallocated charts; threshold-aware colours.
- `components/PoolTopologyPanel.jsx`: fetches pool history when expanded; per-pool capacity area chart.
- `components/WidgetBar.jsx`: fixed card height; click-to-detail; renders `WidgetDetailModal`.
- `components/WidgetDetailModal.jsx`: new component with per-widget detail views.
- `components/SettingsModal.jsx`: warn + danger threshold fields in Notifications tab.
- `package.json`: added `recharts ^2.15.4`.

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
