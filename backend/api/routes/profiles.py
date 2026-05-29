from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.deps import get_db
from api.schemas import DriveProfileCreate, DriveProfileRead
from models.drive import Drive
from models.drive_profile import DriveProfile

router = APIRouter()


@router.get("", response_model=list[DriveProfileRead])
def get_all_profiles(db: Session = Depends(get_db)):
    return db.query(DriveProfile).all()


@router.get("/{serial}", response_model=DriveProfileRead)
def get_profile(serial: str, db: Session = Depends(get_db)):
    profile = db.get(DriveProfile, serial)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.put("/{serial}", response_model=DriveProfileRead)
def upsert_profile(
    serial: str, body: DriveProfileCreate, db: Session = Depends(get_db)
):
    drive = db.get(Drive, serial)
    if not drive:
        raise HTTPException(status_code=404, detail="Drive not found")

    profile = db.get(DriveProfile, serial)
    if profile is None:
        profile = DriveProfile(serial=serial)
        db.add(profile)

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(profile, k, v)

    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/{serial}", status_code=204)
def delete_profile(serial: str, db: Session = Depends(get_db)):
    profile = db.get(DriveProfile, serial)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    db.delete(profile)
    db.commit()
