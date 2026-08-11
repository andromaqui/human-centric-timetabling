import uuid
from sqlalchemy.orm import Session as DBSession
from . import models

DAYS = ["mon", "tue", "wed", "thu", "fri"]

DAY_SCOPED_LECTURER_CONSTRAINTS = {"lecturer-max-one-hour-per-day", "lecturer-lunch-break"}
DAY_SCOPED_COHORT_CONSTRAINTS = {"cohort-max-teaching-hours-per-day"}


def attach_session_constraints(db: DBSession, session_id: str):
    constraints = db.query(models.Constraint).filter(
        models.Constraint.stakeholder == "Session"
    ).all()
    for c in constraints:
        db.add(models.SessionConstraint(
            id=str(uuid.uuid4()), session_id=session_id, constraint_id=c.id, is_activated=True
        ))


def attach_lecturer_constraints(db: DBSession, lecturer_id: str):
    constraints = db.query(models.Constraint).filter(
        models.Constraint.stakeholder == "Lecturer"
    ).all()
    for c in constraints:
        if c.id in DAY_SCOPED_LECTURER_CONSTRAINTS:
            for day in DAYS:
                db.add(models.LecturerConstraint(
                    id=str(uuid.uuid4()), lecturer_id=lecturer_id, constraint_id=c.id,
                    day=day, is_activated=True
                ))
        else:
            db.add(models.LecturerConstraint(
                id=str(uuid.uuid4()), lecturer_id=lecturer_id, constraint_id=c.id,
                day=None, is_activated=True
            ))


def attach_cohort_constraints(db: DBSession, cohort_id: str):
    constraints = db.query(models.Constraint).filter(
        models.Constraint.stakeholder == "Cohort"
    ).all()
    for c in constraints:
        if c.id in DAY_SCOPED_COHORT_CONSTRAINTS:
            for day in DAYS:
                db.add(models.CohortConstraint(
                    id=str(uuid.uuid4()), cohort_id=cohort_id, constraint_id=c.id,
                    day=day, is_activated=True
                ))
        else:
            db.add(models.CohortConstraint(
                id=str(uuid.uuid4()), cohort_id=cohort_id, constraint_id=c.id,
                day=None, is_activated=True
            ))


def attach_room_constraints(db: DBSession, room_id: str):
    constraints = db.query(models.Constraint).filter(
        models.Constraint.stakeholder == "Room"
    ).all()
    for c in constraints:
        db.add(models.RoomConstraint(
            id=str(uuid.uuid4()), room_id=room_id, constraint_id=c.id, is_activated=True
        ))