import hashlib
import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.deps import get_db
from api.schemas import ApiKeyCreate, ApiKeyCreated, ApiKeyRead
from models.api_key import ApiKey

router = APIRouter()


def _generate_key() -> tuple[str, str, str]:
    """Return (plaintext_key, key_prefix, key_hash)."""
    token = secrets.token_urlsafe(32)
    plaintext = f"dm_{token}"
    prefix = plaintext[:8]
    key_hash = hashlib.sha256(plaintext.encode()).hexdigest()
    return plaintext, prefix, key_hash


@router.get("", response_model=list[ApiKeyRead])
def list_api_keys(db: Session = Depends(get_db)):
    return db.query(ApiKey).order_by(ApiKey.created_at.desc()).all()


@router.post("", response_model=ApiKeyCreated, status_code=201)
def create_api_key(body: ApiKeyCreate, db: Session = Depends(get_db)):
    plaintext, prefix, key_hash = _generate_key()
    key = ApiKey(name=body.name, key_prefix=prefix, key_hash=key_hash)
    db.add(key)
    db.commit()
    db.refresh(key)
    # Attach plaintext for the one-time response — not persisted
    result = ApiKeyCreated.model_validate(key)
    result.key = plaintext
    return result


@router.delete("/{key_id}", status_code=204)
def delete_api_key(key_id: int, db: Session = Depends(get_db)):
    key = db.get(ApiKey, key_id)
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    db.delete(key)
    db.commit()
