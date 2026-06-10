import datetime
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.deps import get_db
from api.schemas import ReportCreate, ReportListItem, ReportRead
from models.report import Report
from services.report_generator import generate_report_data

router = APIRouter()


@router.get("", response_model=list[ReportListItem])
def list_reports(db: Session = Depends(get_db)):
    return db.query(Report).order_by(Report.generated_at.desc()).all()


@router.post("", status_code=201)
def create_report(body: ReportCreate, db: Session = Depends(get_db)):
    now = datetime.datetime.utcnow()
    period_end = now
    period_start = now - datetime.timedelta(days=body.period_days)
    data_json = generate_report_data(db, period_start, period_end)
    report = Report(
        generated_at=now,
        period_days=body.period_days,
        period_start=period_start,
        period_end=period_end,
        data=data_json,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {
        "id": report.id,
        "generated_at": report.generated_at,
        "period_days": report.period_days,
        "period_start": report.period_start,
        "period_end": report.period_end,
        "data": json.loads(report.data),
    }


@router.get("/{report_id}")
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return {
        "id": report.id,
        "generated_at": report.generated_at,
        "period_days": report.period_days,
        "period_start": report.period_start,
        "period_end": report.period_end,
        "data": json.loads(report.data),
    }


@router.delete("/{report_id}", status_code=204)
def delete_report(report_id: int, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(report)
    db.commit()
