import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ── Enclosure ────────────────────────────────────────────────────────────────

class BayArrayBase(BaseModel):
    name: str
    rows: int
    cols: int
    display_order: int = 0
    group_type: str = "drive_bays"
    purpose: Optional[str] = None

class BayArrayCreate(BayArrayBase):
    pass

class BayArrayUpdate(BaseModel):
    name: Optional[str] = None
    rows: Optional[int] = None
    cols: Optional[int] = None
    group_type: Optional[str] = None
    purpose: Optional[str] = None
    display_order: Optional[int] = None

class BayArrayRead(BayArrayBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    enclosure_id: int


class EnclosureBase(BaseModel):
    name: str
    type: str = "server"
    description: Optional[str] = None
    display_order: Optional[int] = None

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
    status: str = "normal"
    drive_serial: Optional[str] = None

class BayAssign(BaseModel):
    drive_serial: Optional[str] = None  # None to unassign

class BayStatusUpdate(BaseModel):
    status: str  # normal|damaged|hot_spare|cold_spare


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
    zfs_pool: Optional[str] = None
    vdev_name: Optional[str] = None


# ── Pool ──────────────────────────────────────────────────────────────────────

class PoolRead(BaseModel):
    name: str
    size_bytes: int
    alloc_bytes: int
    free_bytes: int
    capacity_pct: int


class VdevDiskRead(BaseModel):
    path: str
    state: str
    read_errors: int = 0
    write_errors: int = 0
    cksum_errors: int = 0

class VdevRead(BaseModel):
    name: str
    type: str
    state: str
    disks: list[VdevDiskRead] = []

class PoolTopologyRead(BaseModel):
    name: str
    state: str
    scan_status: Optional[str] = None
    vdevs: list[VdevRead] = []


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
    temp_warn_threshold_c: int
    temp_alert_threshold_c: int
    log_level: str

class NotificationConfigUpdate(BaseModel):
    bot_token: Optional[str] = None
    chat_id: Optional[str] = None
    status_frequency: Optional[str] = None
    critical_enabled: Optional[bool] = None
    warranty_warning_days: Optional[int] = None
    temp_warn_threshold_c: Optional[int] = None
    temp_alert_threshold_c: Optional[int] = None
    log_level: Optional[str] = None


# ── Partitions ────────────────────────────────────────────────────────────────

class PartitionRead(BaseModel):
    name: str
    path: str
    size_bytes: int
    fstype: Optional[str] = None
    label: Optional[str] = None
    mountpoint: Optional[str] = None
    partuuid: Optional[str] = None


# ── Drive / Pool History ───────────────────────────────────────────────────────

class DriveHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    drive_serial: str
    recorded_at: datetime.datetime
    temperature_c: Optional[int] = None
    reallocated_sectors: Optional[int] = None
    power_on_hours: Optional[int] = None
    read_bytes: Optional[int] = None
    write_bytes: Optional[int] = None
    used_bytes: Optional[int] = None


class PoolHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    pool_name: str
    recorded_at: datetime.datetime
    capacity_pct: Optional[int] = None
    size_bytes: Optional[int] = None
    alloc_bytes: Optional[int] = None


# ── API Keys ──────────────────────────────────────────────────────────────────

class ApiKeyCreate(BaseModel):
    name: str

class ApiKeyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    key_prefix: str
    created_at: datetime.datetime
    last_used_at: Optional[datetime.datetime] = None

class ApiKeyCreated(ApiKeyRead):
    key: str  # plaintext — returned once on creation, never stored


# ── External API ──────────────────────────────────────────────────────────────

class ExternalBayRead(BayRead):
    enclosure_name: str
    array_name: str


# ── Federation ────────────────────────────────────────────────────────────────

class FederatedTargetCreate(BaseModel):
    name: str
    url: str
    api_key: str
    sync_interval_minutes: int = 15
    enabled: bool = True

class FederatedTargetUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    api_key: Optional[str] = None
    enabled: Optional[bool] = None
    sync_interval_minutes: Optional[int] = None

class FederatedTargetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    url: str
    enabled: bool
    sync_interval_minutes: int
    last_synced_at: Optional[datetime.datetime] = None
    last_error: Optional[str] = None
