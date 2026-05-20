import datetime
import logging

from sqlalchemy.orm import Session

from models.drive import Drive
from services import lsblk as lsblk_svc
from services import nvme as nvme_svc
from services import ses as ses_svc
from services import smartctl as smartctl_svc

logger = logging.getLogger(__name__)


def run_scan(db: Session) -> list[Drive]:
    """
    Discover all block devices, gather SMART data, and upsert Drive rows.
    Returns the list of drives found in this scan.
    """
    ses_slots = ses_svc.get_enclosure_slots()
    devices = lsblk_svc.list_disks()

    # Supplement with any NVMe devices lsblk may miss
    if nvme_svc.is_nvme_available():
        nvme_paths = nvme_svc.list_nvme_devices()
        known_paths = {d.path for d in devices}
        for path in nvme_paths:
            if path not in known_paths:
                from services.lsblk import BlockDevice
                devices.append(BlockDevice(
                    name=path.split("/")[-1],
                    path=path,
                    by_id_path=None,
                    size_bytes=0,
                    type="disk",
                ))

    updated: list[Drive] = []
    for dev in devices:
        info = smartctl_svc.get_smart_info(dev.path)
        if info is None or not info.serial:
            logger.warning("No SMART data for %s — skipping", dev.path)
            continue

        drive = db.get(Drive, info.serial)
        if drive is None:
            drive = Drive(serial=info.serial)
            db.add(drive)

        drive.device_path = dev.path
        drive.by_id_path = dev.by_id_path
        drive.make = info.make
        drive.model = info.model
        drive.firmware_version = info.firmware
        drive.capacity_bytes = info.capacity_bytes or dev.size_bytes or None
        drive.rpm = info.rpm
        drive.form_factor = info.form_factor
        drive.smart_status = info.smart_status
        drive.temperature_c = info.temperature_c
        drive.power_on_hours = info.power_on_hours
        drive.reallocated_sectors = info.reallocated_sectors
        drive.pending_sectors = info.pending_sectors
        drive.uncorrectable_errors = info.uncorrectable_errors
        drive.last_scanned = datetime.datetime.utcnow()

        updated.append(drive)

    db.commit()
    logger.info("Scan complete: %d drives found", len(updated))
    return updated
