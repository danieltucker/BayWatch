"""
External API — /v1/ prefix, requires API key auth.

All endpoints return JSON. Authentication: Authorization: Bearer <api_key>
Rate limit: 120 requests/minute per key.
"""
import datetime
import socket

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.deps import get_db, require_api_key
from api.schemas import DriveHistoryRead, DriveRead, EnclosureRead, ExternalBayRead, PoolRead
from models.bay import Bay
from models.bay_array import BayArray
from models.drive import Drive
from models.drive_history import DriveHistory
from models.enclosure import Enclosure
from services import zpool as zpool_svc

router = APIRouter()

_VERSION = "1.7.0"


@router.get("/v1/health")
def external_health():
    """Unauthenticated liveness check — used by federation to verify connectivity."""
    try:
        hostname = socket.gethostname()
    except Exception:
        hostname = "unknown"
    return {"status": "ok", "version": _VERSION, "instance_name": hostname}


@router.get("/v1/drives", response_model=list[DriveRead], dependencies=[Depends(require_api_key)])
def external_list_drives(serial: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Drive)
    if serial:
        q = q.filter(Drive.serial == serial)
    return q.all()


@router.get("/v1/drives/{serial}", response_model=DriveRead, dependencies=[Depends(require_api_key)])
def external_get_drive(serial: str, db: Session = Depends(get_db)):
    drive = db.get(Drive, serial)
    if not drive:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Drive not found")
    return drive


@router.get("/v1/drives/{serial}/history", response_model=list[DriveHistoryRead], dependencies=[Depends(require_api_key)])
def external_drive_history(
    serial: str,
    days: int = Query(default=30, ge=1, le=90),
    db: Session = Depends(get_db),
):
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=days)
    return (
        db.query(DriveHistory)
        .filter(DriveHistory.drive_serial == serial, DriveHistory.recorded_at >= cutoff)
        .order_by(DriveHistory.recorded_at.asc())
        .all()
    )


@router.get("/v1/bays", response_model=list[ExternalBayRead], dependencies=[Depends(require_api_key)])
def external_list_bays(array_id: int | None = None, db: Session = Depends(get_db)):
    q = (
        db.query(Bay, BayArray.name.label("array_name"), Enclosure.name.label("enclosure_name"))
        .join(BayArray, Bay.array_id == BayArray.id)
        .join(Enclosure, BayArray.enclosure_id == Enclosure.id)
    )
    if array_id is not None:
        q = q.filter(Bay.array_id == array_id)

    results = []
    for bay, array_name, enclosure_name in q.all():
        results.append(ExternalBayRead.model_validate({
            "id": bay.id,
            "array_id": bay.array_id,
            "row": bay.row,
            "col": bay.col,
            "label": bay.label,
            "status": bay.status,
            "drive_serial": bay.drive_serial,
            "array_name": array_name,
            "enclosure_name": enclosure_name,
        }))
    return results


@router.get("/v1/enclosures", response_model=list[EnclosureRead], dependencies=[Depends(require_api_key)])
def external_list_enclosures(db: Session = Depends(get_db)):
    return db.query(Enclosure).all()


@router.get("/v1/pools", response_model=list[PoolRead], dependencies=[Depends(require_api_key)])
def external_list_pools():
    stats = zpool_svc.get_pool_stats()
    return [
        PoolRead(
            name=ps.name,
            size_bytes=ps.size_bytes,
            alloc_bytes=ps.alloc_bytes,
            free_bytes=max(0, ps.size_bytes - ps.alloc_bytes),
            capacity_pct=ps.capacity_pct,
        )
        for ps in stats
    ]
