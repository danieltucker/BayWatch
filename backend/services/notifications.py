"""
Pluggable notification dispatch.

To add a new channel:
1. Implement a function matching the signature: async def send(message: str, config: dict) -> None
2. Register it in CHANNEL_HANDLERS below.
"""
import json
import logging
import os
from typing import Protocol

import httpx

from db.base import SessionLocal
from models.alert import Alert
from models.notification_config import NotificationConfig

logger = logging.getLogger(__name__)


class ChannelHandler(Protocol):
    async def __call__(self, message: str, config: dict) -> None: ...


# ── Telegram ──────────────────────────────────────────────────────────────────

async def _send_telegram(message: str, config: dict) -> None:
    token = config.get("bot_token") or os.getenv("TELEGRAM_BOT_TOKEN", "")
    chat_id = config.get("chat_id") or os.getenv("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        logger.warning("Telegram not configured — skipping notification")
        return

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(url, json={"chat_id": chat_id, "text": message, "parse_mode": "HTML"})
        resp.raise_for_status()


CHANNEL_HANDLERS: dict[str, ChannelHandler] = {
    "telegram": _send_telegram,
}


# ── Public API ────────────────────────────────────────────────────────────────

async def dispatch(channel: str, message: str, alert_type: str, drive_serial: str | None = None) -> None:
    """Send a notification and log it to the Alert table."""
    handler = CHANNEL_HANDLERS.get(channel)
    if handler is None:
        logger.error("Unknown notification channel: %s", channel)
        return

    db = SessionLocal()
    try:
        cfg_row = db.query(NotificationConfig).filter_by(channel=channel).first()
        config: dict = {}
        if cfg_row and cfg_row.config_json:
            try:
                config = json.loads(cfg_row.config_json)
            except json.JSONDecodeError:
                pass

        db.add(Alert(type=alert_type, channel=channel, message=message, drive_serial=drive_serial))
        db.commit()
        try:
            await handler(message, config)
        except Exception as exc:
            logger.error("Failed to send %s notification: %s", channel, exc)
    finally:
        db.close()


async def dispatch_critical(message: str, drive_serial: str | None = None) -> None:
    db = SessionLocal()
    try:
        configs = db.query(NotificationConfig).filter_by(critical_enabled=True).all()
        channels = [c.channel for c in configs]
    finally:
        db.close()

    for channel in channels:
        await dispatch(channel, f"🚨 <b>CRITICAL</b>\n{message}", "critical", drive_serial)


async def dispatch_status(message: str) -> None:
    db = SessionLocal()
    try:
        configs = db.query(NotificationConfig).filter(
            NotificationConfig.status_frequency != "disabled"
        ).all()
        channels = [c.channel for c in configs]
    finally:
        db.close()

    for channel in channels:
        await dispatch(channel, message, "status")
