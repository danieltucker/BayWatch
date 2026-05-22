import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.deps import get_db
from api.schemas import DriveHistoryRead, PoolHistoryRead
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
