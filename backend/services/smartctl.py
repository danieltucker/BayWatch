import json
import logging
import subprocess
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class SmartInfo:
    serial: str
    make: str | None
    model: str | None
    firmware: str | None
    capacity_bytes: int | None
    rpm: int | None          # 0 = SSD
    form_factor: str | None
    smart_status: str        # PASSED | FAILED | UNKNOWN
    temperature_c: int | None
    power_on_hours: int | None
    reallocated_sectors: int | None
    pending_sectors: int | None
    uncorrectable_errors: int | None
    is_nvme: bool = False
    raw: dict = field(default_factory=dict)


def get_smart_info(device_path: str) -> SmartInfo | None:
    """Run smartctl -a on a device and parse the result."""
    result = subprocess.run(
        ["smartctl", "-a", "-j", device_path],
        capture_output=True,
        text=True,
        timeout=30,
    )
    # smartctl exits non-zero for warnings but still returns JSON data
    if not result.stdout:
        logger.warning("smartctl returned no output for %s (exit %d): %s",
                       device_path, result.returncode, result.stderr.strip())
        return None

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None

    return _parse(device_path, data)


def _parse(device_path: str, d: dict) -> SmartInfo:
    info = d.get("device", {})
    is_nvme = info.get("protocol", "").upper() == "NVME"

    serial = d.get("serial_number", "")
    if not serial:
        return None

    # Capacity
    cap = d.get("user_capacity", {})
    capacity_bytes = cap.get("bytes") if isinstance(cap, dict) else None

    # RPM / SSD detection
    rotation = d.get("rotation_rate")
    if rotation == 0 or rotation is None:
        rpm = 0
    else:
        rpm = int(rotation)

    # SMART overall status
    status_obj = d.get("smart_status", {})
    if status_obj.get("passed") is True:
        smart_status = "PASSED"
    elif status_obj.get("passed") is False:
        smart_status = "FAILED"
    else:
        smart_status = "UNKNOWN"

    # Temperature
    temp = d.get("temperature", {})
    temperature_c = temp.get("current") if isinstance(temp, dict) else None

    # Power-on hours
    power_on_hours = None
    if is_nvme:
        power_on_hours = d.get("power_on_time", {}).get("hours")
    else:
        power_on_hours = _ata_attr(d, 9)

    # ATA health attributes
    reallocated = _ata_attr(d, 5)
    pending = _ata_attr(d, 197)
    uncorrectable = _ata_attr(d, 198)

    # NVMe overrides
    if is_nvme:
        nvme_health = d.get("nvme_smart_health_information_log", {})
        temperature_c = temperature_c or nvme_health.get("temperature")
        power_on_hours = power_on_hours or nvme_health.get("power_on_hours")

    return SmartInfo(
        serial=serial,
        make=d.get("model_family") or d.get("vendor"),
        model=d.get("model_name"),
        firmware=d.get("firmware_version"),
        capacity_bytes=capacity_bytes,
        rpm=rpm,
        form_factor=d.get("form_factor", {}).get("name") if isinstance(d.get("form_factor"), dict) else None,
        smart_status=smart_status,
        temperature_c=temperature_c,
        power_on_hours=power_on_hours,
        reallocated_sectors=reallocated,
        pending_sectors=pending,
        uncorrectable_errors=uncorrectable,
        is_nvme=is_nvme,
        raw=d,
    )


def _ata_attr(data: dict, attr_id: int) -> int | None:
    """Extract raw value for a specific ATA SMART attribute by ID."""
    for attr in data.get("ata_smart_attributes", {}).get("table", []):
        if attr.get("id") == attr_id:
            return attr.get("raw", {}).get("value")
    return None
