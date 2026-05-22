from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from api.deps import get_db
from api.schemas import (
    BayArrayCreate, BayArrayRead, BayArrayUpdate,
    EnclosureCreate, EnclosureRead,
)
from models.bay import Bay
from models.bay_array import BayArray
from models.enclosure import Enclosure

router = APIRouter()


@router.get("", response_model=list[EnclosureRead])
def list_enclosures(db: Session = Depends(get_db)):
    return db.query(Enclosure).all()


@router.post("", response_model=EnclosureRead, status_code=201)
def create_enclosure(body: EnclosureCreate, db: Session = Depends(get_db)):
    enc = Enclosure(**body.model_dump())
    db.add(enc)
    db.commit()
    db.refresh(enc)
    return enc


@router.get("/{enclosure_id}", response_model=EnclosureRead)
def get_enclosure(enclosure_id: int, db: Session = Depends(get_db)):
    enc = db.get(Enclosure, enclosure_id)
    if not enc:
        raise HTTPException(status_code=404, detail="Enclosure not found")
    return enc


@router.put("/{enclosure_id}", response_model=EnclosureRead)
def update_enclosure(
    enclosure_id: int, body: EnclosureCreate, db: Session = Depends(get_db)
):
    enc = db.get(Enclosure, enclosure_id)
    if not enc:
        raise HTTPException(status_code=404, detail="Enclosure not found")
    for k, v in body.model_dump().items():
        setattr(enc, k, v)
    db.commit()
    db.refresh(enc)
    return enc


@router.delete("/{enclosure_id}", status_code=204)
def delete_enclosure(enclosure_id: int, db: Session = Depends(get_db)):
    enc = db.get(Enclosure, enclosure_id)
    if not enc:
        raise HTTPException(status_code=404, detail="Enclosure not found")
    db.delete(enc)
    db.commit()


# ── Bay Arrays ────────────────────────────────────────────────────────────────

@router.post("/{enclosure_id}/arrays", response_model=BayArrayRead, status_code=201)
def create_bay_array(
    enclosure_id: int, body: BayArrayCreate, db: Session = Depends(get_db)
):
    enc = db.get(Enclosure, enclosure_id)
    if not enc:
        raise HTTPException(status_code=404, detail="Enclosure not found")

    arr = BayArray(enclosure_id=enclosure_id, **body.model_dump())
    db.add(arr)
    db.flush()

    # Auto-generate Bay rows for the grid
    for row in range(arr.rows):
        for col in range(arr.cols):
            db.add(Bay(array_id=arr.id, row=row, col=col))

    db.commit()
    db.refresh(arr)
    return arr


@router.put("/{enclosure_id}/arrays/{array_id}", response_model=BayArrayRead)
def update_bay_array(
    enclosure_id: int, array_id: int, body: BayArrayUpdate, db: Session = Depends(get_db)
):
    arr = db.get(BayArray, array_id)
    if not arr or arr.enclosure_id != enclosure_id:
        raise HTTPException(status_code=404, detail="Bay array not found")

    if body.name is not None:
        arr.name = body.name
    if body.group_type is not None:
        arr.group_type = body.group_type
    if body.purpose is not None:
        arr.purpose = body.purpose

    new_rows = body.rows if body.rows is not None else arr.rows
    new_cols = body.cols if body.cols is not None else arr.cols

    if new_rows != arr.rows or new_cols != arr.cols:
        # Remove bays outside new bounds
        out_of_bounds = db.query(Bay).filter(
            Bay.array_id == arr.id,
            or_(Bay.row >= new_rows, Bay.col >= new_cols)
        ).all()
        for bay in out_of_bounds:
            db.delete(bay)
        db.flush()

        # Add bays for new positions
        existing = {
            (b.row, b.col)
            for b in db.query(Bay).filter(Bay.array_id == arr.id).all()
        }
        for r in range(new_rows):
            for c in range(new_cols):
                if (r, c) not in existing:
                    db.add(Bay(array_id=arr.id, row=r, col=c))

        arr.rows = new_rows
        arr.cols = new_cols

    db.commit()
    db.refresh(arr)
    return arr


@router.delete("/{enclosure_id}/arrays/{array_id}", status_code=204)
def delete_bay_array(
    enclosure_id: int, array_id: int, db: Session = Depends(get_db)
):
    arr = db.get(BayArray, array_id)
    if not arr or arr.enclosure_id != enclosure_id:
        raise HTTPException(status_code=404, detail="Bay array not found")
    db.delete(arr)
    db.commit()
