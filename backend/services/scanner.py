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
    logger.info("Scan started")
    ses_slots = ses_svc.get_enclosure_slots()
    devices = lsblk_svc.list_disks()
    logger.info("Discovered %d block device(s) via lsblk", len(devices))

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
        logger.info("Reading SMART data for %s", dev.path)
        info = smartctl_svc.get_smart_info(dev.path)
        if info is None or not info.serial:
            logger.warning("No SMART data for %s — skipping", dev.path)
            continue

        drive = db.get(Drive, info.serial)
        is_new = drive is None
        if is_new:
            drive = Drive(serial=info.serial)
            db.add(drive)
            logger.info("New drive: %s (%s %s)", info.serial, info.make, info.model)
        else:
            logger.info("Updated drive: %s — %s°C, %s hrs, SMART=%s",
                        info.serial, info.temperature_c, info.power_on_hours, info.smart_status)

        # Always update live SMART telemetry
        drive.device_path = dev.path
        drive.by_id_path = dev.by_id_path or drive.by_id_path
        drive.smart_status = info.smart_status
        drive.temperature_c = info.temperature_c
        drive.power_on_hours = info.power_on_hours
        drive.reallocated_sectors = info.reallocated_sectors
        drive.pending_sectors = info.pending_sectors
        drive.uncorrectable_errors = info.uncorrectable_errors
        drive.last_scanned = datetime.datetime.utcnow()

        # Only fill identity fields if not already manually set
        if not drive.make:
            drive.make = info.make
        if not drive.model:
            drive.model = info.model
        if not drive.firmware_version:
            drive.firmware_version = info.firmware
        if not drive.capacity_bytes:
            drive.capacity_bytes = info.capacity_bytes or dev.size_bytes or None
        if drive.rpm is None:
            drive.rpm = info.rpm
        if not drive.form_factor:
            drive.form_factor = info.form_factor

        updated.append(drive)

    db.commit()
    logger.info("Scan complete: %d drives found", len(updated))
    return updated
