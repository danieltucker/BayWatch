from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

if TYPE_CHECKING:
    from models.bay_array import BayArray


class Enclosure(Base):
    __tablename__ = "enclosures"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    type: Mapped[str] = mapped_column(String(32), default="server")  # server | jbod | other
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    arrays: Mapped[list[BayArray]] = relationship(
        "BayArray", back_populates="enclosure", cascade="all, delete-orphan"
    )
