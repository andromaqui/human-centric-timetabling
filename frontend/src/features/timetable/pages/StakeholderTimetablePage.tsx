import { Link, useSearchParams } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";

import { useTimetableData } from "../hooks/useTimetableData";
import { lecturerUnavailableSlots } from "../data/timetableData";
import { mapSessionsToCalendarEvents } from "../utils/calendarMappers";
import type { Session } from "../types";

import "../components/TimetableCalendar.css";

type StakeholderKind = "lecturer" | "cohort" | "program" | "room";

function getFilteredSessions(
  sessions: Session[],
  kind: StakeholderKind | null,
  value: string | null,
) {
  if (!kind || !value) return sessions;

  return sessions.filter((session) => {
    if (kind === "lecturer") {
      return session.lecturerId === value;
    }

    if (kind === "cohort") {
      return session.cohortIds.includes(value);
    }

    if (kind === "program") {
      return session.programIds.includes(value);
    }

    if (kind === "room") {
      return session.room === value;
    }

    return false;
  });
}

const dayToDate: Record<string, string> = {
  mon: "2026-09-21",
  tue: "2026-09-22",
  wed: "2026-09-23",
  thu: "2026-09-24",
  fri: "2026-09-25",
};

type BackgroundEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  display: string;
  backgroundColor: string;
};

function buildUnavailableEvents(slotIds: string[]): BackgroundEvent[] {
  const hoursByDay: Record<string, number[]> = {};

  slotIds.forEach((slotId) => {
    const [day, hourString] = slotId.split("-");
    const hour = parseInt(hourString, 10);

    if (!hoursByDay[day]) {
      hoursByDay[day] = [];
    }

    hoursByDay[day].push(hour);
  });

  const events: BackgroundEvent[] = [];

  Object.entries(hoursByDay).forEach(([day, hours]) => {
    const date = dayToDate[day];

    if (!date || hours.length === 0) {
      return;
    }

    const sortedHours = [...hours].sort((a, b) => a - b);

    let blockStart = sortedHours[0];
    let previousHour = sortedHours[0];

    for (let index = 1; index <= sortedHours.length; index++) {
      const currentHour = sortedHours[index];
      const isConsecutive = currentHour === previousHour + 1;

      if (!isConsecutive) {
        events.push({
          id: `unavailable-${day}-${blockStart}`,
          title: "Unavailable",
          start: `${date}T${String(blockStart).padStart(2, "0")}:00:00`,
          end: `${date}T${String(previousHour + 1).padStart(2, "0")}:00:00`,
          display: "background",
          backgroundColor: "#dc2626",
        });

        blockStart = currentHour;
      }

      previousHour = currentHour;
    }
  });

  return events;
}

export function StakeholderTimetablePage() {
  const [searchParams] = useSearchParams();
  const { data, loading, error } = useTimetableData();

  const kind: StakeholderKind | null =
    (searchParams.get("type") as StakeholderKind | null) ??
    (searchParams.get("lecturer")
      ? "lecturer"
      : searchParams.get("cohort")
        ? "cohort"
        : searchParams.get("program")
          ? "program"
          : searchParams.get("room")
            ? "room"
            : null);

  const value =
    searchParams.get("value") ??
    searchParams.get("lecturer") ??
    searchParams.get("cohort") ??
    searchParams.get("program") ??
    searchParams.get("room");

  if (loading) {
    return (
      <section className="timetable-shell">
        <p>Loading timetable…</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="timetable-shell">
        <Link to={-1 as unknown as string} className="back-link">
          ← Back
        </Link>

        <p>Could not load timetable.</p>
      </section>
    );
  }

  const filteredSessions = getFilteredSessions(
    data.sessions,
    kind,
    value,
  );

  const selectedLecturer =
    kind === "lecturer"
      ? data.lecturers.find((lecturer) => lecturer.id === value)
      : undefined;

  const selectedCohort =
    kind === "cohort"
      ? data.cohorts.find((cohort) => cohort.id === value)
      : undefined;

  const selectedProgram =
    kind === "program"
      ? data.programs.find((program) => program.id === value)
      : undefined;

  const title =
    kind === "lecturer"
      ? selectedLecturer?.name ?? "Lecturer timetable"
      : kind === "cohort"
        ? selectedCohort?.name ?? "Cohort timetable"
        : kind === "program"
          ? selectedProgram?.name ?? "Program timetable"
          : kind === "room"
            ? value ?? "Room timetable"
            : "Timetable";

  const events = mapSessionsToCalendarEvents(
    filteredSessions,
    data.modules,
    data.lecturers,
    data.programs,
    data.cohorts,
  );

  /*
   * Only lecturer timetables show unavailable periods.
   */
  const unavailableEvents =
    kind === "lecturer" && selectedLecturer
      ? buildUnavailableEvents(
          lecturerUnavailableSlots(selectedLecturer),
        )
      : [];

  const calendarEvents = [
    ...events,
    ...unavailableEvents,
  ];

  return (
    <section className="timetable-shell">
      <Link to={-1 as unknown as string} className="back-link">
        ← Back
      </Link>

      <h1 className="timetable-title">{title}</h1>

      <p className="step-description">
        {kind === "lecturer" && selectedLecturer
          ? `Showing bookings for ${selectedLecturer.name} only.`
          : kind === "cohort" && selectedCohort
            ? `Showing bookings for ${selectedCohort.name} only.`
            : kind === "program" && selectedProgram
              ? `Showing bookings for the ${selectedProgram.name} program only.`
              : kind === "room" && value
                ? `Showing bookings for ${value} only.`
                : "Read-only timetable preview."}
      </p>

      {filteredSessions.length === 0 && (
        <p className="step-description">
          No bookings found for this stakeholder.
        </p>
      )}

      <div className="timetable-calendar">
        <FullCalendar
          plugins={[timeGridPlugin]}
          initialView="timeGridWeek"
          initialDate="2026-09-21"
          weekends={false}
          allDaySlot={false}
          slotMinTime="08:00:00"
          slotMaxTime="20:00:00"
          height="auto"
          events={calendarEvents}
          eventContent={(eventInfo) => {
            const session = eventInfo.event.extendedProps
              .session as Session | undefined;

            if (!session) {
              return null;
            }

            return (
              <div className="timetable-event">
                <div className="event-time">
                  {eventInfo.timeText}
                </div>

                <div className="event-title">
                  {eventInfo.event.title}
                </div>

                <div className="event-title">
                  ROOM: {session.room ?? "TBC"}
                </div>
              </div>
            );
          }}
        />
      </div>
    </section>
  );
}