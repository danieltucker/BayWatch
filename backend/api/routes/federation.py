import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
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


@router.get("/targets/{target_id}/drives/{serial}/history")
def proxy_drive_history(
    target_id: int,
    serial: str,
    days: int = Query(default=90, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """Proxy a drive's history request to the remote instance. Returns last-known data on error."""
    target = db.get(FederatedTarget, target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    headers = {"Authorization": f"Bearer {target.api_key}"}
    base = target.url.rstrip("/")
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(f"{base}/v1/drives/{serial}/history", headers=headers, params={"days": days})
            resp.raise_for_status()
        data = resp.json()
        return {"history": data, "error": None}
    except httpx.HTTPStatusError as exc:
        return {"history": [], "error": f"Remote returned HTTP {exc.response.status_code}"}
    except httpx.RequestError as exc:
        return {"history": [], "error": f"Connection error: {exc}"}
