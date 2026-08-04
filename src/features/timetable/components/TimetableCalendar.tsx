import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventContentArg } from "@fullcalendar/core";
import { Link } from "react-router-dom";
import { timetableData } from "../data/timetableData";
import { mapSessionsToCalendarEvents } from "../utils/calendarMappers";
import type { Cohort, Lecturer, Program, Session } from "../types";
import "./TimetableCalendar.css";

type SelectedEvent = {
  session: Session;
  lecturer?: Lecturer;
  programs: Program[];
  cohorts: Cohort[];
};

type ModalStep = 1 | 2 | 3 | 4;

export function TimetableCalendar() {
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null);
  const [modalStep, setModalStep] = useState<ModalStep>(1);

  const solutionStatus = 2;

  const constraintGroups = [
    {
      title: "Lecturer",
      items: [
        {
          rule: "Lecturers cannot teach more than 1 class at a time",
          relaxation: null,
          relaxable: false,
        },
        {
          rule: "Dr. Maria Chen is unavailable on days: MON, TUES",
          relaxation: null,
          relaxable: false,
        },
        {
          rule: "Dr. Maria Chen must have lunch break",
          relaxation: "Currently relaxed for THURS",
          relaxable: true,
        },
        {
          rule: "Dr. Maria Chen must have maximum 1 hour teaching per day",
          relaxation: "Currently relaxed for FRI",
          relaxable: true,
        },
      ],
    },
    {
      title: "Cohorts",
      items: [
        {
          rule: "CS Year 1 can have maximum 3 teaching hours per day",
          relaxation: "Currently set to 2 hours a day for MON",
          relaxable: true,
        },
        {
          rule: "DS Year 1 can have maximum 3 teaching hours per day",
          relaxation: "Currently disabled for MON",
          relaxable: true,
        },
      ],
    },
    {
      title: "Rooms / class",
      items: [
        {
          rule: "A room can have maximum one booking at a time",
          relaxation: null,
          relaxable: false,
        },
        {
          rule: "CS101 needs a class with: LINUX, PROJECTOR",
          relaxation: "PROJECTOR is currently relaxed",
          relaxable: true,
        },
        {
          rule: "CS101 needs a room with capacity of 50 people",
          relaxation: "Currently relaxed to 40 people",
          relaxable: true,
        },
      ],
    },
  ];

  const objectiveGroups = [
    {
      title: "Lecturer",
      items: [
        "Minimize lecturer preference violations",
        "Minimize lecturer idle time",
        "Balance lecturer workload",
      ],
    },
    {
      title: "Cohort",
      items: [
        "Minimize cohort timetable gaps",
        "Minimize back-to-back room changes",
        "Balance cohort daily workload",
      ],
    },
    {
      title: "Room",
      items: ["Maximize room utilization", "Minimize room capacity waste"],
    },
    {
      title: "Global",
      items: [
        "Minimize the number of timetable changes",
        "Minimize soft constraint violations",
      ],
    },
  ];

  const events = mapSessionsToCalendarEvents(
    timetableData.sessions,
    timetableData.modules,
    timetableData.lecturers,
    timetableData.programs,
    timetableData.cohorts
  );

  function openRescheduleModal(eventDetails: SelectedEvent) {
    setSelectedEvent(eventDetails);
    setModalStep(1);
  }

  function closeModal() {
    setSelectedEvent(null);
    setModalStep(1);
  }

  function renderEventContent(eventInfo: EventContentArg) {
    const eventDetails = eventInfo.event.extendedProps as SelectedEvent;

    return (
      <div className="timetable-event">
        <div className="event-menu">
          <button className="event-menu-button">⋯</button>

          <div className="event-menu-dropdown">
            <Link to={`/sessions/${eventDetails.session.id}/reschedule`}>
              Reschedule
            </Link>
          </div>
        </div>

        <div className="event-time">{eventInfo.timeText}</div>
        <div className="event-title">{eventInfo.event.title}</div>
        <div className="event-title">
          ROOM: {eventDetails.session.room ?? "TBC"}
        </div>
        <div className="event-title">
            Lecturer: {eventDetails.lecturer?.name ?? "Unassigned"}
         </div>
      </div>
    );
  }

  return (
    <section className="timetable-shell">
      <h1 className="timetable-title">University Timetable</h1>

      <div className="timetable-calendar">
        <FullCalendar
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          initialDate="2026-09-21"
          weekends={false}
          allDaySlot={false}
          slotMinTime="08:00:00"
          slotMaxTime="20:00:00"
          height="auto"
          events={events}
          eventContent={renderEventContent}
        />
      </div>

      {selectedEvent && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2 className="modal-title">Reschedule class</h2>

            <div className="modal-steps">
              <button
                className={modalStep === 1 ? "modal-step active" : "modal-step"}
                onClick={() => setModalStep(1)}
              >
                1. Request
              </button>

              <button
                className={modalStep === 2 ? "modal-step active" : "modal-step"}
                onClick={() => setModalStep(2)}
              >
                2. Impact
              </button>

              <button
                className={modalStep === 3 ? "modal-step active" : "modal-step"}
                onClick={() => setModalStep(3)}
              >
                3. Priorities
              </button>

              <button
                className={modalStep === 4 ? "modal-step active" : "modal-step"}
                onClick={() => setModalStep(4)}
              >
                4. Solution
              </button>
            </div>

            <div className="modal-body">
              {modalStep === 1 && (
                <>
                  <h3 className="schedule-change-title">Reschedule request</h3>

                  <div className="impact-section">
                    <div className="impact-group change-section">
                      <div className="impact-label">
                        What do you want to change?
                      </div>

                      <div className="request-options">
                        <button>Change time</button>
                        <button>Change room</button>
                        <button>Change room and time</button>
                        <button>Change lecturer</button>
                      </div>
                    </div>

                    <div className="impact-group change-section">
                      <div className="impact-label">
                        Do you know the new time?
                      </div>

                      <div className="request-options">
                        <button>I know the time</button>
                        <button>Find a new time</button>
                      </div>
                    </div>

                    <div className="impact-group">
                      <div className="impact-label">
                        How many other classes are allowed to be rescheduled?
                      </div>

                      <div className="request-options">
                        <button>Only this class</button>
                        <button>Up to 2 other classes</button>
                        <button>Up to 3 other classes</button>
                      </div>
                    </div>

                    <div className="impact-group change-section">
                      <div className="impact-label">Known time</div>

                      <label>
                        Start
                        <input
                          type="datetime-local"
                          defaultValue={selectedEvent.session.start.slice(
                            0,
                            16
                          )}
                        />
                      </label>

                      <label>
                        End
                        <input
                          type="datetime-local"
                          defaultValue={selectedEvent.session.end.slice(0, 16)}
                        />
                      </label>
                    </div>
                  </div>
                </>
              )}

              {modalStep === 2 && (
                <>
                  <h3 className="impact-title">Affected groups</h3>

                  <div className="impact-section">
                    <div className="impact-group">
                      <div className="impact-label">Lecturer</div>

                      <div className="impact-chips">
                        <div className="impact-chip">
                          {selectedEvent.lecturer?.name ?? "Unassigned"}
                        </div>
                      </div>
                    </div>

                    <div className="impact-group">
                      <div className="impact-label">Programs</div>

                      <div className="impact-chips">
                        {selectedEvent.programs.map((program) => (
                          <div key={program.id} className="impact-chip">
                            {program.name}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="impact-group">
                      <div className="impact-label">Cohorts</div>

                      <div className="impact-chips">
                        {selectedEvent.cohorts.map((cohort) => (
                          <div key={cohort.id} className="impact-chip">
                            {cohort.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="modal-divider" />

                  <div className="constraints-header">
                    <h3 className="schedule-change-title">
                      Related constraints
                    </h3>

                    <a href="/constraints" className="modify-constraints-button">
                      Modify constraints
                    </a>
                  </div>

                  <div className="constraints-section">
                      {constraintGroups.map((group) => (
                        <div key={group.title} className="constraint-group-block">
                          <div className="constraint-group-heading">
                            <h4>{group.title}</h4>
                            <span>{group.items.length}</span>
                          </div>

                          <div className="constraints-table">
                            <div className="constraints-table-header">
                              <span>Constraint</span>
                              <span>Current state</span>
                              <span>Type</span>
                            </div>

                            {group.items.map((item) => (
                              <div key={item.rule} className="constraints-table-row">
                                <span className="constraint-name">{item.rule}</span>

                                <span className="constraint-state">
                                  {item.relaxation ?? "Active"}
                                </span>

                                <span
                                  className={
                                    item.relaxable
                                      ? "constraint-type-badge relaxable"
                                      : "constraint-type-badge unrelaxable"
                                  }
                                >
                                  {item.relaxable ? "Relaxable" : "Unrelaxable"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                </>
              )}

              {modalStep === 3 && (
                <>
                  <h3 className="impact-title">Priorities</h3>

                  <p className="step-description">
                    Reorder the objectives to tell the solver how to rank
                    solution alternatives.
                  </p>

                  <div className="objectives-panel">
                    {objectiveGroups.map((group, groupIndex) => {
                      const previousCount = objectiveGroups
                        .slice(0, groupIndex)
                        .reduce(
                          (total, previousGroup) =>
                            total + previousGroup.items.length,
                          0
                        );

                      return (
                        <div key={group.title} className="objective-group">
                          <div className="impact-label">{group.title}</div>

                          <div className="objective-list">
                            {group.items.map((objective, index) => {
                              const globalRank = previousCount + index + 1;

                              return (
                                <div key={objective} className="objective-row">
                                  <span className="objective-rank">
                                    {globalRank}
                                  </span>
                                  <span>{objective}</span>
                                  <span className="objective-handle">☰</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {modalStep === 4 && (
                <>
                  {solutionStatus === 1 && (
                    <>
                      <h3 className="impact-title">Solution alternatives</h3>

                      <div className="solution-options">
                        <div className="solution-card recommended">
                          <div className="solution-card-header">
                            <h4>Alternative 1</h4>
                            <span className="solution-tag">Recommended</span>
                          </div>

                          <div className="solution-main">
                            Wed 23 Sep, 14:00 – 16:00 · Room B302
                          </div>

                          <div className="solution-score warning">
                            No changes required, low lecturer preferences score
                          </div>
                        </div>

                        <div className="solution-card">
                          <div className="solution-card-header">
                            <h4>Alternative 2</h4>
                          </div>

                          <div className="solution-main">
                            Thu 24 Sep, 10:00 – 12:00 · Room C105
                          </div>

                          <div className="solution-score warning">
                            1 change required, low walking distance score for
                            cohort
                          </div>
                        </div>

                        <div className="solution-card">
                          <div className="solution-card-header">
                            <h4>Alternative 3</h4>
                          </div>

                          <div className="solution-main">
                            Fri 25 Sep, 09:00 – 11:00 · Room A210
                          </div>

                          <div className="solution-score bad">
                            2 changes required, bad room utilization score
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {solutionStatus === 2 && (
                    <div className="no-solution-card">
                      <div className="no-solution-icon">!</div>

                      <div>
                        <h4>Time conflict detected</h4>

                        <p>
                          It is not possible to fulfill this request because{" "}
                          <strong>Dr. Maria Chen</strong> already teaches another
                          class at this time.
                        </p>

                        <div className="conflict-details">
                          <div>
                            <span>Conflicting class</span>
                            <strong>DS110 · Intro to Data</strong>
                          </div>

                          <div>
                            <span>Time</span>
                            <strong>Tuesday, 10:00 – 12:00</strong>
                          </div>

                          <div>
                            <span>Room</span>
                            <strong>Room B204</strong>
                          </div>
                        </div>

                        <div className="constraint-source">
                          <span>Responsible constraint family</span>
                          <strong>Lecturer constraints</strong>
                          <p>
                            Lecturers cannot teach more than one class at the
                            same time.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {solutionStatus === 3 && (
                    <>
                      <h3 className="impact-title">Solution</h3>

                      <div className="no-solution-card">
                        <div className="no-solution-icon">!</div>

                        <div>
                          <h4>No solution found</h4>

                          <p>
                            We couldn't find a solution for your request. You
                            requested to move this class to{" "}
                            <strong>Tuesday</strong>, however this would require
                            lecturer <strong>Dr. Maria Chen</strong> to teach for
                            more than <strong>3 hours</strong> on that day.
                          </p>

                          <p>
                            The rules you have set currently do not allow this.
                          </p>

                          <a href="/constraints" className="change-rule-link">
                            Change this rule
                          </a>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="modal-actions">
              <button onClick={closeModal}>Cancel</button>

              {modalStep > 1 && (
                <button
                  onClick={() => setModalStep((modalStep - 1) as ModalStep)}
                >
                  Back
                </button>
              )}

              {modalStep === 1 && (
                <button className="primary-button" onClick={() => setModalStep(2)}>
                  Continue
                </button>
              )}

              {modalStep === 2 && (
                <button className="primary-button" onClick={() => setModalStep(3)}>
                  Continue
                </button>
              )}

              {modalStep === 3 && (
                <button className="primary-button" onClick={() => setModalStep(4)}>
                  Fetch solution
                </button>
              )}

              {modalStep === 4 && (
                <button className="primary-button">Save request</button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}