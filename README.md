# DriveMap

A self-hosted Docker app that creates a visual bay map for your NAS or server — showing which drive is in which slot, with live SMART health, temperature, warranty status, and more.

No more pulling drives to figure out which one is which.

## Features

- Visual drag-and-drop bay grid for one or more enclosures
- Automated SMART, temperature, power-on hours, and reallocated sector collection
- Per-drive metadata: make, model, serial, capacity, firmware, form factor
- Warranty tracking with expiry alerts
- Telegram alerts for SMART failures, overtemp, and warranty warnings
- CSV bulk import for existing drive inventories
- REST API for integration with other tools
- Works on TrueNAS Scale, Unraid, or any Linux-based host

---

## Installing on TrueNAS Scale

### 1. Pre-create the data directory

Open a TrueNAS shell (**System → Shell**) and run:

```bash
mkdir -p "/mnt/Core Storage/Containers/drivemap/data"
```

Replace `Core Storage` with the name of your pool if it differs.

### 2. Install via Custom App

1. In the TrueNAS web UI, go to **Apps → Discover Apps → Custom App**
2. Set **Application Name** to `drivemap`
3. In the **Compose File** field, paste the contents of [`docker-compose.truenas.yml`](docker-compose.truenas.yml):

```yaml
services:
  backend:
    image: danielgt/drivemap-backend:latest
    restart: unless-stopped
    volumes:
      - /dev:/dev
      - /run/udev:/run/udev:ro
      - drivemap_data:/app/data
    cap_add:
      - SYS_RAWIO
      - SYS_ADMIN
    environment:
      DATABASE_URL: sqlite:////app/data/drivemap.db
      SCAN_INTERVAL_MINUTES: "60"
      TEMP_ALERT_THRESHOLD_C: "55"
      WARRANTY_WARNING_DAYS: "90"
      LOG_LEVEL: INFO
      # Optional — fill in to enable Telegram alerts:
      # TELEGRAM_BOT_TOKEN: ""
      # TELEGRAM_CHAT_ID: ""
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s

  frontend:
    image: danielgt/drivemap-frontend:latest
    restart: unless-stopped
    ports:
      - "8585:80"
    depends_on:
      - backend

volumes:
  drivemap_data:
```

4. Click **Install**

> **Why a named volume instead of a bind mount?** TrueNAS Scale's Custom App UI does not process `.env` files or `${VAR:-default}` syntax, and its compose runner can mishandle bind mount paths that contain spaces. A named volume avoids both issues. TrueNAS manages it under `.ix-apps` on your pool — it persists across restarts and upgrades.
>
> **Why no `networks:` block?** TrueNAS Scale manages its own bridge network. An explicit `driver: bridge` causes the deploy to fail.

### 3. Access the app

Once both containers are running, open:

```
http://<truenas-ip>:8585
```

### 4. First-time setup

1. Go to **Settings** and add an enclosure (e.g. "TrueNAS Main", type: Server)
2. Add a bay array with the correct row × column layout for your chassis
3. Click **Scan** on the Dashboard to detect all drives
4. Drag drives from the sidebar into the correct bay slots

---

## Installing on Other Systems

### Docker Compose (generic Linux)

```bash
git clone https://github.com/danielgt/drivemap.git
cd drivemap
cp .env.example .env
docker compose up -d
```

Then open `http://localhost:8585`.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `APP_PORT` | `8585` | Port the web UI listens on |
| `DATABASE_URL` | `sqlite:////app/data/drivemap.db` | SQLite path inside the container |
| `SCAN_INTERVAL_MINUTES` | `60` | How often background scan runs |
| `TEMP_ALERT_THRESHOLD_C` | `55` | Temperature (°C) that triggers a critical alert |
| `WARRANTY_WARNING_DAYS` | `90` | Days before expiry to show warranty warning |
| `TELEGRAM_BOT_TOKEN` | — | Telegram bot token for alerts |
| `TELEGRAM_CHAT_ID` | — | Telegram chat or channel ID |
| `LOG_LEVEL` | `INFO` | Python log level (`DEBUG`, `INFO`, `WARNING`) |

---

## CSV Import

You can bulk-import drive inventory from a spreadsheet via **Settings → Import Drives from CSV**.

Supported columns (all optional except **Serial**):

| Column | Description |
|---|---|
| `Serial` | Drive serial number — required, used as the unique key |
| `Position` | Bay label — assigns the drive to a matching bay if found |
| `Dev Name` | Device path, e.g. `/dev/sda` |
| `Make` | Manufacturer |
| `Model` | Drive model |
| `Size` | Capacity — accepts `4 TB`, `500 GB`, `4000 GB` |
| `Mfg Date` | Manufacturing date — accepts `YYYY-MM-DD`, `MM/DD/YYYY`, `DD/MM/YYYY` |
| `Source` | Vendor / where it was purchased |
| `Warranty` | Warranty period — accepts `24`, `24 months`, `2 years` |
| `Notes` | Free-text notes |

The import returns a summary: drives created, drives updated, bays assigned, and any skipped rows with reasons.

---

## Requirements

- Docker & Docker Compose
- Linux host (bare metal or VM) — required for `/dev` access and SMART data
- `SYS_RAWIO` + `SYS_ADMIN` capabilities (granted in the compose file — no `privileged: true` needed)

---

## Changelog

See [project/changelog.md](project/changelog.md).

## Project Docs

- [Data model, tech stack, decisions](project/info.md)
- [File structure](project/structure.md)
- [Version history](project/changelog.md)
