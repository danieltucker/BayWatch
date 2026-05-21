from __future__ import annotations

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from db.base import Base


class NotificationConfig(Base):
    __tablename__ = "notification_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    channel: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)  # telegram
    config_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: bot_token, chat_id
    status_frequency: Mapped[str] = mapped_column(
        String(16), default="disabled"
    )  # daily | weekly | monthly | disabled
    critical_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    warranty_warning_days: Mapped[int] = mapped_column(default=90)
    temp_alert_threshold_c: Mapped[int] = mapped_column(default=55)
    log_level: Mapped[str] = mapped_column(String(16), default="INFO")
