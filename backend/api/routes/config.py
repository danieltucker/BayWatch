from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.deps import get_db

router = APIRouter()


class ConfigValue(BaseModel):
    value: str


@router.get("/{key}")
def get_config(key: str, db: Session = Depends(get_db)):
    row = db.execute(text("SELECT value FROM app_config WHERE key = :k"), {"k": key}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Config key not found")
    return {"key": key, "value": row[0]}


@router.put("/{key}")
def put_config(key: str, body: ConfigValue, db: Session = Depends(get_db)):
    db.execute(
        text("INSERT INTO app_config (key, value) VALUES (:k, :v) ON CONFLICT(key) DO UPDATE SET value = :v"),
        {"k": key, "v": body.value},
    )
    db.commit()
    return {"key": key, "value": body.value}
