"""
Background scheduler — runs periodic disk scans and status alert dispatches.
Uses APScheduler with an in-process AsyncIOScheduler.
Started/stopped via FastAPI lifespan in main.py.
"""
import asyncio
import datetime
import logging
import os

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from db.base import SessionLocal
from models.drive import Drive
from models.drive_profile import DriveProfile
from models.notification_config import NotificationConfig
from services import federation, notifications, scanner

logger = logging.getLogger(__name__)

_scheduler = AsyncIOScheduler()


def start():
    interval_minutes = int(os.getenv("SCAN_INTERVAL_MINUTES", "60"))

    if interval_minutes > 0:
        _scheduler.add_job(
            _scan_and_check,
            IntervalTrigger(minutes=interval_minutes),
            id="periodic_scan",
            replace_existing=True,
        )
        logger.info("Scheduled disk scan every %d minutes", interval_minutes)

    # Status digest — re-evaluated each run; actual send gated by config
    _scheduler.add_job(
        _maybe_send_status_digest,
        CronTrigger(hour=8, minute=0),  # 08:00 daily; frequency filter applied inside
        id="status_digest",
        replace_existing=True,
    )

    _scheduler.start()
    logger.info("Scheduler started")


def stop():
    if _scheduler.running:
        _scheduler.shutdown(wait=False)


async def _scan_and_check() -> None:
    db: Session = SessionLocal()
    try:
        config = db.query(NotificationConfig).filter_by(channel="telegram").first()
        temp_threshold = config.temp_alert_threshold_c if config else 55
        connected_drives, newly_disconnected = scanner.run_scan(db)
        await _check_critical_conditions(connected_drives, temp_threshold)
        await _check_disconnected(newly_disconnected)
    finally:
        db.close()
    # Poll federation targets whose sync interval has elapsed (runs in executor
    # to keep the event loop free — federation.poll_due_targets is synchronous)
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, federation.poll_due_targets)


async def _check_critical_conditions(drives: list[Drive], temp_threshold: int) -> None:
    for drive in drives:
        if drive.smart_status == "FAILED":
            await notifications.dispatch_critical(
                f"Drive <b>{drive.serial}</b> ({drive.model or 'unknown'}) "
                f"reported SMART failure on {drive.device_path}.",
                drive_serial=drive.serial,
            )

        if drive.temperature_c is not None and drive.temperature_c >= temp_threshold:
            await notifications.dispatch_critical(
                f"Drive <b>{drive.serial}</b> ({drive.model or 'unknown'}) "
                f"temperature is {drive.temperature_c}°C — threshold is {temp_threshold}°C.",
                drive_serial=drive.serial,
            )

        if (drive.reallocated_sectors or 0) > 0:
            await notifications.dispatch_critical(
                f"Drive <b>{drive.serial}</b> ({drive.model or 'unknown'}) "
                f"has {drive.reallocated_sectors} reallocated sectors.",
                drive_serial=drive.serial,
            )


async def _check_disconnected(drives: list[Drive]) -> None:
    for drive in drives:
        await notifications.dispatch_critical(
            f"⚠️ Drive <b>{drive.serial}</b> ({drive.model or 'unknown'}) is no longer detected.",
            drive_serial=drive.serial,
        )


async def _maybe_send_status_digest() -> None:
    db: Session = SessionLocal()
    try:
        config = db.query(NotificationConfig).filter_by(channel="telegram").first()
        if not config or config.status_frequency == "disabled":
            return

        today = datetime.date.today()
        if not _should_send_today(config.status_frequency, today):
            return

        message = _build_status_message(db, config.warranty_warning_days)
        await notifications.dispatch_status(message)
    finally:
        db.close()


def _should_send_today(frequency: str, today: datetime.date) -> bool:
    if frequency == "daily":
        return True
    if frequency == "weekly":
        return today.weekday() == 0  # Monday
    if frequency == "monthly":
        return today.day == 1
    return False


def _build_status_message(db: Session, warranty_warning_days: int) -> str:
    drives = db.query(Drive).all()
    lines = ["<b>DriveMap — Status Report</b>"]

    failed = [d for d in drives if d.smart_status == "FAILED"]
    if failed:
        lines.append(f"\n⚠️ <b>FAILED drives ({len(failed)}):</b>")
        for d in failed:
            lines.append(f"  • {d.serial} ({d.model or '?'}) on {d.device_path}")

    lines.append(f"\n📊 <b>All drives ({len(drives)}):</b>")
    for d in drives:
        status_icon = "✅" if d.smart_status == "PASSED" else "❌" if d.smart_status == "FAILED" else "❓"
        temp = f"{d.temperature_c}°C" if d.temperature_c is not None else "N/A"
        lines.append(f"  {status_icon} {d.serial} — {d.model or 'Unknown'} — {temp}")

    # Warranty warnings
    warranty_lines = []
    profiles = db.query(DriveProfile).all()
    for p in profiles:
        days = p.warranty_days_remaining
        if days is not None and days <= warranty_warning_days:
            label = "EXPIRED" if days < 0 else f"{days}d remaining"
            warranty_lines.append(f"  • {p.serial} — warranty {label}")

    if warranty_lines:
        lines.append(f"\n🔔 <b>Warranty warnings:</b>")
        lines.extend(warranty_lines)

    return "\n".join(lines)
