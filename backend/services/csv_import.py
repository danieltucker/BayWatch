import csv
import datetime
import io
import re
from typing import Optional

from sqlalchemy.orm import Session

from models.bay import Bay
from models.drive import Drive
from models.drive_profile import DriveProfile

# Maps lowercase CSV column aliases -> internal field names
_COLUMN_ALIASES: dict[str, str] = {
    "position": "position",
    "pos": "position",
    "dev name": "device_path",
    "dev": "device_path",
    "device": "device_path",
    "device name": "device_path",
    "make": "make",
    "manufacturer": "make",
    "model": "model",
    "serial": "serial",
    "serial number": "serial",
    "serial no": "serial",
    "size": "size",
    "capacity": "size",
    "mfg date": "mfg_date",
    "manufacture date": "mfg_date",
    "manufactured": "mfg_date",
    "manufactured date": "mfg_date",
    "source": "vendor",
    "vendor": "vendor",
    "warranty": "warranty",
    "warranty months": "warranty",
    "warranty period": "warranty",
    "notes": "notes",
    "note": "notes",
    "comments": "notes",
}


def _parse_capacity(s: str) -> Optional[int]:
    if not s:
        return None
    m = re.match(r'^([\d.]+)\s*(TB|GB|MB|TiB|GiB|MiB)?$', s.strip(), re.IGNORECASE)
    if not m:
        return None
    val = float(m.group(1))
    unit = (m.group(2) or 'GB').upper()
    multipliers = {
        'TB': 1_000_000_000_000,
        'GB': 1_000_000_000,
        'MB': 1_000_000,
        'TIB': 1_099_511_627_776,
        'GIB': 1_073_741_824,
        'MIB': 1_048_576,
    }
    return int(val * multipliers.get(unit, 1_000_000_000))


def _parse_date(s: str) -> Optional[datetime.date]:
    if not s:
        return None
    s = s.strip()
    for fmt in ('%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%m-%d-%Y', '%Y/%m/%d'):
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def _parse_warranty_months(s: str) -> Optional[int]:
    if not s:
        return None
    s = s.strip()
    try:
        return int(s)
    except ValueError:
        pass
    m = re.match(r'^(\d+)\s*(mo|month|months|yr|year|years)$', s, re.IGNORECASE)
    if m:
        val = int(m.group(1))
        return val * 12 if m.group(2).lower().startswith('y') else val
    return None


def run_import(content: bytes, db: Session) -> dict:
    text = content.decode('utf-8-sig')  # strips BOM if present
    reader = csv.DictReader(io.StringIO(text))

    # Build field_name -> original CSV header (first alias match wins)
    raw_headers = list(reader.fieldnames or [])
    field_raw: dict[str, str] = {}
    for raw in raw_headers:
        alias = raw.strip().lower()
        if alias in _COLUMN_ALIASES:
            field = _COLUMN_ALIASES[alias]
            if field not in field_raw:
                field_raw[field] = raw

    def get(row: dict, field: str) -> str:
        raw = field_raw.get(field)
        return (row.get(raw) or '').strip() if raw else ''

    # Index all bays by lowercased label for position matching
    bay_label_index: dict[str, list[Bay]] = {}
    for bay in db.query(Bay).all():
        if bay.label:
            bay_label_index.setdefault(bay.label.strip().lower(), []).append(bay)

    imported = updated = assigned = 0
    skipped: list[dict] = []

    for row_num, row in enumerate(reader, start=2):
        serial = get(row, 'serial')
        if not serial:
            skipped.append({"row": row_num, "serial": None, "reason": "Missing serial"})
            continue

        # Upsert Drive
        drive = db.get(Drive, serial)
        is_new = drive is None
        if is_new:
            drive = Drive(serial=serial, smart_status='UNKNOWN')
            db.add(drive)

        if get(row, 'make'):
            drive.make = get(row, 'make')
        if get(row, 'model'):
            drive.model = get(row, 'model')
        if get(row, 'device_path'):
            drive.device_path = get(row, 'device_path')
        cap = _parse_capacity(get(row, 'size'))
        if cap is not None:
            drive.capacity_bytes = cap

        # Upsert DriveProfile
        profile = db.get(DriveProfile, serial)
        if profile is None:
            profile = DriveProfile(serial=serial)
            db.add(profile)

        mfg = _parse_date(get(row, 'mfg_date'))
        if mfg:
            profile.mfg_date = mfg
        warranty = _parse_warranty_months(get(row, 'warranty'))
        if warranty is not None:
            profile.warranty_months = warranty
        if get(row, 'vendor'):
            profile.vendor = get(row, 'vendor')
        if get(row, 'notes'):
            profile.notes = get(row, 'notes')

        db.flush()

        if is_new:
            imported += 1
        else:
            updated += 1

        # Bay assignment by position label
        position = get(row, 'position')
        if position:
            matches = bay_label_index.get(position.lower(), [])
            if len(matches) == 1:
                bay = matches[0]
                prev = db.query(Bay).filter(Bay.drive_serial == serial).first()
                if prev and prev.id != bay.id:
                    prev.drive_serial = None
                bay.drive_serial = serial
                assigned += 1
            elif len(matches) == 0:
                skipped.append({"row": row_num, "serial": serial,
                                 "reason": f"Position '{position}' not found"})
            else:
                skipped.append({"row": row_num, "serial": serial,
                                 "reason": f"Position '{position}' matches {len(matches)} bays"})

    db.commit()
    return {"imported": imported, "updated": updated, "assigned": assigned, "skipped": skipped}
