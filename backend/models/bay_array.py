from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

if TYPE_CHECKING:
    from models.enclosure import Enclosure
    from models.bay import Bay


class BayArray(Base):
    __tablename__ = "bay_arrays"

    id: Mapped[int] = mapped_column(primary_key=True)
    enclosure_id: Mapped[int] = mapped_column(ForeignKey("enclosures.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    rows: Mapped[int] = mapped_column(nullable=False)
    cols: Mapped[int] = mapped_column(nullable=False)
    display_order: Mapped[int] = mapped_column(default=0)
    group_type: Mapped[str] = mapped_column(String(32), default="drive_bays")
    purpose: Mapped[str | None] = mapped_column(Text, nullable=True)

    enclosure: Mapped[Enclosure] = relationship("Enclosure", back_populates="arrays")
    bays: Mapped[list[Bay]] = relationship(
        "Bay", back_populates="array", cascade="all, delete-orphan"
    )
