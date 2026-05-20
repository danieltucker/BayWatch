from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.deps import get_db
from api.schemas import BayAssign, BayRead
from models.bay import Bay
from models.bay_array import BayArray
from models.drive import Drive

router = APIRouter()


@router.get("/array/{array_id}", response_model=list[BayRead])
def list_bays(array_id: int, db: Session = Depends(get_db)):
    arr = db.get(BayArray, array_id)
    if not arr:
        raise HTTPException(status_code=404, detail="Bay array not found")
    return arr.bays


@router.get("/{bay_id}", response_model=BayRead)
def get_bay(bay_id: int, db: Session = Depends(get_db)):
    bay = db.get(Bay, bay_id)
    if not bay:
        raise HTTPException(status_code=404, detail="Bay not found")
    return bay


@router.put("/{bay_id}/assign", response_model=BayRead)
def assign_drive(bay_id: int, body: BayAssign, db: Session = Depends(get_db)):
    bay = db.get(Bay, bay_id)
    if not bay:
        raise HTTPException(status_code=404, detail="Bay not found")

    if body.drive_serial is not None:
        drive = db.get(Drive, body.drive_serial)
        if not drive:
            raise HTTPException(status_code=404, detail="Drive not found")
        # Clear existing bay assignment for this drive
        existing = db.query(Bay).filter(Bay.drive_serial == body.drive_serial).first()
        if existing and existing.id != bay_id:
            existing.drive_serial = None

    bay.drive_serial = body.drive_serial
    db.commit()
    db.refresh(bay)
    return bay


@router.put("/{bay_id}/label")
def set_label(bay_id: int, label: str = "", db: Session = Depends(get_db)):
    if len(label) > 32:
        raise HTTPException(status_code=422, detail="Label must be 32 characters or fewer")
    bay = db.get(Bay, bay_id)
    if not bay:
        raise HTTPException(status_code=404, detail="Bay not found")
    bay.label = label.strip() or None
    db.commit()
    return {"ok": True}
