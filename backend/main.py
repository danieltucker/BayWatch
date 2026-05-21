import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.base import Base, engine
import models  # noqa: F401 — registers all ORM models with Base.metadata
from api.routes import drives, bays, enclosures, profiles, alerts
from services import log_buffer, scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    level = getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO)
    log_buffer.install(level=level)
    Base.metadata.create_all(bind=engine)
    scheduler.start()
    yield
    scheduler.stop()


app = FastAPI(title="DriveMap API", version="0.1.0", lifespan=lifespan)

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


@app.get("/api/health")
def health():
    return {"status": "ok"}
