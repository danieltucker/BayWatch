# Changelog

All notable changes to BayWatch are documented here. Follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.9.0] — 2026-05-28

### Added
- **Drive type classification** — new Drive Classification field in Edit Drive: Consumer HDD, NAS HDD, Enterprise HDD, Consumer SSD, Enterprise SSD, NVMe (Consumer/Enterprise), and Intel Optane; auto-detected from RPM and model if left on auto
- **Rated TBW field** — optional TB Written (TBW) field in Edit Drive; shown only for SSD-type drives; used in health score endurance factor
- **Drive-type-aware health scoring** — age curves now vary by drive class: Optane drives are expected to reach 100,000 hours; enterprise HDDs 80,000; consumer SSDs 50,000; score deductions scale proportionally
- **Cumulative heat exposure** — health score's temperature factor uses all available history to compute how much time the drive spent above warn and danger thresholds, rather than the current spot reading alone
- **TBW endurance factor** — for SSD-type drives with a rated TBW, health score deducts based on the percentage of rated lifetime writes used (sourced from `write_bytes` history)
- **Health score breakdown modal** — clicking the health ring opens a breakdown of every scoring factor with a colour-coded deduction table, recommendation text, and the full temperature history chart
- **Lifetime I/O on drive cards** — a new "Lifetime I/O" section shows cumulative bytes read and written (two proportional bars) sourced from SMART history
- **Remote drive history** — federation hub proxies drive history from remote instances via a new `/api/federation/targets/{id}/drives/{serial}/history` endpoint; displayed in the remote DriveCard with graceful fallback on error
- **Remote drive hover preview** — hovering a federated drive (in either grid or list view) shows its DriveCard in the right sidebar, matching local drive behaviour
- **Remote bay grid view** — federation panel now defaults to a colour-coded bay grid grouped by enclosure and array; matches the visual layout of the remote instance; toggle to flat list with the grid/list button; preference persists per-target in localStorage
- **Drive Health widget tiers** — the Drive Health widget detail now shows four actionable tiers: **Replace Immediately** (SMART FAILED), **Replace When Possible** (SMART errors present), **Monitor Closely** (>45,000 hours or no SMART data), and **Healthy**; each drive is listed under its tier with reason badges

### Changed
- **Health score is now drive-type-aware** — the single age curve has been replaced by type-specific curves so NAS and enterprise drives are not penalised as early as consumer models
- **Heat exposure factor uses full history** — no longer a spot check; uses all recorded temperature readings to compute weighted exposure time
- **Remote drive modal uses full DriveCard** — the federation drive detail overlay was already a DriveCard in v1.8.0; it now also receives remote history and displays the temperature chart

---

## [1.8.0] — 2026-05-28

### Added
- **`fed` console commands** — the terminal console now supports `fed list`, `fed sync <name>`, `fed status`, and `fed drives <name>` for interacting with federated instances without leaving the console

### Changed
- **Federation auto-refresh** — adding, toggling, syncing, or deleting a federation target in Settings now triggers a dashboard refresh automatically; no page reload required
- **Remote drive modal replaced with DriveCard** — clicking a drive in the Remote Instances panel now opens a full DriveCard with all SMART attributes, rather than the previous minimal drive summary overlay

---

## [1.7.0] — 2026-05-27

### Added
- **Hover-to-preview** — hovering over any occupied bay slot shows the drive's details in the right sidebar without clicking
- **Drive deletion** — drives can now be removed from the database via a delete button in the Drive Details panel (with confirmation prompt)
- **Widget persistence** — widget bar layout is saved to the backend config table and survives browser changes and container restarts

### Changed
- **Large bay slots resized** — increased height to give drive content more room; model, serial, temperature, and health are all comfortably visible
- **I/O activity chart** — redesigned with dual read/write area series and cleaner axis labels
- **Bay health indicators** — SMART status colour coding refined across all three bay sizes

---

## [1.6.0] — 2026-05-27

### Added
- **Bay click opens Edit + Details side-by-side** — clicking a bay slot that contains a drive now opens the Edit Bay & Drive modal with the Drive Details panel displayed alongside the edit form in a two-panel layout
- **Drive history modal** — a "History" button in the Drive Details footer opens a full 90-day history view with enlarged temperature, used space, reallocated sectors, and I/O activity charts

### Changed
- **Disconnect toasts** — drive-not-detected toast notifications no longer show an icon; drive name and status text are shown in amber

---

## [1.5.1] — 2026-05-27

### Added
- **Disconnected drive tracking** — drives that are no longer detected by the scanner are marked `is_connected = false` in the database rather than being left with stale data
- **Bay slot disconnected state** — bay slots with a disconnected drive show the drive at reduced opacity with a "Not detected" indicator (all three bay sizes: SM, MD, LG)
- **Drive Details disconnected banner** — an amber warning banner with last-seen timestamp appears at the top of the Drive Details panel for disconnected drives
- **Dashboard disconnect toast** — a transient amber notification appears in the bottom-right corner when a drive transitions from connected to disconnected between polls; auto-dismisses after 8 seconds
- **Backend disconnect alert** — a critical notification is dispatched via configured channels (e.g. Telegram) when a drive is no longer detected during a scan

### Changed
- **Stale data cleared on disconnect** — when a drive is marked disconnected, `device_path`, `temperature_c`, `zfs_pool`, and `vdev_name` are nulled out; temperature and ZFS sections in Drive Details disappear naturally
- **ZFS pool data** — ZFS pool and vdev fields are cleared when a drive is no longer detected, preventing stale pool membership from being shown

---

## [1.5.0] — Initial release

First public release. Core features: visual bay grid with drag-and-drop, SMART monitoring, drive health score, ZFS pool integration, Telegram notifications, widget bar, federation, REST API, CSV import, and terminal console.
