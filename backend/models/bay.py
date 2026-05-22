from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

if TYPE_CHECKING:
    from models.bay_array import BayArray
    from models.drive import Drive


class Bay(Base):
    __tablename__ = "bays"

    id: Mapped[int] = mapped_column(primary_key=True)
    array_id: Mapped[int] = mapped_column(ForeignKey("bay_arrays.id"), nullable=False)
    row: Mapped[int] = mapped_column(nullable=False)
    col: Mapped[int] = mapped_column(nullable=False)
    label: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="normal")  # normal|damaged|hot_spare|cold_spare
    drive_serial: Mapped[str | None] = mapped_column(
        ForeignKey("drives.serial", ondelete="SET NULL"), nullable=True
    )

    array: Mapped[BayArray] = relationship("BayArray", back_populates="bays")
    drive: Mapped[Drive | None] = relationship("Drive", back_populates="bay")
