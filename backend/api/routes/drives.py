import time
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from api.deps import get_db
from api.schemas import DriveRead
from models.drive import Drive
from services import scanner

router = APIRouter()

_last_scan_time: float = 0
_SCAN_COOLDOWN_SECONDS = 30


def _check_scan_cooldown() -> None:
    global _last_scan_time
    elapsed = time.monotonic() - _last_scan_time
    if elapsed < _SCAN_COOLDOWN_SECONDS:
        remaining = int(_SCAN_COOLDOWN_SECONDS - elapsed)
        raise HTTPException(status_code=429, detail=f"Scan cooldown: wait {remaining}s")
    _last_scan_time = time.monotonic()


@router.get("", response_model=list[DriveRead])
def list_drives(db: Session = Depends(get_db)):
    return db.query(Drive).all()


@router.get("/{serial}", response_model=DriveRead)
def get_drive(serial: str, db: Session = Depends(get_db)):
    drive = db.get(Drive, serial)
    if not drive:
        raise HTTPException(status_code=404, detail="Drive not found")
    return drive


@router.post("/scan", status_code=202)
def trigger_scan(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    _check_scan_cooldown()
    background_tasks.add_task(scanner.run_scan, db)
    return {"status": "scan started"}


@router.post("/scan/sync", response_model=list[DriveRead])
def trigger_scan_sync(db: Session = Depends(get_db)):
    _check_scan_cooldown()
    return scanner.run_scan(db)
