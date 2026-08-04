import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import type {
  EventContentArg,
  EventInput,
} from "@fullcalendar/core";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import { savedSolutions } from "../data/savedSolutionsData";
import { getSavedSolutionById } from "../data/savedSolutionsStore";
import "./SavedSolutionDetailPage.css";

const REFERENCE_WEEK_START = "2026-09-21";

const dayOffsets: Record<string, number> = {
  mon: 0,
  monday: 0,
  tue: 1,
  tues: 1,
  tuesday: 1,
  wed: 2,
  wednesday: 2,
  thu: 3,
  thur: 3,
  thurs: 3,
  thursday: 3,
  fri: 4,
  friday: 4,
};

const datesByDay: Record<string, string> = {
  mon: "2026-09-21",
  monday: "2026-09-21",

  tue: "2026-09-22",
  tues: "2026-09-22",
  tuesday: "2026-09-22",

  wed: "2026-09-23",
  wednesday: "2026-09-23",

  thu: "2026-09-24",
  thur: "2026-09-24",
  thurs: "2026-09-24",
  thursday: "2026-09-24",

  fri: "2026-09-25",
  friday: "2026-09-25",
};

function dateForDay(day?: string) {
  if (!day) {
    return REFERENCE_WEEK_START;
  }

  return (
    datesByDay[day.trim().toLowerCase()] ??
    REFERENCE_WEEK_START
  );
}

function normalizeTime(time?: string) {
  if (!time) {
    return "00:00";
  }

  const match = time.match(/\d{1,2}:\d{2}/);

  if (!match) {
    return "00:00";
  }

  const [hour, minute] = match[0].split(":");

  return `${hour.padStart(2, "0")}:${minute}`;
}

export function SavedSolutionDetailPage() {
  const { solutionId } = useParams();

  const solution =
    getSavedSolutionById(solutionId ?? "") ??
    savedSolutions.find(
      (savedSolution) => savedSolution.id === solutionId,
    );

  console.log(solution);

  if (!solution) {
    return (
      <section className="saved-solution-detail-page">
        <div className="saved-solution-not-found">
          <h1>Saved solution not found</h1>

          <p>
            This solution may have been removed or the URL may be
            incorrect.
          </p>

          <Link
            to="/saved-solutions"
            className="saved-detail-primary-link"
          >
            <ArrowLeft size={17} />
            Back to saved solutions
          </Link>
        </div>
      </section>
    );
  }

  const activeConstraints = solution.constraints.filter(
    (constraint) => constraint.state !== "Disabled",
  );

  const activeObjectives = solution.objectives.filter(
    (objective) => objective.enabled,
  );

  const additionalChangeModules = new Set(
    solution.additionalChanges.map((change) => change.moduleCode),
  );

  const calendarEvents: EventInput[] =
    solution.resultingSessions.map((session) => {
      const savedSession = session as typeof session & {
        day?: string;
        startTime?: string;
        endTime?: string;
        start?: string;
        end?: string;
      };

      const date = dateForDay(savedSession.day);

      const start =
        savedSession.start ??
        `${date}T${normalizeTime(savedSession.startTime)}:00`;

      const end =
        savedSession.end ??
        `${date}T${normalizeTime(savedSession.endTime)}:00`;

      const isRequestedChange =
        savedSession.moduleCode === solution.moduleCode;

      const isAdditionalChange =
        !isRequestedChange &&
        additionalChangeModules.has(savedSession.moduleCode);

      return {
        id: savedSession.id,
        title: savedSession.moduleCode,
        start,
        end,
        classNames: [
          isRequestedChange
            ? "saved-calendar-event-requested"
            : isAdditionalChange
              ? "saved-calendar-event-additional"
              : "saved-calendar-event-unchanged",
        ],
        extendedProps: {
          moduleCode: savedSession.moduleCode,
          room: savedSession.room ?? "TBC",
        },
      };
    });

  function renderCalendarEvent(eventInfo: EventContentArg) {
    const { moduleCode, room } =
      eventInfo.event.extendedProps as {
        moduleCode: string;
        room: string;
      };

    return (
      <div className="saved-calendar-event-content">
        <strong>{moduleCode}</strong>
        <span>{eventInfo.timeText}</span>
        <span>{room}</span>
      </div>
    );
  }

  return (
    <section className="saved-solution-detail-page">
      <Link
        to="/saved-solutions"
        className="saved-detail-back-link"
      >
        <ArrowLeft size={17} />
        All saved solutions
      </Link>

      <header className="saved-detail-header">
        <div>
          <div className="saved-detail-title-row">
            <span className="saved-detail-module-code">
              {solution.moduleCode}
            </span>

            <span className="saved-detail-status">
              <CheckCircle2 size={15} />
              Saved solution
            </span>
          </div>

          <h1>{solution.moduleTitle}</h1>

          <p>{solution.requestSummary}</p>
        </div>

        <div className="saved-detail-meta">
          <span>
            Saved{" "}
            {new Date(solution.savedAt).toLocaleDateString(
              undefined,
              {
                day: "numeric",
                month: "long",
                year: "numeric",
              },
            )}
          </span>

          <span>Solution ID: {solution.id}</span>
        </div>
      </header>

      <div className="saved-detail-layout">
        <main className="saved-detail-main">
          <section className="saved-detail-card">
            <div className="saved-detail-section-heading">
              <CalendarDays size={20} />

              <div>
                <h2>Requested change</h2>
                <p>
                  The timetable change that produced this saved
                  solution.
                </p>
              </div>
            </div>

            <div className="saved-detail-change">
              <div className="saved-detail-change-column">
                <span className="saved-detail-label">From</span>

                <strong>{solution.original.day}</strong>

                <div>
                  <Clock size={16} />
                  {solution.original.time}
                </div>

                <div>
                  <MapPin size={16} />
                  {solution.original.room}
                </div>

                <div>
                  <Users size={16} />
                  {solution.original.lecturer}
                </div>
              </div>

              <div className="saved-detail-change-arrow">
                <ArrowRight size={26} />
              </div>

              <div className="saved-detail-change-column">
                <span className="saved-detail-label">To</span>

                <strong>{solution.result.day}</strong>

                <div>
                  <Clock size={16} />
                  {solution.result.time}
                </div>

                <div>
                  <MapPin size={16} />
                  {solution.result.room}
                </div>

                <div>
                  <Users size={16} />
                  {solution.result.lecturer}
                </div>
              </div>
            </div>
          </section>

          {solution.additionalChanges.length > 0 && (
            <section className="saved-detail-card">
              <div className="saved-detail-section-heading">
                <SlidersHorizontal size={20} />

                <div>
                  <h2>Additional timetable changes</h2>
                  <p>
                    Other sessions changed to make the requested
                    move possible.
                  </p>
                </div>
              </div>

              <div className="saved-detail-additional-list">
                {solution.additionalChanges.map(
                  (change, index) => (
                    <article
                      key={`${change.moduleCode}-${index}`}
                      className="saved-detail-additional-change"
                    >
                      <h3>{change.moduleCode}</h3>

                      <div className="saved-detail-additional-grid">
                        <div>
                          <span>Before</span>

                          <strong>{change.before.day}</strong>

                          <p>
                            {change.before.time},{" "}
                            {change.before.room}
                          </p>
                        </div>

                        <ArrowRight size={20} />

                        <div>
                          <span>After</span>

                          <strong>{change.after.day}</strong>

                          <p>
                            {change.after.time},{" "}
                            {change.after.room}
                          </p>
                        </div>
                      </div>
                    </article>
                  ),
                )}
              </div>
            </section>
          )}

          <section className="saved-detail-card">
            <div className="saved-detail-section-heading">
              <CheckCircle2 size={20} />

              <div>
                <h2>Active constraints</h2>
                <p>
                  Constraint settings captured when this solution
                  was generated.
                </p>
              </div>
            </div>

            <div className="saved-detail-table-wrapper">
              <table className="saved-detail-table">
                <thead>
                  <tr>
                    <th>Stakeholder</th>
                    <th>Constraint</th>
                    <th>Status</th>
                    <th>Relaxable</th>
                  </tr>
                </thead>

                <tbody>
                  {activeConstraints.map(
                    (constraint, index) => (
                      <tr key={`${constraint.rule}-${index}`}>
                        <td>{constraint.group}</td>
                        <td>{constraint.rule}</td>
                        <td>
                          <span
                            className={
                              constraint.state
                                .toLowerCase()
                                .includes("relaxed")
                                ? "saved-detail-badge saved-detail-badge-warning"
                                : "saved-detail-badge saved-detail-badge-success"
                            }
                          >
                            {constraint.state}
                          </span>
                        </td>
                        <td>
                          {constraint.relaxable ? "Yes" : "No"}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="saved-detail-card">
            <div className="saved-detail-section-heading">
              <SlidersHorizontal size={20} />

              <div>
                <h2>Active objectives</h2>
                <p>
                  Objective weights used to rank candidate
                  solutions.
                </p>
              </div>
            </div>

            <div className="saved-detail-objectives">
              {activeObjectives.map((objective) => (
                <div
                  key={objective.id}
                  className="saved-detail-objective"
                >
                  <div className="saved-detail-objective-copy">
                    <span>{objective.stakeholder}</span>
                    <strong>{objective.label}</strong>
                  </div>

                  <div className="saved-detail-objective-weight">
                    <div
                      className="saved-detail-objective-fill"
                      style={{
                        width: `${objective.weight}%`,
                      }}
                    />

                    <span>{objective.weight}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="saved-detail-card">
            <div className="saved-detail-section-heading">
              <CalendarDays size={20} />

              <div>
                <h2>Resulting timetable</h2>
                <p>
                  Complete time table snapshot produced by this
                  saved solution.
                </p>
              </div>
            </div>

            <div className="saved-detail-calendar">
              <FullCalendar
                  plugins={[timeGridPlugin]}
                  initialView="timeGridWeek"
                  initialDate={REFERENCE_WEEK_START}
                  weekends={false}
                  allDaySlot={false}
                  slotMinTime="08:00:00"
                  slotMaxTime="20:00:00"
                  slotDuration="00:30:00"
                  height="auto"
                  editable={false}
                  selectable={false}
                  headerToolbar={{
                    left: "",
                    center: "",
                    right: "",
                  }}
                  dayHeaderFormat={{
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  }}
                  eventTimeFormat={{
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  }}
                  slotLabelFormat={{
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  }}
                  events={calendarEvents}
                  eventContent={renderCalendarEvent}
                />
            </div>

            <div className="saved-detail-calendar-legend">
              <span>
                <i className="saved-calendar-key requested" />
                Requested move
              </span>

              <span>
                <i className="saved-calendar-key additional" />
                Additional change
              </span>

              <span>
                <i className="saved-calendar-key unchanged" />
                Unchanged session
              </span>
            </div>
          </section>
        </main>

        <aside className="saved-detail-sidebar">
          <section className="saved-detail-card saved-detail-summary-card">
            <h2>Solution summary</h2>

            <dl>
              <div>
                <dt>Request type</dt>
                <dd>
                  {solution.requestType
                    .replaceAll("-", " ")
                    .replace(/\b\w/g, (letter) =>
                      letter.toUpperCase(),
                    )}
                </dd>
              </div>

              <div>
                <dt>Primary changes</dt>
                <dd>1</dd>
              </div>

              <div>
                <dt>Additional changes</dt>
                <dd>{solution.additionalChanges.length}</dd>
              </div>

              <div>
                <dt>Active constraints</dt>
                <dd>{activeConstraints.length}</dd>
              </div>

              <div>
                <dt>Active objectives</dt>
                <dd>{activeObjectives.length}</dd>
              </div>
            </dl>
          </section>

          <section className="saved-detail-card">
            <h2>Affected stakeholders</h2>

            <div className="saved-detail-stakeholders">
              {solution.affectedStakeholders.map(
                (stakeholder) => (
                  <Link
                    key={`${stakeholder.type}-${stakeholder.id}`}
                    to={`/timetable-preview?${stakeholder.type}=${encodeURIComponent(
                      stakeholder.id,
                    )}`}
                    className="saved-detail-stakeholder"
                  >
                    <div>
                      <span>{stakeholder.type}</span>
                      <strong>{stakeholder.label}</strong>
                    </div>

                    <ArrowRight size={17} />
                  </Link>
                ),
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}