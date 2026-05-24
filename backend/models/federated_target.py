from __future__ import annotations

import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class FederatedTarget(Base):
    __tablename__ = "federated_targets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    # Full URL of the remote instance, e.g. http://192.168.1.50:8585
    url: Mapped[str] = mapped_column(String(512), nullable=False)
    # Stored as plaintext — same threat model as the Telegram bot token (LAN-only SQLite)
    api_key: Mapped[str] = mapped_column(String(256), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sync_interval_minutes: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    last_synced_at: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
