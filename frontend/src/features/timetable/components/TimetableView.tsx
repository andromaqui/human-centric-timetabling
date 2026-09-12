import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  EventContentArg,
  EventInput,
} from "@fullcalendar/core";

import {
  getLecturerUnavailability,
  type ApiLecturerUnavailability,
} from "../../../shared/api/timetableApi";

import "./TimetableCalendar.css";

export type TimetableFilterType =
  | "all"
  | "lecturer"
  | "cohort"
  | "program"
  | "room";

export type TimetableInitialFilter = {
  type: TimetableFilterType;
  value: string;
};

type TimetableViewProps = {
  events: EventInput[];

  showHeader?: boolean;
  eyebrow?: string;
  title?: string;

  showLegend?: boolean;
  showFilters?: boolean;
  showWeekHeading?: boolean;
  showLecturerAvailability?: boolean;

  initialFilter?: TimetableInitialFilter;

  /**
   * Historical/saved timetable mode. The event popover still works,
   * but the Reschedule button is removed.
   */
  readOnly?: boolean;

  /**
   * Removes the page-level max-width/padding so the timetable can sit
   * naturally inside another card, e.g. SavedSolutionDetailPage.
   */
  embedded?: boolean;

  requestedSessionId?: string | null;
  requestedModuleCode?: string | null;
  additionalChangeSessionIds?: Iterable<string>;
  additionalChangeModuleCodes?: Iterable<string>;

  showSolutionLegend?: boolean;

  /**
   * When true, additional changed sessions use the same green highlight as
   * the requested session. Used by InteractiveRepair only.
   */
  highlightAdditionalChangesAsRequested?: boolean;

  /**
   * Interactive-repair-only highlighting.
   *
   * If the active repair move introduced a new conflict, the moved class can be
   * highlighted red on the timetable. Dead-end moves use a stronger red state.
   */
  repairProblemSessionId?: string | null;
  repairProblemSeverity?: "conflict" | "dead-end" | null;

  /**
   * Interactive-repair current-state highlighting.
   * Every session in this set is involved in at least one unresolved conflict.
   */
  repairProblemSessionIds?: Iterable<string>;

  /**
   * Optional stronger red highlight for the move that produced a dead end.
   */
  repairDeadEndSessionId?: string | null;
};

const REFERENCE_WEEK: Record<string, string> = {
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

function EventCard({
  eventInfo,
  readOnly,
  solutionKind,
  highlightAdditionalAsRequested,
  repairProblemSessionId,
  repairProblemSeverity,
  repairProblemSessionIds,
  repairDeadEndSessionId,
}: {
  eventInfo: EventContentArg;
  readOnly: boolean;
  solutionKind: "requested" | "additional" | "unchanged";
  highlightAdditionalAsRequested: boolean;
  repairProblemSessionId?: string | null;
  repairProblemSeverity?: "conflict" | "dead-end" | null;
  repairProblemSessionIds?: Set<string>;
  repairDeadEndSessionId?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const props = eventInfo.event.extendedProps as {
    session?: {
      id?: string;
      room?: string;
    };
    lecturer?: {
      id?: string;
      name?: string;
    };
    cohorts?: {
      id: string;
      name: string;
    }[];
  };

  const session = props.session;

  const eventSessionId =
    session?.id ?? eventInfo.event.id;

  const isRepairProblemSession =
    (
      !!repairProblemSessionId &&
      eventSessionId === repairProblemSessionId
    ) ||
    (
      repairProblemSessionIds?.has(
        eventSessionId,
      ) ??
      false
    );

  const isRepairDeadEndSession =
    (
      !!repairDeadEndSessionId &&
      eventSessionId === repairDeadEndSessionId
    ) ||
    (
      !!repairProblemSessionId &&
      repairProblemSeverity === "dead-end" &&
      eventSessionId === repairProblemSessionId
    );

  const lecturer = props.lecturer;
  const cohorts = props.cohorts ?? [];

  const cohortNames =
    cohorts.map((cohort) => cohort.name).join(", ") || "Unassigned";

  function handleReschedule(event: React.MouseEvent) {
    event.stopPropagation();

    if (!session?.id) return;

    window.open(
      `/sessions/${session.id}/reschedule`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function openPopover() {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();

    const POPOVER_WIDTH = 270;
    const POPOVER_HEIGHT = readOnly ? 180 : 230;
    const GAP = 6;
    const SCREEN_PADDING = 12;

    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldOpenAbove =
      spaceBelow < POPOVER_HEIGHT + GAP;

    let top = shouldOpenAbove
      ? rect.top - POPOVER_HEIGHT - GAP
      : rect.bottom + GAP;

    let left = rect.left;

    if (top < SCREEN_PADDING) {
      top = SCREEN_PADDING;
    }

    if (
      left + POPOVER_WIDTH >
      window.innerWidth - SCREEN_PADDING
    ) {
      left =
        window.innerWidth -
        POPOVER_WIDTH -
        SCREEN_PADDING;
    }

    if (left < SCREEN_PADDING) {
      left = SCREEN_PADDING;
    }

    setPopoverPos({ top, left });
    setIsOpen(true);
  }

  function closePopover() {
    setIsOpen(false);
    setPopoverPos(null);
  }

  function handleCardClick(event: React.MouseEvent) {
    event.stopPropagation();

    if (isOpen) {
      closePopover();
    } else {
      openPopover();
    }
  }

  useEffect(() => {
    if (!isOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;

      if (
        containerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }

      closePopover();
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={[
        "timetable-event",
        isOpen ? "is-open" : "",

        isRepairDeadEndSession
          ? "timetable-event-repair-dead-end"

          : isRepairProblemSession
            ? "timetable-event-repair-conflict"

            : solutionKind === "requested" ||
                (solutionKind === "additional" &&
                  highlightAdditionalAsRequested)
              ? "timetable-event-requested"

              : solutionKind === "additional"
                ? "timetable-event-additional"
                : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
    >
      <div className="event-time">
        {eventInfo.timeText}
      </div>

      <div className="event-title">
        {eventInfo.event.title}
      </div>

      {isOpen &&
        popoverPos &&
        createPortal(
          <div
            ref={popoverRef}
            className="event-popover"
            style={{
              top: popoverPos.top,
              left: popoverPos.left,
            }}
          >
            <div className="event-time">
              {eventInfo.timeText}
            </div>

            <div className="event-title">
              {eventInfo.event.title}
            </div>

            <div className="event-tags">
              <div className="tag-row tag-lecturer">
                <span className="tag-dot" />
                {lecturer?.name ?? "Unassigned"}
              </div>

              <div className="tag-row tag-room">
                <span className="tag-dot" />
                {session?.room ?? "TBC"}
              </div>

              <div className="tag-row tag-cohort">
                <span className="tag-dot" />
                {cohortNames}
              </div>
            </div>

            {!readOnly && session?.id && (
              <div className="popover-actions">
                <button
                  type="button"
                  className="popover-reschedule-button"
                  onClick={handleReschedule}
                >
                  Reschedule
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

function stringSet(values?: Iterable<string>) {
  return new Set(values ? Array.from(values) : []);
}

export function TimetableView({
  events,
  showHeader = false,
  eyebrow = "Timetable",
  title = "University Timetable",
  showLegend = false,
  showFilters = true,
  showWeekHeading = true,
  showLecturerAvailability = true,
  initialFilter,
  readOnly = false,
  embedded = false,
  requestedSessionId = null,
  requestedModuleCode = null,
  additionalChangeSessionIds,
  additionalChangeModuleCodes,
  showSolutionLegend = false,
  highlightAdditionalChangesAsRequested = false,
  repairProblemSessionId = null,
  repairProblemSeverity = null,
  repairProblemSessionIds,
  repairDeadEndSessionId = null,
}: TimetableViewProps) {
  const repairProblemSessionIdSet =
    stringSet(
      repairProblemSessionIds,
    );

  const [filterType, setFilterType] =
    useState<TimetableFilterType>(
      initialFilter?.type ?? "all",
    );

  const [filterValue, setFilterValue] =
    useState(initialFilter?.value ?? "");

  const [
    lecturerUnavailability,
    setLecturerUnavailability,
  ] = useState<ApiLecturerUnavailability[]>([]);

  const [
    unavailabilityLoading,
    setUnavailabilityLoading,
  ] = useState(false);

  const [
    unavailabilityError,
    setUnavailabilityError,
  ] = useState<string | null>(null);

  useEffect(() => {
    if (!initialFilter) return;

    setFilterType(initialFilter.type);
    setFilterValue(initialFilter.value);
  }, [initialFilter?.type, initialFilter?.value]);

  useEffect(() => {
    let cancelled = false;

    if (
      !showLecturerAvailability ||
      filterType !== "lecturer" ||
      !filterValue
    ) {
      setLecturerUnavailability([]);
      setUnavailabilityError(null);
      setUnavailabilityLoading(false);
      return;
    }

    setUnavailabilityLoading(true);
    setUnavailabilityError(null);

    getLecturerUnavailability(filterValue)
      .then((rows) => {
        if (cancelled) return;
        setLecturerUnavailability(rows);
      })
      .catch((error) => {
        if (cancelled) return;

        console.error(
          "Failed to load lecturer unavailability:",
          error,
        );

        setLecturerUnavailability([]);
        setUnavailabilityError(
          error instanceof Error
            ? error.message
            : "Failed to load unavailable times",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setUnavailabilityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    filterType,
    filterValue,
    showLecturerAvailability,
  ]);

  const lecturerMap = new Map<string, string>();
  const cohortMap = new Map<string, string>();
  const programMap = new Map<string, string>();
  const roomSet = new Set<string>();

  events.forEach((event) => {
    const props = event.extendedProps as
      | {
          session?: {
            room?: string;
          };
          lecturer?: {
            id?: string;
            name?: string;
          };
          cohorts?: {
            id: string;
            name: string;
          }[];
          programs?: {
            id: string;
            name: string;
          }[];
        }
      | undefined;

    if (props?.lecturer?.id) {
      lecturerMap.set(
        props.lecturer.id,
        props.lecturer.name ?? props.lecturer.id,
      );
    }

    props?.cohorts?.forEach((cohort) => {
      cohortMap.set(cohort.id, cohort.name);
    });

    props?.programs?.forEach((program) => {
      programMap.set(program.id, program.name);
    });

    if (props?.session?.room) {
      roomSet.add(props.session.room);
    }
  });

  const lecturers = Array.from(lecturerMap.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const cohorts = Array.from(cohortMap.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const programs = Array.from(programMap.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const rooms = Array.from(roomSet)
    .map((room) => ({
      value: room,
      label: room,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const filterOptions =
    filterType === "lecturer"
      ? lecturers
      : filterType === "cohort"
        ? cohorts
        : filterType === "program"
          ? programs
          : filterType === "room"
            ? rooms
            : [];

  const filteredEvents = events.filter((event) => {
    if (
      filterType === "all" ||
      !filterValue
    ) {
      return true;
    }

    const props = event.extendedProps as
      | {
          session?: {
            room?: string;
          };
          lecturer?: {
            id?: string;
            name?: string;
          };
          cohorts?: {
            id: string;
            name: string;
          }[];
          programs?: {
            id: string;
            name: string;
          }[];
        }
      | undefined;

    if (filterType === "lecturer") {
      return props?.lecturer?.id === filterValue;
    }

    if (filterType === "room") {
      return props?.session?.room === filterValue;
    }

    if (filterType === "cohort") {
      return (
        props?.cohorts?.some(
          (cohort) => cohort.id === filterValue,
        ) ?? false
      );
    }

    if (filterType === "program") {
      return (
        props?.programs?.some(
          (program) => program.id === filterValue,
        ) ?? false
      );
    }

    return true;
  });

  const unavailableEvents: EventInput[] =
    showLecturerAvailability &&
    filterType === "lecturer" &&
    filterValue
      ? lecturerUnavailability
          .map((slot) => {
            const date =
              REFERENCE_WEEK[
                slot.day.trim().toLowerCase()
              ];

            if (!date) return null;

            const startHour = String(slot.hour).padStart(
              2,
              "0",
            );
            const endHour = String(slot.hour + 1).padStart(
              2,
              "0",
            );

            return {
              id: `lecturer-unavailable-${slot.id}`,
              start: `${date}T${startHour}:00:00`,
              end: `${date}T${endHour}:00:00`,
              display: "background",
              classNames: [
                "lecturer-unavailable-slot",
              ],
              extendedProps: {
                isLecturerUnavailable: true,
              },
            } satisfies EventInput;
          })
          .filter(
            (event): event is EventInput =>
              event !== null,
          )
      : [];

  const additionalIds = stringSet(
    additionalChangeSessionIds,
  );
  const additionalModules = stringSet(
    additionalChangeModuleCodes,
  );

  function getSolutionKind(eventInfo: EventContentArg) {
    const props = eventInfo.event.extendedProps as {
      session?: {
        id?: string;
      };
      moduleCode?: string;
    };

    const sessionId =
      props.session?.id ?? eventInfo.event.id;
    const moduleCode =
      props.moduleCode ?? eventInfo.event.title;

    if (
      (requestedSessionId &&
        sessionId === requestedSessionId) ||
      (!requestedSessionId &&
        requestedModuleCode &&
        moduleCode === requestedModuleCode)
    ) {
      return "requested" as const;
    }

    if (
      additionalIds.has(sessionId) ||
      additionalModules.has(moduleCode)
    ) {
      return "additional" as const;
    }

    return "unchanged" as const;
  }

  const selectedLecturer =
    filterType === "lecturer" && filterValue
      ? lecturerMap.get(filterValue)
      : undefined;

  const calendarEvents: EventInput[] = [
    ...filteredEvents,
    ...unavailableEvents,
  ];

  function renderEventContent(
    eventInfo: EventContentArg,
  ) {
    if (
      eventInfo.event.extendedProps
        ?.isLecturerUnavailable
    ) {
      return null;
    }

    return (
      <EventCard
        eventInfo={eventInfo}
        readOnly={readOnly}
        solutionKind={getSolutionKind(eventInfo)}
        highlightAdditionalAsRequested={
          highlightAdditionalChangesAsRequested
        }
        repairProblemSessionId={
          repairProblemSessionId
        }
        repairProblemSeverity={
          repairProblemSeverity
        }
        repairProblemSessionIds={
          repairProblemSessionIdSet
        }
        repairDeadEndSessionId={
          repairDeadEndSessionId
        }
      />
    );
  }

  return (
    <section
      className={[
        "timetable-shell",
        embedded ? "timetable-shell-embedded" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showHeader && (
        <div className="timetable-header">
          <p className="timetable-eyebrow">
            {eyebrow}
          </p>

          <h1 className="timetable-title">
            {title}
          </h1>
        </div>
      )}

      {showLegend && (
        <div className="timetable-legend">
          <span className="legend-item tag-lecturer">
            <span className="tag-dot" />
            Lecturer
          </span>

          <span className="legend-item tag-room">
            <span className="tag-dot" />
            Room
          </span>

          <span className="legend-item tag-cohort">
            <span className="tag-dot" />
            Cohort
          </span>

          {showLecturerAvailability &&
            filterType === "lecturer" &&
            filterValue && (
              <span className="legend-item unavailable-legend-item">
                <span className="unavailable-legend-box" />
                Lecturer unavailable
              </span>
            )}
        </div>
      )}

      {showFilters && (
        <div className="timetable-calendar-filters">
          <div className="timetable-filter-heading">
            <span>Filter timetable by</span>

            <span className="timetable-filter-result-count">
              {filteredEvents.length}{" "}
              {filteredEvents.length === 1
                ? "session"
                : "sessions"}
            </span>
          </div>

          <div className="timetable-filter-controls">
            <div className="timetable-filter-radio-list">
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
                    "timetable-filter-radio",
                    filterType === value
                      ? "is-selected"
                      : "",
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

            {filterType !== "all" && (
              <label className="timetable-filter-field">
                <span>Select {filterType}</span>

                <select
                  value={filterValue}
                  onChange={(event) =>
                    setFilterValue(event.target.value)
                  }
                >
                  <option value="">
                    All {filterType}s
                  </option>

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
          </div>

          {showLecturerAvailability &&
            filterType === "lecturer" &&
            filterValue && (
              <div className="lecturer-availability-status">
                {unavailabilityLoading ? (
                  <span>
                    Loading availability…
                  </span>
                ) : unavailabilityError ? (
                  <span className="lecturer-availability-error">
                    Could not load unavailable times.
                  </span>
                ) : (
                  <span>
                    Red areas show when{" "}
                    <strong>
                      {selectedLecturer ??
                        "this lecturer"}
                    </strong>{" "}
                    is unavailable.
                  </span>
                )}
              </div>
            )}
        </div>
      )}

      {showWeekHeading && (
        <div className="timetable-week-heading">
          Week of 21 September 2026
        </div>
      )}

      <div className="timetable-calendar">
        <FullCalendar
          key={`${filterType}-${filterValue}`}
          plugins={[
            timeGridPlugin,
            interactionPlugin,
          ]}
          initialView="timeGridWeek"
          initialDate="2026-09-21"
          weekends={false}
          allDaySlot={false}
          slotMinTime="09:00:00"
          slotMaxTime="17:00:00"
          slotDuration="00:30:00"
          height="auto"
          editable={false}
          selectable={false}
          events={calendarEvents}
          eventContent={renderEventContent}
          headerToolbar={{
            left: "",
            center: "",
            right: "",
          }}
        />
      </div>

      {showSolutionLegend && (
        <div className="timetable-solution-legend">
          <span>
            <i className="timetable-solution-key requested" />
            Requested move
          </span>

          <span>
            <i className="timetable-solution-key additional" />
            Additional change
          </span>

          <span>
            <i className="timetable-solution-key unchanged" />
            Unchanged session
          </span>
        </div>
      )}
    </section>
  );
}
