# DriveMap

A Docker-hosted web application for TrueNAS Scale (and similar NAS systems) that creates a visual map of drive bays, tracks drive metadata, and surfaces automated SMART/disk health data — so you never have to manually pull drives to identify them again.

## Features

- Visual drag-and-drop bay map of your enclosure
- Per-drive metadata: make/model, serial number, size, mfg date, purchase date, warranty period, warranty remaining
- Automated data collection via SMART, lsblk, and hdparm
- SMART health status and temperature at a glance
- Warranty expiration alerts
- REST API for integration with other tools

## Quick Start

```bash
docker compose up -d
```

Then open `http://localhost:8080` in your browser.

## Requirements

- Docker & Docker Compose
- Host access to `/dev/disk` or equivalent (for SMART data)
- TrueNAS Scale, Unraid, or any Linux-based NAS (bare metal or VM also supported)

## Configuration

See [project/info.md](project/info.md) for full configuration reference.

## Changelog

See [project/changelog.md](project/changelog.md).

## Project Status

`v0.1.0` — In development. See [project/structure.md](project/structure.md) for current layout.
