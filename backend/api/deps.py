import datetime
import hashlib
import hmac
from collections import defaultdict, deque
from collections.abc import Generator

from fastapi import BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from db.base import SessionLocal
from models.api_key import ApiKey


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── API Key auth ──────────────────────────────────────────────────────────────

# In-memory sliding window rate limiter: key_prefix → deque of request timestamps
_rate_buckets: dict[str, deque] = defaultdict(deque)
_RATE_LIMIT = 120        # requests
_RATE_WINDOW = 60.0      # seconds
_MAX_BUCKETS = 10_000    # cap dict size to prevent unbounded memory growth


def _check_rate_limit(key_prefix: str) -> None:
    now = datetime.datetime.utcnow().timestamp()
    # Evict oldest entry when the dict reaches capacity (new unknown prefix)
    if len(_rate_buckets) >= _MAX_BUCKETS and key_prefix not in _rate_buckets:
        try:
            del _rate_buckets[next(iter(_rate_buckets))]
        except StopIteration:
            pass
    bucket = _rate_buckets[key_prefix]
    # Drop timestamps outside the window
    while bucket and bucket[0] < now - _RATE_WINDOW:
        bucket.popleft()
    if len(bucket) >= _RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Rate limit exceeded: 120 requests/minute")
    bucket.append(now)


def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def _touch_last_used(api_key_id: int) -> None:
    """Update last_used_at in a short-lived DB session (called as a background task)."""
    db = SessionLocal()
    try:
        key = db.get(ApiKey, api_key_id)
        if key:
            key.last_used_at = datetime.datetime.utcnow()
            db.commit()
    finally:
        db.close()


def require_api_key(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> ApiKey:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")

    raw_key = auth[len("Bearer "):]
    incoming_hash = _hash_key(raw_key)
    key_prefix = raw_key[:8] if len(raw_key) >= 8 else raw_key

    _check_rate_limit(key_prefix)

    # Constant-time comparison across all stored keys to prevent timing attacks
    api_key = None
    for candidate in db.query(ApiKey).all():
        if hmac.compare_digest(candidate.key_hash, incoming_hash):
            api_key = candidate
            break

    if api_key is None:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")

    background_tasks.add_task(_touch_last_used, api_key.id)
    return api_key
