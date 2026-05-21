import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ── Enclosure ────────────────────────────────────────────────────────────────

class BayArrayBase(BaseModel):
    name: str
    rows: int
    cols: int
    display_order: int = 0

class BayArrayCreate(BayArrayBase):
    pass

class BayArrayRead(BayArrayBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    enclosure_id: int


class EnclosureBase(BaseModel):
    name: str
    type: str = "server"
    description: Optional[str] = None

class EnclosureCreate(EnclosureBase):
    pass

class EnclosureRead(EnclosureBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    arrays: list[BayArrayRead] = []


# ── Bay ──────────────────────────────────────────────────────────────────────

class BayRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    array_id: int
    row: int
    col: int
    label: Optional[str] = None
    drive_serial: Optional[str] = None

class BayAssign(BaseModel):
    drive_serial: Optional[str] = None  # None to unassign


# ── Drive ────────────────────────────────────────────────────────────────────

class DriveCreate(BaseModel):
    serial: str
    make: Optional[str] = None
    model: Optional[str] = None
    capacity_bytes: Optional[int] = None
    rpm: Optional[int] = None
    form_factor: Optional[str] = None
    firmware_version: Optional[str] = None
    device_path: Optional[str] = None
    smart_status: str = "UNKNOWN"


class DrivePatch(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    form_factor: Optional[str] = None
    rpm: Optional[int] = None


class DriveRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    serial: str
    device_path: Optional[str] = None
    by_id_path: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    capacity_bytes: Optional[int] = None
    rpm: Optional[int] = None
    form_factor: Optional[str] = None
    firmware_version: Optional[str] = None
    smart_status: str
    temperature_c: Optional[int] = None
    power_on_hours: Optional[int] = None
    reallocated_sectors: Optional[int] = None
    pending_sectors: Optional[int] = None
    uncorrectable_errors: Optional[int] = None
    last_scanned: Optional[datetime.datetime] = None


# ── Drive Profile ─────────────────────────────────────────────────────────────

class DriveProfileBase(BaseModel):
    purchase_date: Optional[datetime.date] = None
    mfg_date: Optional[datetime.date] = None
    warranty_months: Optional[int] = None
    purchase_price: Optional[float] = None
    vendor: Optional[str] = None
    notes: Optional[str] = None

class DriveProfileCreate(DriveProfileBase):
    pass

class DriveProfileRead(DriveProfileBase):
    model_config = ConfigDict(from_attributes=True)
    serial: str
    warranty_expiry: Optional[datetime.date] = None
    warranty_days_remaining: Optional[int] = None


# ── Alerts & Notifications ────────────────────────────────────────────────────

class AlertRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    type: str
    drive_serial: Optional[str] = None
    channel: str
    message: str
    sent_at: datetime.datetime

class NotificationConfigRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    channel: str
    status_frequency: str
    critical_enabled: bool
    warranty_warning_days: int

class NotificationConfigUpdate(BaseModel):
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None
    status_frequency: Optional[str] = None
    critical_enabled: Optional[bool] = None
    warranty_warning_days: Optional[int] = None
