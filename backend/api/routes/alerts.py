import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.deps import get_db
from api.schemas import AlertRead, NotificationConfigRead, NotificationConfigUpdate
from models.alert import Alert
from models.notification_config import NotificationConfig
from services import log_buffer

router = APIRouter()


@router.get("", response_model=list[AlertRead])
def list_alerts(limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Alert).order_by(Alert.sent_at.desc()).limit(limit).all()


@router.get("/config", response_model=NotificationConfigRead)
def get_config(db: Session = Depends(get_db)):
    config = db.query(NotificationConfig).filter_by(channel="telegram").first()
    if not config:
        config = NotificationConfig(channel="telegram")
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.put("/config", response_model=NotificationConfigRead)
def update_config(body: NotificationConfigUpdate, db: Session = Depends(get_db)):
    config = db.query(NotificationConfig).filter_by(channel="telegram").first()
    if not config:
        config = NotificationConfig(channel="telegram")
        db.add(config)

    # bot_token and chat_id live inside config_json
    existing_json: dict = {}
    if config.config_json:
        try:
            existing_json = json.loads(config.config_json)
        except json.JSONDecodeError:
            pass

    if body.bot_token is not None:
        existing_json["bot_token"] = body.bot_token
    if body.chat_id is not None:
        existing_json["chat_id"] = body.chat_id
    config.config_json = json.dumps(existing_json) if existing_json else None

    if body.status_frequency is not None:
        allowed = {"daily", "weekly", "monthly", "disabled"}
        if body.status_frequency not in allowed:
            raise HTTPException(status_code=422, detail=f"status_frequency must be one of {allowed}")
        config.status_frequency = body.status_frequency
    if body.critical_enabled is not None:
        config.critical_enabled = body.critical_enabled
    if body.warranty_warning_days is not None:
        config.warranty_warning_days = body.warranty_warning_days
    if body.temp_alert_threshold_c is not None:
        config.temp_alert_threshold_c = body.temp_alert_threshold_c
    if body.log_level is not None:
        allowed_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        if body.log_level.upper() not in allowed_levels:
            raise HTTPException(status_code=422, detail=f"log_level must be one of {allowed_levels}")
        config.log_level = body.log_level.upper()
        log_buffer.set_level(getattr(logging, config.log_level, logging.INFO))

    db.commit()
    db.refresh(config)
    return config
