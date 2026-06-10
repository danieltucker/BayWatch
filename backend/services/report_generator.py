import datetime
import json

from sqlalchemy.orm import Session

from models.bay import Bay
from models.bay_array import BayArray
from models.drive import Drive
from models.drive_history import DriveHistory
from models.enclosure import Enclosure

WARN_TEMP = 55
DANGER_TEMP = 65


def generate_report_data(
    db: Session,
    period_start: datetime.datetime,
    period_end: datetime.datetime,
) -> str:
    drives = db.query(Drive).all()

    # bay serial -> {enclosure, array, bay_label}
    bay_map: dict[str, dict] = {}
    for bay in db.query(Bay).filter(Bay.drive_serial.isnot(None)).all():
        arr = db.get(BayArray, bay.array_id)
        if arr:
            enc = db.get(Enclosure, arr.enclosure_id)
            bay_map[bay.drive_serial] = {
                "enclosure": enc.name if enc else "",
                "array": arr.name,
                "bay": bay.label or f"R{bay.row + 1}C{bay.col + 1}",
            }

    # ── Summary ──────────────────────────────────────────────────────────────
    total = len(drives)
    passed = sum(1 for d in drives if d.smart_status == "PASSED")
    failed = sum(1 for d in drives if d.smart_status == "FAILED")
    unknown = total - passed - failed
    temps_now = [d.temperature_c for d in drives if d.temperature_c is not None]
    avg_temp = round(sum(temps_now) / len(temps_now), 1) if temps_now else None
    drives_with_errors = sum(
        1 for d in drives
        if (d.reallocated_sectors or 0) > 0
        or (d.pending_sectors or 0) > 0
        or (d.uncorrectable_errors or 0) > 0
    )

    # ── Inventory ────────────────────────────────────────────────────────────
    inventory = []
    for d in drives:
        loc = bay_map.get(d.serial, {})
        cap_str = None
        if d.capacity_bytes:
            cap_str = (
                f"{d.capacity_bytes / 1e12:.1f} TB"
                if d.capacity_bytes >= 1e12
                else f"{d.capacity_bytes / 1e9:.0f} GB"
            )
        inventory.append({
            "serial": d.serial,
            "make": d.make,
            "model": d.model,
            "drive_type": d.drive_type,
            "form_factor": d.form_factor,
            "capacity": cap_str,
            "capacity_bytes": d.capacity_bytes,
            "smart_status": d.smart_status,
            "temperature_c": d.temperature_c,
            "power_on_hours": d.power_on_hours,
            "reallocated_sectors": d.reallocated_sectors,
            "pending_sectors": d.pending_sectors,
            "uncorrectable_errors": d.uncorrectable_errors,
            "zfs_pool": d.zfs_pool,
            "vdev_name": d.vdev_name,
            "is_connected": d.is_connected,
            "enclosure": loc.get("enclosure"),
            "array": loc.get("array"),
            "bay": loc.get("bay"),
            "last_scanned": d.last_scanned.isoformat() if d.last_scanned else None,
        })
    inventory.sort(key=lambda x: (x["smart_status"] == "FAILED", x["smart_status"] == "UNKNOWN"), reverse=True)

    # ── SMART events ─────────────────────────────────────────────────────────
    smart_events = []
    for d in drives:
        if d.smart_status == "FAILED":
            smart_events.append({
                "serial": d.serial,
                "make": d.make,
                "model": d.model,
                "event_type": "smart_failed",
                "description": "SMART self-test FAILED",
            })
        if d.reallocated_sectors and d.reallocated_sectors > 0:
            smart_events.append({
                "serial": d.serial,
                "make": d.make,
                "model": d.model,
                "event_type": "reallocated_sectors",
                "value": d.reallocated_sectors,
                "description": f"{d.reallocated_sectors} reallocated sector(s)",
            })
        if d.pending_sectors and d.pending_sectors > 0:
            smart_events.append({
                "serial": d.serial,
                "make": d.make,
                "model": d.model,
                "event_type": "pending_sectors",
                "value": d.pending_sectors,
                "description": f"{d.pending_sectors} pending sector(s)",
            })
        if d.uncorrectable_errors and d.uncorrectable_errors > 0:
            smart_events.append({
                "serial": d.serial,
                "make": d.make,
                "model": d.model,
                "event_type": "uncorrectable_errors",
                "value": d.uncorrectable_errors,
                "description": f"{d.uncorrectable_errors} uncorrectable error(s)",
            })

    # ── Temperature history ───────────────────────────────────────────────────
    temp_stats = []
    for d in drives:
        history = (
            db.query(DriveHistory)
            .filter(
                DriveHistory.drive_serial == d.serial,
                DriveHistory.recorded_at >= period_start,
                DriveHistory.recorded_at <= period_end,
                DriveHistory.temperature_c.isnot(None),
            )
            .all()
        )
        if not history:
            temp_stats.append({
                "serial": d.serial,
                "make": d.make,
                "model": d.model,
                "current_temp": d.temperature_c,
                "avg_temp": None,
                "peak_temp": None,
                "hours_above_warn": None,
                "hours_above_danger": None,
                "data_points": 0,
            })
            continue
        temps_h = [h.temperature_c for h in history]
        avg = round(sum(temps_h) / len(temps_h), 1)
        peak = max(temps_h)
        # Each history point represents ~6h; scale accordingly
        scale = 6.0
        hours_warn = round(sum(1 for t in temps_h if t >= WARN_TEMP) * scale, 1)
        hours_danger = round(sum(1 for t in temps_h if t >= DANGER_TEMP) * scale, 1)
        temp_stats.append({
            "serial": d.serial,
            "make": d.make,
            "model": d.model,
            "current_temp": d.temperature_c,
            "avg_temp": avg,
            "peak_temp": peak,
            "hours_above_warn": hours_warn,
            "hours_above_danger": hours_danger,
            "data_points": len(history),
        })
    temp_stats.sort(key=lambda x: x.get("peak_temp") or 0, reverse=True)

    # ── ZFS pools ────────────────────────────────────────────────────────────
    pools: dict[str, dict] = {}
    for d in drives:
        if d.zfs_pool:
            p = pools.setdefault(d.zfs_pool, {"name": d.zfs_pool, "drives": [], "vdevs": set()})
            p["drives"].append(d.serial)
            if d.vdev_name:
                p["vdevs"].add(d.vdev_name)
    pool_list = [
        {"name": p["name"], "drive_count": len(p["drives"]), "vdevs": list(p["vdevs"])}
        for p in pools.values()
    ]

    return json.dumps({
        "summary": {
            "total_drives": total,
            "passed": passed,
            "failed": failed,
            "unknown": unknown,
            "avg_temp_c": avg_temp,
            "drives_with_errors": drives_with_errors,
            "disconnected": sum(1 for d in drives if not d.is_connected),
        },
        "inventory": inventory,
        "smart_events": smart_events,
        "temperature": temp_stats,
        "pools": pool_list,
    })
