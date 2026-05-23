import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from db.base import Base, engine, SessionLocal
import models  # noqa: F401 — registers all ORM models with Base.metadata
from api.routes import drives, bays, enclosures, profiles, alerts, pools, history
from services import log_buffer, scheduler


_MIGRATIONS = [
    "ALTER TABLE bay_arrays ADD COLUMN group_type VARCHAR(32) DEFAULT 'drive_bays'",
    "ALTER TABLE bay_arrays ADD COLUMN purpose TEXT",
    "ALTER TABLE notification_configs ADD COLUMN temp_alert_threshold_c INTEGER DEFAULT 55",
    "ALTER TABLE notification_configs ADD COLUMN log_level VARCHAR(16) DEFAULT 'INFO'",
    "ALTER TABLE bays ADD COLUMN status VARCHAR(16) DEFAULT 'normal'",
    "ALTER TABLE drives ADD COLUMN zfs_pool VARCHAR(64)",
    "ALTER TABLE drives ADD COLUMN vdev_name VARCHAR(32)",
    "ALTER TABLE notification_configs ADD COLUMN temp_warn_threshold_c INTEGER DEFAULT 55",
    "ALTER TABLE enclosures ADD COLUMN display_order INTEGER DEFAULT 0",
    "ALTER TABLE drive_history ADD COLUMN read_bytes INTEGER",
    "ALTER TABLE drive_history ADD COLUMN write_bytes INTEGER",
    "ALTER TABLE drive_history ADD COLUMN used_bytes INTEGER",
]


def _run_migrations() -> None:
    with engine.connect() as conn:
        for sql in _MIGRATIONS:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # column already exists


@asynccontextmanager
async def lifespan(app: FastAPI):
    level = getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO)
    log_buffer.install(level=level)
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    # Apply log_level from DB if already configured
    db = SessionLocal()
    try:
        from models.notification_config import NotificationConfig
        cfg = db.query(NotificationConfig).filter_by(channel="telegram").first()
        if cfg and cfg.log_level:
            db_level = getattr(logging, cfg.log_level.upper(), None)
            if db_level is not None:
                log_buffer.set_level(db_level)
    except Exception:
        pass
    finally:
        db.close()
    scheduler.start()
    yield
    scheduler.stop()


app = FastAPI(title="DriveMap API", version="0.19.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(enclosures.router, prefix="/api/enclosures", tags=["enclosures"])
app.include_router(bays.router, prefix="/api/bays", tags=["bays"])
app.include_router(drives.router, prefix="/api/drives", tags=["drives"])
app.include_router(profiles.router, prefix="/api/profiles", tags=["profiles"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(pools.router, prefix="/api/pools", tags=["pools"])
app.include_router(history.router, prefix="/api/history", tags=["history"])


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.19.0"}
