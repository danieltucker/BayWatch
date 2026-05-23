"""
Read /proc/diskstats and return cumulative bytes read/written per device name.

Each line in /proc/diskstats has at least 14 fields:
  major minor name reads_completed reads_merged sectors_read time_read_ms
  writes_completed writes_merged sectors_written time_write_ms ...

Sector size in /proc/diskstats is always 512 bytes (kernel invariant).
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

_SECTOR_SIZE = 512
_PROC_PATH = "/proc/diskstats"


def read_io_bytes() -> dict[str, tuple[int, int]]:
    """Return {device_name: (read_bytes, write_bytes)} from /proc/diskstats.

    Returns an empty dict if /proc/diskstats is unavailable (non-Linux hosts).
    """
    result: dict[str, tuple[int, int]] = {}
    if not os.path.exists(_PROC_PATH):
        return result
    try:
        with open(_PROC_PATH) as f:
            for line in f:
                parts = line.split()
                if len(parts) < 14:
                    continue
                name = parts[2]
                sectors_read    = int(parts[5])
                sectors_written = int(parts[9])
                result[name] = (sectors_read * _SECTOR_SIZE, sectors_written * _SECTOR_SIZE)
    except Exception as exc:
        logger.warning("diskstats: could not read %s: %s", _PROC_PATH, exc)
    return result
