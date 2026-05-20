from __future__ import annotations

import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

if TYPE_CHECKING:
    from models.drive import Drive


class DriveProfile(Base):
    __tablename__ = "drive_profiles"

    serial: Mapped[str] = mapped_column(
        String(64), ForeignKey("drives.serial", ondelete="CASCADE"), primary_key=True
    )
    purchase_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    mfg_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    warranty_months: Mapped[int | None] = mapped_column(nullable=True)
    purchase_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    vendor: Mapped[str | None] = mapped_column(String(128), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    drive: Mapped[Drive] = relationship("Drive", back_populates="profile")

    @property
    def warranty_expiry(self) -> datetime.date | None:
        if self.purchase_date and self.warranty_months:
            month = self.purchase_date.month + self.warranty_months
            year = self.purchase_date.year + (month - 1) // 12
            month = (month - 1) % 12 + 1
            return self.purchase_date.replace(year=year, month=month)
        return None

    @property
    def warranty_days_remaining(self) -> int | None:
        expiry = self.warranty_expiry
        if expiry:
            return (expiry - datetime.date.today()).days
        return None
