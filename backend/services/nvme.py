import json
import subprocess


def list_nvme_devices() -> list[str]:
    """Return device paths for all NVMe drives."""
    result = subprocess.run(
        ["nvme", "list", "-o", "json"],
        capture_output=True,
        text=True,
        timeout=15,
    )
    if result.returncode != 0 or not result.stdout:
        return []

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return []

    return [dev["DevicePath"] for dev in data.get("Devices", [])]


def is_nvme_available() -> bool:
    try:
        subprocess.run(["nvme", "version"], capture_output=True, timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False
