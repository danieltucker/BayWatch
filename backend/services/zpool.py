import logging
import os
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class PoolStats:
    name: str
    size_bytes: int
    alloc_bytes: int
    free_bytes: int
    capacity_pct: int


@dataclass
class VdevDisk:
    path: str
    state: str


@dataclass
class Vdev:
    name: str
    type: str  # mirror|raidz1|raidz2|raidz3|disk|spare|cache|log
    state: str
    disks: list[VdevDisk] = field(default_factory=list)


@dataclass
class PoolTopology:
    name: str
    state: str
    vdevs: list[Vdev] = field(default_factory=list)


def get_pool_stats() -> list[PoolStats]:
    """Return ZFS pool usage stats via zpool list. Returns [] if ZFS is unavailable."""
    try:
        result = subprocess.run(
            ["zpool", "list", "-Hp", "-o", "name,size,alloc,free,capacity"],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except FileNotFoundError:
        return []

    if result.returncode != 0:
        if result.returncode != 1 or "no pools available" not in result.stderr.lower():
            logger.debug("zpool list failed: %s", result.stderr.strip())
        return []

    pools = []
    for line in result.stdout.strip().splitlines():
        parts = line.split("\t")
        if len(parts) < 5:
            continue
        try:
            name = parts[0]
            size_bytes = int(parts[1])
            alloc_bytes = int(parts[2])
            free_bytes = int(parts[3])
            capacity_pct = int(parts[4].rstrip("%"))
            pools.append(PoolStats(
                name=name,
                size_bytes=size_bytes,
                alloc_bytes=alloc_bytes,
                free_bytes=free_bytes,
                capacity_pct=capacity_pct,
            ))
        except (ValueError, IndexError):
            continue

    return pools


# vdev type keywords — order matters (check longer prefixes first)
_VDEV_TYPES = ("mirror", "raidz3", "raidz2", "raidz1", "raidz", "spare", "cache", "log", "dedup", "special")


def _vdev_type(name: str) -> str:
    """Infer vdev type from its name."""
    for t in _VDEV_TYPES:
        if name.startswith(t):
            return t
    # Absolute path → single-disk vdev
    if name.startswith("/"):
        return "disk"
    return "disk"


def get_pool_topology() -> list[PoolTopology]:
    """Parse `zpool status -P` into a structured vdev tree. Returns [] if ZFS unavailable."""
    try:
        result = subprocess.run(
            ["zpool", "status", "-P"],
            capture_output=True,
            text=True,
            timeout=15,
        )
    except FileNotFoundError:
        return []

    if result.returncode != 0:
        logger.debug("zpool status failed: %s", result.stderr.strip())
        return []

    return _parse_zpool_status(result.stdout)


def _parse_zpool_status(output: str) -> list[PoolTopology]:
    """
    Parse zpool status -P output.

    The config block uses indentation to express tree depth:
      pool name (depth 2 tabs)
        vdev group e.g. mirror-0 (depth 3 tabs)
          disk path (depth 4 tabs)

    We track which section we're in by looking for "config:" then counting
    leading whitespace to determine hierarchy level.
    """
    pools: list[PoolTopology] = []
    current_pool: PoolTopology | None = None
    current_vdev: Vdev | None = None
    in_config = False
    pool_root_indent: int | None = None

    for raw_line in output.splitlines():
        stripped = raw_line.strip()
        if not stripped:
            continue

        # Pool header
        if raw_line.startswith("  pool:"):
            pool_name = raw_line.split(":", 1)[1].strip()
            current_pool = PoolTopology(name=pool_name, state="UNKNOWN")
            pools.append(current_pool)
            in_config = False
            pool_root_indent = None
            current_vdev = None
            continue

        if raw_line.lstrip().startswith("state:") and current_pool and not in_config:
            current_pool.state = raw_line.split(":", 1)[1].strip()
            continue

        if stripped == "config:":
            in_config = True
            pool_root_indent = None
            continue

        if not in_config or current_pool is None:
            # Other sections (status, action, errors, scan) — reset on next pool keyword
            if raw_line.startswith("  pool:") or stripped in ("errors:", "status:", "action:", "scan:", "remove:"):
                in_config = False
            continue

        # Skip the column header line
        if stripped.startswith("NAME") and "STATE" in stripped:
            continue

        # Measure indent level (number of leading spaces)
        indent = len(raw_line) - len(raw_line.lstrip())
        parts = stripped.split()
        if not parts:
            continue
        name, state = parts[0], (parts[1] if len(parts) > 1 else "UNKNOWN")

        # First indented line after "config:" is the pool root — skip it
        if pool_root_indent is None:
            pool_root_indent = indent
            continue

        depth = indent - pool_root_indent  # relative depth (0 = pool root, already skipped)

        if depth <= 0:
            # Back to pool root level — another pool section follows, reset
            in_config = False
            continue

        if depth == 2:
            # vdev group (mirror-0, raidz1-0, spare, cache, log, or lone disk)
            vdev_type = _vdev_type(name)
            current_vdev = Vdev(name=name, type=vdev_type, state=state)
            current_pool.vdevs.append(current_vdev)
            # Bare disk at vdev level — add it as its own disk entry
            if vdev_type == "disk":
                current_vdev.disks.append(VdevDisk(path=name, state=state))

        elif depth >= 4 and current_vdev is not None:
            # Leaf disk under a vdev group
            current_vdev.disks.append(VdevDisk(path=name, state=state))

    return pools


def _partuuid_to_parent_dev(partuuid_path: str) -> str | None:
    """Resolve /dev/disk/by-partuuid/UUID → parent disk /dev/sdX.

    Uses /sys/block to find which disk owns the resolved partition device,
    avoiding any regex guessing at device naming conventions.
    """
    try:
        target = os.readlink(partuuid_path)          # e.g. "../../sda1"
        part_name = Path(target).name                 # "sda1"
        for disk_dir in Path("/sys/block").iterdir():
            if (disk_dir / part_name).is_dir():
                return f"/dev/{disk_dir.name}"
    except Exception:
        pass
    return None


def build_disk_to_vdev_map(topology: list[PoolTopology]) -> dict[str, str]:
    """Return {device_path: vdev_name} for all disks in the topology.

    Indexes multiple path forms per disk so lookups succeed regardless of
    how zpool status -P reports paths on a given system:
      - by-id with -partN suffix  → also index with suffix stripped
      - by-partuuid               → also index the parent /dev/sdX
    """
    mapping: dict[str, str] = {}
    for pool in topology:
        for vdev in pool.vdevs:
            for disk in vdev.disks:
                mapping[disk.path] = vdev.name

                # /dev/disk/by-id/ata-...-part1 → strip -partN
                base = re.sub(r"-part\d+$", "", disk.path)
                if base != disk.path:
                    mapping[base] = vdev.name

                # /dev/disk/by-partuuid/UUID → resolve to /dev/sdX
                if disk.path.startswith("/dev/disk/by-partuuid/"):
                    parent = _partuuid_to_parent_dev(disk.path)
                    if parent:
                        mapping[parent] = vdev.name

    return mapping
