from __future__ import annotations

import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class DriveHistory(Base):
    __tablename__ = "drive_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    drive_serial: Mapped[str] = mapped_column(
        String(64), ForeignKey("drives.serial", ondelete="CASCADE"), nullable=False, index=True
    )
    recorded_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    temperature_c: Mapped[int | None] = mapped_column(nullable=True)
    reallocated_sectors: Mapped[int | None] = mapped_column(nullable=True)
    power_on_hours: Mapped[int | None] = mapped_column(nullable=True)
    read_bytes: Mapped[int | None] = mapped_column(nullable=True)
    write_bytes: Mapped[int | None] = mapped_column(nullable=True)
