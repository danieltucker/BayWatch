# Project: Drive Position — LLM Reference

## Purpose

Drive Position is a self-hosted web application designed to run inside a Docker container on TrueNAS Scale (or any Linux-based NAS). It solves a practical problem: identifying which physical drive bay a specific disk occupies without manually pulling drives.

## Problem Being Solved

When managing a NAS with many drives, identifying which physical bay holds a specific drive (by serial, size, or label) requires either pulling drives or cross-referencing incomplete documentation. Drive Position provides a persistent, visual map that connects physical bay positions to drive identities and metadata.

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

### DriveProfile (user-entered)
- `serial` (PK, FK → Drive)
- `purchase_date`
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
