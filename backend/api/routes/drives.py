import time
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from api.deps import get_db
from api.schemas import DriveCreate, DrivePatch, DriveRead
from models.drive import Drive
from services import csv_import as csv_import_svc
from services import log_buffer
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


@router.get("/logs")
def get_logs(after: int = Query(default=0)):
    return log_buffer.get_entries(after_id=after)


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


@router.post("/import")
async def import_drives(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not (file.filename or '').lower().endswith('.csv'):
        raise HTTPException(status_code=422, detail="File must be a .csv")
    content = await file.read()
    return csv_import_svc.run_import(content, db)


@router.patch("/{serial}", response_model=DriveRead)
def patch_drive(serial: str, body: DrivePatch, db: Session = Depends(get_db)):
    drive = db.get(Drive, serial)
    if not drive:
        raise HTTPException(status_code=404, detail="Drive not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(drive, field, value)
    db.commit()
    db.refresh(drive)
    return drive


@router.post("", response_model=DriveRead, status_code=201)
def create_drive(body: DriveCreate, db: Session = Depends(get_db)):
    if db.get(Drive, body.serial):
        raise HTTPException(status_code=409, detail="Drive with this serial already exists")
    drive = Drive(**body.model_dump(exclude_none=True))
    if not drive.smart_status:
        drive.smart_status = "UNKNOWN"
    db.add(drive)
    db.commit()
    db.refresh(drive)
    return drive
