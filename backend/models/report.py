from __future__ import annotations

import datetime

from sqlalchemy import DateTime, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    generated_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    period_days: Mapped[int] = mapped_column(Integer, nullable=False)
    period_start: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    period_end: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    data: Mapped[str] = mapped_column(Text, nullable=False)
