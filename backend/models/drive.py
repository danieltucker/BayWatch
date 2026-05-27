from __future__ import annotations

import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

if TYPE_CHECKING:
    from models.bay import Bay
    from models.drive_profile import DriveProfile


class Drive(Base):
    __tablename__ = "drives"

    serial: Mapped[str] = mapped_column(String(64), primary_key=True)
    device_path: Mapped[str | None] = mapped_column(String(64), nullable=True)
    by_id_path: Mapped[str | None] = mapped_column(String(256), nullable=True)
    make: Mapped[str | None] = mapped_column(String(128), nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    capacity_bytes: Mapped[int | None] = mapped_column(nullable=True)
    rpm: Mapped[int | None] = mapped_column(nullable=True)  # 0 = SSD
    form_factor: Mapped[str | None] = mapped_column(String(16), nullable=True)
    firmware_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    smart_status: Mapped[str] = mapped_column(String(16), default="UNKNOWN")  # PASSED|FAILED|UNKNOWN
    temperature_c: Mapped[int | None] = mapped_column(nullable=True)
    power_on_hours: Mapped[int | None] = mapped_column(nullable=True)
    reallocated_sectors: Mapped[int | None] = mapped_column(nullable=True)
    pending_sectors: Mapped[int | None] = mapped_column(nullable=True)
    uncorrectable_errors: Mapped[int | None] = mapped_column(nullable=True)
    last_scanned: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
    zfs_pool: Mapped[str | None] = mapped_column(String(64), nullable=True)
    vdev_name: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_connected: Mapped[bool] = mapped_column(default=True, server_default="1")

    bay: Mapped[Bay | None] = relationship("Bay", back_populates="drive", uselist=False)
    profile: Mapped[DriveProfile | None] = relationship(
        "DriveProfile", back_populates="drive", uselist=False, cascade="all, delete-orphan"
    )
