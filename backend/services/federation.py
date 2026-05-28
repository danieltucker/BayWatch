"""
Federation service — polls remote BayWatch instances and caches their data in memory.

Remote snapshots are stored in `_snapshots` (target_id → RemoteSnapshot).
The scheduler calls `poll_due_targets()` on each tick.
"""
from __future__ import annotations

import datetime
import logging
from dataclasses import dataclass, field

import httpx

from db.base import SessionLocal
from models.federated_target import FederatedTarget

logger = logging.getLogger(__name__)

_HTTP_TIMEOUT = 10.0


@dataclass
class RemoteSnapshot:
    target_id: int
    target_name: str
    target_url: str
    fetched_at: str  # ISO string — safe for direct JSON serialization
    drives: list[dict] = field(default_factory=list)
    bays: list[dict] = field(default_factory=list)
    pools: list[dict] = field(default_factory=list)


_snapshots: dict[int, RemoteSnapshot] = {}


def get_all_remote_snapshots() -> list[dict]:
    return [
        {
            "target_id": s.target_id,
            "target_name": s.target_name,
            "target_url": s.target_url,
            "fetched_at": s.fetched_at,
            "drives": s.drives,
            "bays": s.bays,
            "pools": s.pools,
        }
        for s in _snapshots.values()
    ]


def evict_snapshot(target_id: int) -> None:
    _snapshots.pop(target_id, None)


def poll_target_by_id(target_id: int) -> None:
    """Fetch one target by ID — safe to call from a background task."""
    db = SessionLocal()
    try:
        target = db.get(FederatedTarget, target_id)
        if target:
            _do_poll(target, db)
    finally:
        db.close()


def poll_due_targets() -> None:
    """Poll all enabled targets whose sync interval has elapsed. Called by scheduler."""
    db = SessionLocal()
    try:
        targets = db.query(FederatedTarget).filter(FederatedTarget.enabled.is_(True)).all()
        now = datetime.datetime.utcnow()
        for target in targets:
            if target.last_synced_at is None:
                due = True
            else:
                elapsed = (now - target.last_synced_at).total_seconds() / 60
                due = elapsed >= target.sync_interval_minutes
            if due:
                _do_poll(target, db)
    finally:
        db.close()


def _do_poll(target: FederatedTarget, db) -> None:
    headers = {"Authorization": f"Bearer {target.api_key}"}
    base = target.url.rstrip("/")
    try:
        with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
            drives_resp = client.get(f"{base}/v1/drives", headers=headers)
            drives_resp.raise_for_status()

            bays_resp = client.get(f"{base}/v1/bays", headers=headers)
            bays_resp.raise_for_status()

            pools_resp = client.get(f"{base}/v1/pools", headers=headers)
            pools_resp.raise_for_status()

        _snapshots[target.id] = RemoteSnapshot(
            target_id=target.id,
            target_name=target.name,
            target_url=target.url,
            fetched_at=datetime.datetime.utcnow().isoformat(),
            drives=drives_resp.json(),
            bays=bays_resp.json(),
            pools=pools_resp.json(),
        )
        target.last_synced_at = datetime.datetime.utcnow()
        target.last_error = None
        db.commit()
        logger.info("Federation: synced %s (%d drives)", target.name, len(drives_resp.json()))
    except Exception as exc:
        msg = str(exc)[:512]
        target.last_error = msg
        db.commit()
        logger.warning("Federation: failed to sync %s: %s", target.name, msg)
