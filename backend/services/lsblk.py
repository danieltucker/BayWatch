import json
import subprocess
from dataclasses import dataclass


@dataclass
class BlockDevice:
    name: str
    path: str
    by_id_path: str | None
    size_bytes: int
    type: str  # disk | part | rom


def list_disks() -> list[BlockDevice]:
    """Return block devices of type 'disk' visible to the host."""
    result = subprocess.run(
        ["lsblk", "-J", "-b", "-o", "NAME,PATH,SIZE,TYPE"],
        capture_output=True,
        text=True,
        timeout=15,
    )
    if result.returncode != 0:
        return []

    data = json.loads(result.stdout)
    devices = []
    for dev in data.get("blockdevices", []):
        if dev.get("type") == "disk":
            devices.append(
                BlockDevice(
                    name=dev["name"],
                    path=dev["path"],
                    by_id_path=_resolve_by_id(dev["name"]),
                    size_bytes=int(dev.get("size") or 0),
                    type=dev["type"],
                )
            )
    return devices


def _resolve_by_id(name: str) -> str | None:
    """Find the most descriptive /dev/disk/by-id symlink for a device."""
    import os
    from pathlib import Path

    by_id = Path("/dev/disk/by-id")
    if not by_id.exists():
        return None

    candidates = []
    for link in by_id.iterdir():
        try:
            target = os.readlink(link)
            if Path(target).name == name or target.endswith(f"/{name}"):
                # Prefer ata- or nvme- over wwn- for human readability
                candidates.append(str(link))
        except OSError:
            continue

    if not candidates:
        return None
    candidates.sort(key=lambda p: (0 if "/ata-" in p or "/nvme-" in p else 1))
    return candidates[0]
