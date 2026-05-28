# Changelog

All notable changes to BayWatch are documented here. Follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
