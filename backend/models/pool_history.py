from __future__ import annotations

import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class PoolHistory(Base):
    __tablename__ = "pool_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    pool_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    recorded_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    capacity_pct: Mapped[int | None] = mapped_column(nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(nullable=True)
    alloc_bytes: Mapped[int | None] = mapped_column(nullable=True)
