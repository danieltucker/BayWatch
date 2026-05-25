import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.deps import get_db
from api.schemas import DriveHistoryRead, PoolHistoryRead
from models.bay import Bay
from models.drive_history import DriveHistory
from models.pool_history import PoolHistory

router = APIRouter()


@router.get("/drives/{serial}", response_model=list[DriveHistoryRead])
def get_drive_history(serial: str, days: int = 30, db: Session = Depends(get_db)):
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=days)
    return (
        db.query(DriveHistory)
        .filter(DriveHistory.drive_serial == serial, DriveHistory.recorded_at >= cutoff)
        .order_by(DriveHistory.recorded_at.asc())
        .all()
    )


@router.get("/pools/{pool_name}", response_model=list[PoolHistoryRead])
def get_pool_history(pool_name: str, days: int = 30, db: Session = Depends(get_db)):
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=days)
    return (
        db.query(PoolHistory)
        .filter(PoolHistory.pool_name == pool_name, PoolHistory.recorded_at >= cutoff)
        .order_by(PoolHistory.recorded_at.asc())
        .all()
    )


@router.get("/arrays/{array_id}")
def get_array_temp_history(array_id: int, days: int = 30, db: Session = Depends(get_db)):
    """Daily average temperature across all drives currently assigned to the array."""
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=days)
    rows = (
        db.query(
            func.date(DriveHistory.recorded_at).label("date"),
            func.round(func.avg(DriveHistory.temperature_c), 1).label("avg_temp_c"),
        )
        .join(Bay, Bay.drive_serial == DriveHistory.drive_serial)
        .filter(
            Bay.array_id == array_id,
            DriveHistory.recorded_at >= cutoff,
            DriveHistory.temperature_c.isnot(None),
        )
        .group_by(func.date(DriveHistory.recorded_at))
        .order_by(func.date(DriveHistory.recorded_at).asc())
        .all()
    )
    return [{"date": str(r.date), "avg_temp_c": float(r.avg_temp_c)} for r in rows]
