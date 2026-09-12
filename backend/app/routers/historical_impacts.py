from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models

router = APIRouter(
    prefix="/historical-impacts",
    tags=["historical impacts"],
)


@router.get("/")
def get_historical_impacts(
    stakeholder_type: str | None = None,
    impact_type: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.HistoricalImpact)

    if stakeholder_type:
        query = query.filter(
            models.HistoricalImpact.stakeholder_type
            == stakeholder_type
        )

    if impact_type:
        query = query.filter(
            models.HistoricalImpact.impact_type
            == impact_type
        )

    impacts = query.all()

    result = []

    for impact in impacts:
        semester = (
            db.query(models.Semester)
            .filter(models.Semester.id == impact.semester_id)
            .first()
        )

        stakeholder_name = impact.stakeholder_id

        if impact.stakeholder_type == "lecturer":
            lecturer = (
                db.query(models.Lecturer)
                .filter(models.Lecturer.id == impact.stakeholder_id)
                .first()
            )

            if lecturer:
                stakeholder_name = lecturer.name

        elif impact.stakeholder_type == "cohort":
            cohort = (
                db.query(models.Cohort)
                .filter(models.Cohort.id == impact.stakeholder_id)
                .first()
            )

            if cohort:
                stakeholder_name = cohort.name

        result.append(
            {
                "id": impact.id,

                "semester_id": impact.semester_id,
                "semester_name": (
                    semester.name
                    if semester
                    else impact.semester_id
                ),

                "stakeholder_type": impact.stakeholder_type,
                "stakeholder_id": impact.stakeholder_id,
                "stakeholder_name": stakeholder_name,

                "constraint_id": impact.constraint_id,
                "impact_type": impact.impact_type,

                "occurred_on": impact.occurred_on,
                "day": impact.day,

                "magnitude_minutes": impact.magnitude_minutes,
                "details": impact.details,
            }
        )

    return result