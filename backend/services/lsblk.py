import json
import subprocess
from dataclasses import dataclass, field
from typing import Any


@dataclass
class BlockDevice:
    name: str
    path: str
    by_id_path: str | None
    size_bytes: int
    type: str  # disk | part | rom
    zfs_pool: str | None = field(default=None)


def list_disks() -> list[BlockDevice]:
    """Return block devices of type 'disk' visible to the host."""
    result = subprocess.run(
        ["lsblk", "-J", "-b", "-o", "NAME,PATH,SIZE,TYPE,FSTYPE,LABEL"],
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
                    zfs_pool=_extract_zfs_pool(dev),
                )
            )
    return devices


def _extract_zfs_pool(dev: dict) -> str | None:
    """Check disk and its children for ZFS membership; return pool name if found."""
    # Some setups put zfs_member on the disk directly, others on a partition
    if dev.get("fstype") == "zfs_member":
        return dev.get("label") or "unknown"
    for child in dev.get("children", []):
        if child.get("fstype") == "zfs_member":
            return child.get("label") or "unknown"
    return None


def get_partitions(device_path: str) -> list[dict[str, Any]]:
    """Return partition children of device_path via lsblk."""
    result = subprocess.run(
        ["lsblk", "-J", "-b", "-o", "NAME,PATH,SIZE,TYPE,FSTYPE,LABEL,MOUNTPOINT,PARTUUID", device_path],
        capture_output=True, text=True, timeout=10,
    )
    if result.returncode != 0:
        return []
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return []

    partitions = []
    for dev in data.get("blockdevices", []):
        children = [c for c in dev.get("children", []) if c.get("type") == "part"]
        if children:
            for child in children:
                partitions.append({
                    "name": child.get("name", ""),
                    "path": child.get("path", ""),
                    "size_bytes": int(child.get("size") or 0),
                    "fstype": child.get("fstype"),
                    "label": child.get("label"),
                    "mountpoint": child.get("mountpoint"),
                    "partuuid": child.get("partuuid"),
                })
        elif dev.get("fstype"):
            # Whole-disk filesystem (no partition table — unRAID, raw-formatted, USB drives, etc.)
            partitions.append({
                "name": dev.get("name", ""),
                "path": dev.get("path", ""),
                "size_bytes": int(dev.get("size") or 0),
                "fstype": dev.get("fstype"),
                "label": dev.get("label"),
                "mountpoint": dev.get("mountpoint"),
                "partuuid": None,
            })
    return partitions


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
