from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from api.deps import get_db
from api.schemas import FederatedTargetCreate, FederatedTargetRead, FederatedTargetUpdate
from models.federated_target import FederatedTarget
from services import federation as federation_svc

router = APIRouter()


@router.get("/targets", response_model=list[FederatedTargetRead])
def list_targets(db: Session = Depends(get_db)):
    return db.query(FederatedTarget).order_by(FederatedTarget.id).all()


@router.post("/targets", response_model=FederatedTargetRead, status_code=201)
def create_target(body: FederatedTargetCreate, db: Session = Depends(get_db)):
    target = FederatedTarget(**body.model_dump())
    db.add(target)
    db.commit()
    db.refresh(target)
    return target


@router.patch("/targets/{target_id}", response_model=FederatedTargetRead)
def update_target(target_id: int, body: FederatedTargetUpdate, db: Session = Depends(get_db)):
    target = db.get(FederatedTarget, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(target, field, value)
    db.commit()
    db.refresh(target)
    return target


@router.delete("/targets/{target_id}", status_code=204)
def delete_target(target_id: int, db: Session = Depends(get_db)):
    target = db.get(FederatedTarget, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    federation_svc.evict_snapshot(target_id)
    db.delete(target)
    db.commit()


@router.post("/targets/{target_id}/sync", status_code=202)
def sync_target(target_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    target = db.get(FederatedTarget, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    background_tasks.add_task(federation_svc.poll_target_by_id, target_id)
    return {"status": "sync started"}


@router.get("/data")
def get_federation_data():
    return federation_svc.get_all_remote_snapshots()
