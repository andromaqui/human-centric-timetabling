import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import type {
  EventContentArg,
  EventInput,
} from "@fullcalendar/core";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  GraduationCap,
  MapPin,
  SlidersHorizontal,
  UserRound,
  Users,
} from "lucide-react";

import { savedSolutions } from "../data/savedSolutionsData";
import { getSavedSolutionById } from "../data/savedSolutionsStore";
import {
  historicalStakeholderImpacts,
  type HistoricalImpactDetails,
  type HistoricalImpactType,
} from "../data/historicalStakeholderImpact";
import "./SavedSolutionDetailPage.css";

const REFERENCE_WEEK_START = "2026-09-21";

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

type TimetableFilterType =
  | "all"
  | "lecturer"
  | "cohort"
  | "room";

type FilterableSession = {
  id?: string;
  moduleCode: string;
  moduleTitle?: string;
  day?: string;
  startTime?: string;
  endTime?: string;
  start?: string;
  end?: string;
  room?: string;
  lecturer?: string;
  cohorts?: {
    id: string;
    label: string;
  }[];
  cohortIds?: string[];
};


function formatImpactMinutes(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = minutes / 60;

  return Number.isInteger(hours)
    ? `${hours} ${hours === 1 ? "hour" : "hours"}`
    : `${hours.toFixed(1)} hours`;
}

function getHistoricalOccurrenceCount(
  stakeholderId: string,
  impactType: HistoricalImpactType,
) {
  const history = historicalStakeholderImpacts.find(
    (entry) => entry.stakeholderId === stakeholderId,
  );

  if (!history) {
    return 0;
  }

  return history.impacts
    .filter((impact) => impact.impactType === impactType)
    .reduce((total, impact) => {
      if (impact.details.kind === "lunch-break") {
        return total + impact.details.changes.length;
      }

      return total + 1;
    }, 0);
}

function getHistoricalDecisionCount(
  stakeholderId: string,
  impactType: HistoricalImpactType,
) {
  const history = historicalStakeholderImpacts.find(
    (entry) => entry.stakeholderId === stakeholderId,
  );

  return (
    history?.impacts.filter(
      (impact) => impact.impactType === impactType,
    ).length ?? 0
  );
}

function renderCandidateImpactDetails(
  details: HistoricalImpactDetails,
) {
  if (details.kind === "lunch-break") {
    return (
      <div className="saved-detail-impact-effect-list">
        {details.changes.map((change) => (
          <div
            key={change.day}
            className="saved-detail-impact-effect-row"
          >
            <span className="saved-detail-impact-effect-bullet" />

            <span>
              {change.day.slice(0, 3)} {change.after}
            </span>

            <em>
              ({formatImpactMinutes(change.lostMinutes)} shorter)
            </em>
          </div>
        ))}
      </div>
    );
  }

  if (details.kind === "consecutive-teaching") {
    return (
      <div className="saved-detail-impact-effect-list">
        <div className="saved-detail-impact-effect-row">
          <span className="saved-detail-impact-effect-bullet" />

          <span>
            {details.day.slice(0, 3)} {details.afterWindow}
          </span>

          <em>({details.afterHours} consecutive hours)</em>
        </div>

        <p className="saved-detail-impact-limit">
          Preferred maximum: {details.allowedHours} hours
        </p>
      </div>
    );
  }

  if (details.kind === "daily-teaching-hours") {
    return (
      <div className="saved-detail-impact-effect-list">
        <div className="saved-detail-impact-effect-row">
          <span className="saved-detail-impact-effect-bullet" />

          <span>
            {details.day.slice(0, 3)} {details.afterHours} teaching hours
          </span>
        </div>

        <p className="saved-detail-impact-limit">
          Preferred maximum: {details.allowedHours} hours
        </p>
      </div>
    );
  }

  if (details.kind === "large-timetable-gap") {
    return (
      <div className="saved-detail-impact-effect-list">
        <div className="saved-detail-impact-effect-row">
          <span className="saved-detail-impact-effect-bullet" />

          <span>
            {details.day.slice(0, 3)} {details.afterWindow}
          </span>

          <em>
            ({formatImpactMinutes(details.afterGapMinutes)} gap)
          </em>
        </div>
      </div>
    );
  }

  return (
    <div className="saved-detail-impact-effect-list">
      <div className="saved-detail-impact-effect-row">
        <span className="saved-detail-impact-effect-bullet" />

        <span>
          {details.day.slice(0, 3)} finishes at {details.actualFinish}
        </span>

        <em>
          ({formatImpactMinutes(details.additionalMinutes)} later)
        </em>
      </div>
    </div>
  );
}

function CollapsibleHeading({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <summary className="saved-detail-collapsible-summary">
      <div className="saved-detail-collapsible-summary-main">
        <span className="saved-detail-collapsible-icon">
          {icon}
        </span>

        <div className="saved-detail-collapsible-copy">
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>

      <span
        className="saved-detail-collapsible-chevron"
        aria-hidden="true"
      >
        <ChevronRight size={20} />
      </span>
    </summary>
  );
}

export function SavedSolutionDetailPage() {
  const { solutionId } = useParams();

  const [filterType, setFilterType] =
    useState<TimetableFilterType>("all");
  const [filterValue, setFilterValue] = useState("");

  // Prefer the demo data file so stakeholderImpacts are not hidden by
  // an older copy of the same solution stored in localStorage.
  const solution =
    savedSolutions.find(
      (savedSolution) => savedSolution.id === solutionId,
    ) ??
    getSavedSolutionById(solutionId ?? "");


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
            Back to Candidate Solutions
          </Link>
        </div>
      </section>
    );
  }

  const stakeholderImpacts =
    solution.stakeholderImpacts ?? [];

  const filterableSessions =
    solution.resultingSessions as unknown as FilterableSession[];

  const lecturers = Array.from(
    new Set(
      filterableSessions
        .map((session) => session.lecturer)
        .filter(
          (lecturer): lecturer is string => Boolean(lecturer),
        ),
    ),
  ).sort();

  const rooms = Array.from(
    new Set(
      filterableSessions
        .map((session) => session.room)
        .filter((room): room is string => Boolean(room)),
    ),
  ).sort();

  const cohortMap = new Map<string, string>();

  filterableSessions.forEach((session) => {
    const sessionCohorts =
      session.cohorts ?? session.cohortIds ?? [];

    sessionCohorts.forEach((cohort) => {
      if (typeof cohort === "string") {
        cohortMap.set(cohort, cohort);
      } else {
        cohortMap.set(cohort.id, cohort.label);
      }
    });
  });

  const cohorts = Array.from(cohortMap.entries())
    .map(([value, label]) => ({
      value,
      label,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const filterOptions =
    filterType === "lecturer"
      ? lecturers.map((lecturer) => ({
          value: lecturer,
          label: lecturer,
        }))
      : filterType === "cohort"
        ? cohorts
        : filterType === "room"
          ? rooms.map((room) => ({
              value: room,
              label: room,
            }))
          : [];

  const filteredSessions = filterableSessions.filter((session) => {
    if (filterType === "all" || !filterValue) {
      return true;
    }

    if (filterType === "lecturer") {
      return session.lecturer === filterValue;
    }

    if (filterType === "room") {
      return session.room === filterValue;
    }

    const sessionCohorts =
      session.cohorts ?? session.cohortIds ?? [];

    return sessionCohorts.some((cohort) =>
      typeof cohort === "string"
        ? cohort === filterValue
        : cohort.id === filterValue,
    );
  });

  const activeConstraints = solution.constraints.filter(
    (constraint) => constraint.state !== "Disabled",
  );

  const inactiveWelfareConstraints = solution.constraints.filter(
    (constraint) => constraint.state === "Disabled",
  );

  const activeObjectives = solution.objectives.filter(
    (objective) => objective.enabled,
  );

  const additionalChangeModules = new Set(
    solution.additionalChanges.map((change) => change.moduleCode),
  );

  const calendarEvents: EventInput[] =
    filteredSessions.map((savedSession) => {

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
          id:
            savedSession.id ??
            `${savedSession.moduleCode}-${savedSession.day}-${savedSession.startTime}-${savedSession.room}`,
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
            lecturer: savedSession.lecturer ?? "Unassigned",
            cohorts: savedSession.cohorts ?? [],
          },
        };
    });

  function renderCalendarEvent(eventInfo: EventContentArg) {
  const {
    moduleCode,
    room,
    lecturer,
    cohorts,
  } = eventInfo.event.extendedProps as {
    moduleCode: string;
    room: string;
    lecturer: string;
    cohorts: {
      id: string;
      label: string;
    }[];
  };

  const cohortText = cohorts
    .map((cohort) => cohort.label)
    .join(", ");

  return (
    <div className="saved-calendar-event-content">
      <strong>{moduleCode}</strong>

      <span className="saved-calendar-event-time">
        {eventInfo.timeText}
      </span>

      {filterType === "lecturer" && (
        <>
          <span>{room}</span>
          {cohortText && <span>{cohortText}</span>}
        </>
      )}

      {filterType === "cohort" && (
        <>
          <span>{room}</span>
          <span>{lecturer}</span>
        </>
      )}

      {filterType === "room" && (
        <>
          <span>{lecturer}</span>
          {cohortText && <span>{cohortText}</span>}
        </>
      )}
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
        All Candidate Solutions
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
          <details
            className="saved-detail-card saved-detail-collapsible"
            open
          >
            <CollapsibleHeading
              icon={<CalendarDays size={20} />}
              title="Requested change"
              description="The timetable change that produced this saved solution."
            />

            <div className="saved-detail-collapsible-content">

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
            </div>
          </details>

          {solution.additionalChanges.length > 0 && (
            <details
              className="saved-detail-card saved-detail-collapsible"
              open
            >
              <CollapsibleHeading
                icon={<SlidersHorizontal size={20} />}
                title="Additional timetable changes"
                description="Other sessions changed to make the requested move possible."
              />

              <div className="saved-detail-collapsible-content">

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
              </div>
            </details>
          )}

          {stakeholderImpacts.length > 0 && (
            <details
              className="saved-detail-card saved-detail-collapsible saved-detail-impact-section"
              open
            >
              <CollapsibleHeading
                icon={<AlertTriangle size={20} />}
                title="Stakeholder welfare impact"
                description={`${stakeholderImpacts.length} detected impact${
                  stakeholderImpacts.length === 1 ? "" : "s"
                } linked to inactive welfare constraints.`}
              />

              <div className="saved-detail-collapsible-content">
                <div className="saved-detail-impact-list">
                  {stakeholderImpacts.map((impact) => {
                    const historicalOccurrences =
                      getHistoricalOccurrenceCount(
                        impact.stakeholderId,
                        impact.impactType,
                      );

                    const historicalDecisions =
                      getHistoricalDecisionCount(
                        impact.stakeholderId,
                        impact.impactType,
                      );

                    const StakeholderIcon =
                      impact.stakeholderType === "lecturer"
                        ? UserRound
                        : GraduationCap;

                    return (
                      <article
                        key={`${impact.stakeholderId}-${impact.impactType}`}
                        className="saved-detail-impact-card"
                      >
                        <div className="saved-detail-impact-identity">
                          <span className="saved-detail-impact-avatar">
                            <StakeholderIcon
                              size={24}
                              aria-hidden="true"
                            />
                          </span>

                          <div className="saved-detail-impact-identity-copy">
                            <span className="saved-detail-impact-type">
                              {impact.stakeholderType}
                            </span>

                            <h3>{impact.stakeholderName}</h3>

                            <span className="saved-detail-impact-label">
                              {impact.title}
                            </span>
                          </div>
                        </div>

                        <div className="saved-detail-impact-current">
                          <span className="saved-detail-impact-column-title">
                            This solution affects
                          </span>

                          {renderCandidateImpactDetails(
                            impact.details,
                          )}
                        </div>

                        <div className="saved-detail-impact-history">
                          <span className="saved-detail-impact-column-title">
                            Historical context
                          </span>

                          <strong>
                            {historicalOccurrences} previous{" "}
                            {historicalOccurrences === 1
                              ? "occurrence"
                              : "occurrences"}
                          </strong>

                          <span>
                            across {historicalDecisions} accepted{" "}
                            {historicalDecisions === 1
                              ? "decision"
                              : "decisions"}
                          </span>

                          <Link
                            to={`/historical-impact?stakeholder=${encodeURIComponent(
                              impact.stakeholderId,
                            )}&impact=${encodeURIComponent(
                              impact.impactType,
                            )}`}
                          >
                            View full history
                            <ArrowRight size={16} />
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </details>
          )}

          <details
            className="saved-detail-card saved-detail-collapsible"
            open
          >
            <CollapsibleHeading
              icon={<CheckCircle2 size={20} />}
              title="Constraint settings"
              description="Active and inactive constraint settings captured when this solution was generated."
            />

            <div className="saved-detail-collapsible-content">

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
                  {solution.constraints.map(
                    (constraint, index) => (
                      <tr key={`${constraint.rule}-${index}`}>
                        <td>{constraint.group}</td>
                        <td>{constraint.rule}</td>
                        <td>
                          <span
                            className={[
                              "saved-detail-badge",
                              constraint.state === "Disabled"
                                ? "saved-detail-badge-disabled"
                                : constraint.state
                                      .toLowerCase()
                                      .includes("relaxed")
                                  ? "saved-detail-badge-warning"
                                  : "saved-detail-badge-success",
                            ].join(" ")}
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
            </div>
          </details>

          <details
            className="saved-detail-card saved-detail-collapsible"
            open
          >
            <CollapsibleHeading
              icon={<SlidersHorizontal size={20} />}
              title="Active objectives"
              description="Objective weights used to rank candidate solutions."
            />

            <div className="saved-detail-collapsible-content">

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
            </div>
          </details>

          <details
            className="saved-detail-card saved-detail-collapsible"
            open
          >
            <CollapsibleHeading
              icon={<CalendarDays size={20} />}
              title="Resulting timetable"
              description="Complete timetable snapshot produced by this saved solution."
            />

            <div className="saved-detail-collapsible-content">

            <div className="saved-detail-calendar-filters">
              <fieldset className="saved-detail-filter-type-group">
                <legend>Filter timetable by</legend>

                <div className="saved-detail-filter-radio-list">
                  {(
                    [
                      ["all", "All sessions"],
                      ["lecturer", "Lecturer"],
                      ["cohort", "Cohort"],
                      ["room", "Room"],
                    ] as const
                  ).map(([value, label]) => (
                    <label
                      key={value}
                      className={[
                        "saved-detail-filter-radio",
                        filterType === value ? "is-selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <input
                        type="radio"
                        name="timetable-filter-type"
                        value={value}
                        checked={filterType === value}
                        onChange={() => {
                          setFilterType(value);
                          setFilterValue("");
                        }}
                      />

                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {filterType !== "all" && (
                <label className="saved-detail-filter-field">
                  <span>
                    Select {filterType}
                  </span>

                  <select
                    value={filterValue}
                    onChange={(event) =>
                      setFilterValue(event.target.value)
                    }
                  >
                    <option value="">All {filterType}s</option>

                    {filterOptions.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <span className="saved-detail-filter-result-count">
                {filteredSessions.length}{" "}
                {filteredSessions.length === 1
                  ? "session"
                  : "sessions"}
              </span>
            </div>

            {filterType === "cohort" && cohorts.length === 0 && (
              <p className="saved-detail-filter-message">
                No cohort information is stored in this saved timetable.
                Add a <code>cohorts</code> or <code>cohortIds</code> array
                to each resulting session to enable cohort filtering.
              </p>
            )}

            <div className="saved-detail-calendar">
              <FullCalendar
                key={`${filterType}-${filterValue}`}
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
            </div>
          </details>
        </main>

        <aside className="saved-detail-sidebar">
          <details
            className="saved-detail-card saved-detail-collapsible saved-detail-sidebar-collapsible"
            open
          >
            <summary className="saved-detail-collapsible-summary">
              <div className="saved-detail-collapsible-summary-main">
                <div className="saved-detail-collapsible-copy">
                  <h2>Solution summary</h2>
                </div>
              </div>

              <span
                className="saved-detail-collapsible-chevron"
                aria-hidden="true"
              >
                <ChevronRight size={20} />
              </span>
            </summary>

            <div className="saved-detail-sidebar-content saved-detail-summary-card">
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

              <div className="saved-detail-summary-warning">
                <dt>Inactive welfare constraints</dt>
                <dd>{inactiveWelfareConstraints.length}</dd>
              </div>

              <div className="saved-detail-summary-danger">
                <dt>Welfare impacts</dt>
                <dd>{stakeholderImpacts.length}</dd>
              </div>

              <div>
                <dt>Active objectives</dt>
                <dd>{activeObjectives.length}</dd>
              </div>
              </dl>
            </div>
          </details>

          <details
            className="saved-detail-card saved-detail-collapsible saved-detail-sidebar-collapsible"
            open
          >
            <summary className="saved-detail-collapsible-summary">
              <div className="saved-detail-collapsible-summary-main">
                <div className="saved-detail-collapsible-copy">
                  <h2>Affected stakeholders</h2>
                </div>
              </div>

              <span
                className="saved-detail-collapsible-chevron"
                aria-hidden="true"
              >
                <ChevronRight size={20} />
              </span>
            </summary>

            <div className="saved-detail-sidebar-content">
              <div className="saved-detail-stakeholders">
              {solution.affectedStakeholders.map(
                (stakeholder) => {
                  const impactCount = stakeholderImpacts.filter(
                    (impact) => impact.stakeholderId === stakeholder.id,
                  ).length;

                  return (
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

                    <span className="saved-detail-stakeholder-action">
                      {impactCount > 0 && (
                        <span className="saved-detail-stakeholder-impact-count">
                          {impactCount} impact{impactCount === 1 ? "" : "s"}
                        </span>
                      )}
                      <ArrowRight size={17} />
                    </span>
                  </Link>
                  );
                },
              )}
              </div>
            </div>
          </details>
        </aside>
      </div>
    </section>
  );
}