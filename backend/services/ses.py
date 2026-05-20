from pathlib import Path


def get_enclosure_slots() -> dict[str, str]:
    """
    Best-effort mapping of {serial -> slot_label} via SES (SCSI Enclosure Services).
    Returns empty dict if SES is unavailable or no slot info found.
    """
    slots: dict[str, str] = {}
    ses_root = Path("/sys/class/enclosure")
    if not ses_root.exists():
        return slots

    for enclosure in ses_root.iterdir():
        for component in enclosure.iterdir():
            slot_file = component / "slot"
            device_dir = component / "device"
            if not slot_file.exists() or not device_dir.exists():
                continue
            try:
                slot = slot_file.read_text().strip()
                # Resolve serial via block device
                for block in (device_dir / "block").iterdir():
                    serial_file = Path(f"/sys/block/{block.name}/device/serial")
                    if serial_file.exists():
                        serial = serial_file.read_text().strip()
                        if serial:
                            slots[serial] = slot
            except (OSError, StopIteration):
                continue

    return slots
