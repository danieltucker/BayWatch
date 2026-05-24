# DriveMap

A self-hosted Docker app that creates a visual bay map for your NAS or server — showing which drive is in which slot, with live SMART health, temperature, warranty status, and more.

No more pulling drives to figure out which one is which.

## Features

- Visual drag-and-drop bay grid for one or more enclosures
- Automated SMART, temperature, power-on hours, and reallocated sector collection
- Per-drive metadata: make, model, serial, capacity, firmware, form factor
- Customizable draggable widget bar — Total Drives, Health %, Avg Temp, Hottest Drive, Total Capacity, and more
- Terminal console — press `` ` `` for live logs with level filtering and a full command interface
- Warranty tracking with expiry alerts
- Telegram alerts for SMART failures, overtemp, and warranty warnings
- CSV bulk import for existing drive inventories
- Works on TrueNAS Scale, Unraid, or any Linux-based host

---

## Installing on TrueNAS Scale

DriveMap ships as a single combined container (nginx + uvicorn), so the entire app is one image with one port.

### Option A — Custom App via iX Apps UI (recommended for auto-updates)

This is the preferred setup if you use Watchtower or want to manage DriveMap through the TrueNAS Apps UI directly.

1. In the TrueNAS web UI, go to **Apps → Discover Apps → Custom App**
2. Fill in the sections as follows:

**Image Configuration**
| Field | Value |
|---|---|
| Repository | `danielgt/drivemap` |
| Tag | `latest` |
| Pull Policy | Always pull (so Watchtower and manual restarts pick up new versions) |

**Container Configuration → Ports**

Click **Add**, then set:
| Field | Value |
|---|---|
| Host Port | `8585` (or any port you prefer) |
| Container Port | `80` |
| Protocol | TCP |

**Container Configuration → Environment Variables**

Click **Add** for each:
| Name | Value |
|---|---|
| `DATABASE_URL` | `sqlite:////app/data/drivemap.db` |
| `SCAN_INTERVAL_MINUTES` | `60` |

> Temperature threshold, log level, and Telegram credentials are configured inside the app under **Settings → Notifications** — no env vars needed for these.

**Container Configuration → Storage**

Add two host path mounts:

| Host Path | Mount Path | Read Only |
|---|---|---|
| `/dev` | `/dev` | No |
| `/run/udev` | `/run/udev` | Yes |

Add one volume for persistent data:

| Type | Mount Path |
|---|---|
| ixVolume (or host path of your choice) | `/app/data` |

> Use an ixVolume or a bind-mount to a path on your pool (e.g. `/mnt/tank/drivemap-data`). This is where the SQLite database lives — your bay map, drive profiles, and settings are all stored here.

**Security Context**

Enable **Privileged Mode** (required for `smartctl` to access block devices).

3. Click **Install**

### Option B — docker-compose (direct YAML)

Paste [`docker-compose.truenas.yml`](docker-compose.truenas.yml) into the **Compose File** field in Custom App, or run it directly with `docker compose`:

```yaml
services:
  drivemap:
    image: danielgt/drivemap:latest
    restart: unless-stopped
    volumes:
      - /dev:/dev
      - /run/udev:/run/udev:ro
      - drivemap_data:/app/data
    privileged: true
    ports:
      - "8585:80"
    environment:
      DATABASE_URL: sqlite:////app/data/drivemap.db
      SCAN_INTERVAL_MINUTES: "60"

volumes:
  drivemap_data:
```

---

## Auto-updates with Watchtower

If you run Watchtower as an iX App (or as a container), it will automatically update DriveMap whenever a new `latest` tag is pushed to Docker Hub — no manual steps required.

**Watchtower iX App setup:**

| Field | Value |
|---|---|
| Repository | `containrrr/watchtower` |
| Tag | `latest` |
| Pull Policy | Always pull |

Under **Volumes**, mount the Docker socket:
| Host Path | Mount Path |
|---|---|
| `/var/run/docker.sock` | `/var/run/docker.sock` |

Watchtower will poll Docker Hub every 24 hours by default and restart any containers whose image has been updated.

> Your data is stored in the `/app/data` volume and is never touched during an update — only the container image is replaced.

---

## Accessing the app

Once running, open:

```
http://<truenas-ip>:8585
```

---

## First-time setup

1. Go to **Settings** (top-right) and add an enclosure (e.g. "TrueNAS Main", type: Server)
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

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:////app/data/drivemap.db` | SQLite path inside the container |
| `SCAN_INTERVAL_MINUTES` | `60` | How often background scan runs |

The following are configured inside the app under **Settings → Notifications** and do not need to be set as env vars:
temperature alert threshold, warranty warning days, log level, Telegram bot token, and Telegram chat ID.

---

## Console Commands

Press `` ` `` to open the terminal console. Type `help` for a full command list.

| Command | Description |
|---|---|
| `drives` | List all drives |
| `drive <serial>` | Full details for a drive |
| `find <query>` | Search by model, make, serial, or device path |
| `scan` | Trigger a drive scan |
| `edit <serial> <field> <value>` | Edit a drive field (`make`, `model`, `form_factor`, `rpm`) |
| `profile <serial>` | Show warranty and purchase info |
| `bays` | List all enclosures and bay assignments |
| `assign <serial> <bay-label>` | Assign a drive to a bay |
| `unassign <bay-label>` | Remove a bay assignment |
| `logs [level]` | Toggle log level filter |
| `clear` | Clear console output |

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

---

## Requirements

- Docker & Docker Compose
- Linux host (bare metal or VM) — required for `/dev` access and SMART data
- Privileged container mode (granted in the compose file)

---

## Drive Health Score

Each drive displays a composite health score from 0–100, shown as a ring gauge in the drive details panel.

### How it's calculated

The score starts at **100** for any drive with a `PASSED` SMART status. Drives with a `FAILED` SMART status are immediately scored **0**. Drives with an `UNKNOWN` status show no score.

Deductions are then applied based on the following factors:

| Factor | Condition | Deduction |
|---|---|---|
| **SMART status** | `FAILED` | Score = 0 immediately |
| **Reallocated sectors** | > 0 | −4 per sector, max −40 |
| **Pending sectors** | > 0 | −5 per sector, max −25 |
| **Uncorrectable errors** | > 0 | −10 per error, max −35 |
| **Power-on hours** | > 50,000 h | −20 |
| **Power-on hours** | > 40,000 h | −12 |
| **Power-on hours** | > 25,000 h | −5 |
| **Temperature** | ≥ 60°C | −15 |
| **Temperature** | ≥ 55°C | −8 |
| **Temperature** | ≥ 50°C | −3 |

The final score is floored at 0. Only the highest matching power-on hours tier and temperature tier apply (they are `else if` conditions, not additive).

### Score labels

| Score | Label |
|---|---|
| 90–100 | Excellent |
| 75–89 | Good |
| 60–74 | Fair |
| 40–59 | Poor |
| 0–39 | Critical |

A drive with SMART `PASSED`, no sector errors, 30,000 power-on hours, and a 48°C temperature would score **95** (−5 for POH tier). The same drive at 56°C would score **87** (−5 POH −8 temp).

---

## External API

DriveMap exposes a versioned REST API at `/v1/` for external access — useful for dashboards, monitoring systems, and federation between instances.

### Authentication

All `/v1/` endpoints (except `/v1/health`) require an API key passed as a Bearer token:

```
Authorization: Bearer dm_your_key_here
```

Generate keys in **Settings → API Keys**. The full plaintext key is shown once at creation — store it securely.

**Rate limit:** 120 requests per minute per key. Exceeding the limit returns `429 Too Many Requests`.

### Endpoints

#### Health (unauthenticated)

```bash
curl http://192.168.1.50:8585/v1/health
# {"status":"ok","version":"1.0.0","instance_name":"truenas"}
```

#### Drives

```bash
# All drives
curl -H "Authorization: Bearer dm_..." http://192.168.1.50:8585/v1/drives

# Filter by serial
curl -H "Authorization: Bearer dm_..." "http://192.168.1.50:8585/v1/drives?serial=WD-WX41E23T1234"

# Single drive
curl -H "Authorization: Bearer dm_..." http://192.168.1.50:8585/v1/drives/WD-WX41E23T1234
```

#### Drive History

```bash
# Last 30 days (default)
curl -H "Authorization: Bearer dm_..." http://192.168.1.50:8585/v1/drives/WD-WX41E23T1234/history

# Custom range (max 90 days)
curl -H "Authorization: Bearer dm_..." "http://192.168.1.50:8585/v1/drives/WD-WX41E23T1234/history?days=7"
```

Response fields per history entry: `scanned_at`, `temperature_c`, `reallocated_sectors`, `power_on_hours`, `read_bytes`, `write_bytes`, `used_bytes`.

#### Bays

```bash
# All bays across all enclosures (includes enclosure_name, array_name)
curl -H "Authorization: Bearer dm_..." http://192.168.1.50:8585/v1/bays

# Filter by array
curl -H "Authorization: Bearer dm_..." "http://192.168.1.50:8585/v1/bays?array_id=1"
```

#### Enclosures

```bash
curl -H "Authorization: Bearer dm_..." http://192.168.1.50:8585/v1/enclosures
```

#### Pools

```bash
curl -H "Authorization: Bearer dm_..." http://192.168.1.50:8585/v1/pools
```

---

## Federation

Federation lets you configure a DriveMap instance as a hub that pulls data from one or more remote DriveMap instances ("targets") and displays them in the Dashboard under **Remote Instances**.

### Setup

**On each target instance:**
1. Go to **Settings → API Keys** and generate a key. Copy it — it's shown once.

**On the hub instance:**
1. Go to **Settings → Federation** and click **Add Target**.
2. Enter a name, the target's URL (e.g. `http://192.168.1.51:8585`), the API key from step 1, and a sync interval.
3. The hub will poll the target at the configured interval and cache its drive, bay, and pool data in memory.

The **Remote Instances** panel appears in the Dashboard when at least one target has synced successfully. Each remote instance shows a compact list of its drives with SMART status, temperature, and ZFS pool.

### Notes

- Federation targets must be running DriveMap v1.0.0 or later (requires the `/v1/` API endpoints).
- Federation target API keys are stored in plaintext in the local SQLite database — the same threat model as the Telegram bot token. This is appropriate for LAN-only deployments with a trusted host.
- Before exposing any DriveMap instance to the internet, restrict CORS origins and place the app behind a reverse proxy with TLS and authentication.

---

## Changelog

See [project/changelog.md](project/changelog.md).

## Project Docs

- [Data model, tech stack, decisions](project/info.md)
- [File structure](project/structure.md)
- [Version history](project/changelog.md)
