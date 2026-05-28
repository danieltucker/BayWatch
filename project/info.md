# Project: BayWatch — LLM Reference

## Purpose

BayWatch is a self-hosted web application designed to run inside a Docker container on TrueNAS Scale (or any Linux-based NAS). It solves a practical problem: identifying which physical drive bay a specific disk occupies without manually pulling drives.

## Problem Being Solved

When managing a NAS with many drives, identifying which physical bay holds a specific drive (by serial, size, or label) requires either pulling drives or cross-referencing incomplete documentation. BayWatch provides a persistent, visual map that connects physical bay positions to drive identities and metadata.

## Core Concepts

- **Enclosure**: A named physical unit — a server chassis, JBOD shelf, or any housing. Users create these manually.
- **Bay Array**: A named grid of bays within an enclosure (e.g., "Front Bays", "Rear Bays"). Each array has its own rows × cols layout. One enclosure can have multiple arrays.
- **Bay**: A single physical slot within a Bay Array, identified by row/col position.
- **Drive**: A disk device detected by the host OS, identified by serial number (stable across reboots).
- **Assignment**: The mapping between a Bay and a Drive. Manual or auto-suggested.
- **Profile**: User-entered metadata for a drive: purchase date, warranty period, notes.

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Backend | Python + FastAPI | Async, easy subprocess calls, rich ecosystem |
| Frontend | React + Tailwind CSS | Component-based UI, good for interactive bay grid |
| Database | SQLite (via SQLAlchemy) | Zero-dependency, single-file, fits Docker volume |
| SMART Data | smartmontools (`smartctl`) | Industry standard for disk health |
| Disk Enumeration | `lsblk`, `udevadm`, `/dev/disk/by-id` | Stable device references across reboots |
| Container | Docker + Docker Compose | Portable, TrueNAS-friendly |
| Notifications | Telegram Bot API | Default channel; pluggable for future channels |

## Docker + Host Disk Access

The container needs access to host block devices to run `smartctl` and `lsblk`. Approach:

- Mount `/dev/disk/by-id` (stable symlinks, survives reboots) and `/dev` into the container
- Grant `SYS_RAWIO` + `SYS_ADMIN` Linux capabilities (not full `privileged: true`)
- `smartctl` and `lsblk` run as subprocesses within the container against these mounts

This means the app works on TrueNAS Scale, Unraid, or any Linux host — it does not call any NAS-specific API.

## Data Model

### Enclosure
- `id` (PK)
- `name` — user-defined (e.g., "TrueNAS Main", "JBOD Shelf 1")
- `type` — `server` | `jbod` | `other`
- `description` — optional notes

### BayArray
- `id` (PK)
- `enclosure_id` (FK → Enclosure)
- `name` — user-defined (e.g., "Front Bays", "Rear Bays", "Internal")
- `rows`, `cols` — defines the grid layout
- `display_order` — ordering within the enclosure UI

### Bay
- `id` (PK)
- `array_id` (FK → BayArray)
- `row`, `col` — position within the array grid
- `label` — optional user-defined label (e.g., "A1")
- `status` — `normal` | `damaged` | `hot_spare` | `cold_spare`
- `drive_serial` — nullable FK to Drive (the assignment)

### Drive
- `serial` (PK) — from SMART or udev; stable across reboots
- `device_path` — e.g., `/dev/sda` (informational; may change)
- `by_id_path` — e.g., `/dev/disk/by-id/ata-WDC_...` (preferred stable path)
- `make`, `model`
- `capacity_bytes`
- `rpm` — 0 for SSD
- `form_factor` — `3.5"` | `2.5"` | `M.2` | `U.2` | `other`
- `firmware_version`
- `smart_status` — `PASSED` | `FAILED` | `UNKNOWN`
- `temperature_c`
- `power_on_hours`
- `reallocated_sectors`
- `pending_sectors`
- `uncorrectable_errors`
- `last_scanned`
- `zfs_pool` — pool name if drive is a ZFS member (populated by scanner, nullable)

### DriveProfile (user-entered)
- `serial` (PK, FK → Drive)
- `purchase_date`
- `mfg_date` — manufacturing date (populated via CSV import or manual entry)
- `warranty_months`
- `warranty_expiry` — computed: purchase_date + warranty_months
- `purchase_price`
- `vendor`
- `notes`

### Alert (notification log)
- `id` (PK)
- `type` — `status` | `critical`
- `drive_serial` — nullable FK (critical alerts are drive-specific)
- `channel` — `telegram`
- `message`
- `sent_at`

### NotificationConfig
- `id` (PK)
- `channel` — `telegram`
- `config_json` — channel-specific config (bot token, chat ID)
- `status_frequency` — `daily` | `weekly` | `monthly` | `disabled`
- `critical_enabled` — boolean (default true)
- `warranty_warning_days` — default 90

## Alert System

Two alert types:

| Type | Trigger | Frequency | Content |
|---|---|---|---|
| **Status alert** | Scheduled | Daily / Weekly / Monthly (user choice) | Summary of all drives: health, temps, power-on hours, warranty warnings (≤90 days) |
| **Critical alert** | Event-driven | Immediate | SMART failure, SMART attribute threshold exceeded, temperature above limit |

Default notification channel: **Telegram** (bot token + chat ID configured in Settings).
Additional channels (email, Slack, etc.) are a future extension — architecture must support pluggable channels from day one.

## Automation Capabilities

| Data Point | Source |
|---|---|
| Device path | `lsblk -J` |
| Stable device path | `/dev/disk/by-id/` |
| Serial number | `smartctl -i /dev/sdX` or `udevadm info` |
| Make / Model | `smartctl -i` |
| Capacity | `lsblk` or `smartctl` |
| Firmware version | `smartctl -i` |
| SMART health status | `smartctl -H` |
| Temperature | `smartctl -A` (attr 194 or 190) |
| Power-on hours | `smartctl -A` (attr 9) |
| Reallocated sectors | `smartctl -A` (attr 5) |
| Pending sectors | `smartctl -A` (attr 197) |
| Uncorrectable errors | `smartctl -A` (attr 198) |
| RPM / SSD flag | `smartctl -i` (Rotation Rate) |
| Enclosure slot (SES) | `/sys/class/enclosure/` or `sg_ses` (best-effort) |
| NVMe data | `nvme-cli` (`nvme list`, `nvme smart-log`) |

## Key Constraints

- Must run in Docker using targeted capability grants — no `privileged: true`
- Must not require TrueNAS-specific APIs — works on any Linux NAS or bare metal
- Bay assignments persist by serial number, not device path (paths are unstable)
- UI must work on tablet or phone (used standing in front of a rack)
- No authentication in v1 — LAN-only deployment assumed
- Notification architecture must be pluggable (Telegram now, more channels later)

## Decisions Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Multi-enclosure support in v1 | User has JBODs + mixed environments |
| 2 | Enclosure → BayArray → Bay hierarchy | Supports multiple grids per enclosure (front/rear/internal) |
| 3 | Two alert types: status (scheduled) + critical (immediate) | Covers routine reporting and emergency notification |
| 4 | Telegram as default notification channel | Pluggable — more channels added later |
| 5 | No authentication in v1 | LAN-only deployment; add later if needed |
| 6 | Docker with `SYS_RAWIO` + `SYS_ADMIN` capabilities | Safer than `privileged: true`; grants needed device access |
| 7 | CSV import via `POST /api/drives/import` | Lets users bulk-load inventory from spreadsheets; serial is the key; all other fields are optional |
| 8 | TrueNAS: no custom `networks:` block | TrueNAS Scale manages its own bridge; explicit `driver: bridge` causes deploy failure |
| 9 | Settings as modal dialog | Removes the /settings page route; modal is tab-based (Enclosures, Notifications, Import); triggered from nav bar |
| 10 | In-memory log ring buffer | Backend captures all Python logs into a 500-entry deque; frontend polls at 1 Hz when console is open; no log persistence needed |
| 11 | Scanner preserves manually-entered fields | Identity fields (make, model, etc.) only fill if null; SMART telemetry always overwrites; prevents scan from clobbering user data |
| 12 | Single combined Docker image for distribution | `danielgt/baywatch` runs nginx + uvicorn under supervisord; one container, one port, simpler iX Apps and Watchtower setup. Separate `backend/` and `frontend/` Dockerfiles kept for dev. |
| 13 | Widget bar configuration in localStorage | Widget selection and order stored client-side; no backend API needed. Key: `widget-config` (JSON array of widget IDs). |
| 14 | Drive icons by form factor (client-side only) | `getDriveIcon(formFactor, rpm)` maps form_factor/rpm to a lucide icon; no schema or API change needed. |
| 15 | BayArray group_type + purpose fields | Users can label bay arrays as ZFS pools, RAID sets, PCIe slots, standalone drives, etc. Provides context without needing separate inventory tracking. |
| 16 | Bay grid fill-width via CSS `1fr` | Grid uses `repeat(cols, minmax(0, 1fr))` — bays scale evenly to fill the enclosure panel width at all three size modes. |
| 17 | SM/MD/LG slot redesign | SM = flat Excel-style row for dense arrays; MD = icon card with health; LG = rich card with gradient, temp bar, warranty. Profile data passed through BayGrid for LG warranty badge. |
| 18 | Alerts always logged before Telegram dispatch | Alert records written to DB before the send attempt. Notifications appear in the console for all users regardless of Telegram config. |
| 19 | Bell icon + pinned console notifications | Undismissed alerts surfaced via bell (color by severity) + pinned section in console. Dismissed IDs stored in `localStorage`. No new backend endpoints needed. |
| 20 | In-app temp threshold + log level via NotificationConfig | `TEMP_ALERT_THRESHOLD_C` and `LOG_LEVEL` moved from env vars to `notification_configs` table. DB migration runs on startup. Log level applies immediately on save. Only `DATABASE_URL` and `SCAN_INTERVAL_MINUTES` remain as env vars. |
| 21 | ZFS pool detection via lsblk FSTYPE/LABEL | `lsblk` extended with `FSTYPE` and `LABEL` columns; drives with `fstype: zfs_member` (disk or partition) get `zfs_pool` populated. `zpool list -Hp` provides pool usage stats. Graceful degradation when ZFS not loaded. |
| 22 | Bay status field | Bays have `status: normal \| damaged \| hot_spare \| cold_spare`. Set via Bay Status tab in click modal. Visual badges in BaySlot (all 3 sizes). Status banner in DriveCard for non-normal occupied bays. |
| 23 | Pool stats endpoint | `GET /api/pools` returns `list[PoolRead]` from `zpool list`. Called from Dashboard on load. Pool usage bar shown in DriveCard when drive's pool is identified. |
