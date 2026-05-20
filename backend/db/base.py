import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////app/data/drivemap.db")

# Ensure data directory exists (matters when running locally outside Docker)
if DATABASE_URL.startswith("sqlite:////"):
    db_path = Path(DATABASE_URL.replace("sqlite:////", "/"))
    db_path.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass
