import { Link, useSearchParams } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { timetableData, lecturerUnavailableSlots } from "../data/timetableData";
import { mapSessionsToCalendarEvents } from "../utils/calendarMappers";
import type { Session } from "../types";
import "../components/TimetableCalendar.css";


type StakeholderKind = "lecturer" | "cohort" | "program" | "room";

function getFilteredSessions(kind: StakeholderKind | null, value: string | null) {
  if (!kind || !value) return timetableData.sessions;

  return timetableData.sessions.filter((session) => {
    if (kind === "lecturer") return session.lecturerId === value;
    if (kind === "cohort") return session.cohortIds.includes(value);
    if (kind === "program") return session.programIds.includes(value);
    if (kind === "room") return session.room === value;
    return true;
  });
}

function getTitle(kind: StakeholderKind | null, value: string | null) {
  if (!kind || !value) return "Timetable";

  if (kind === "lecturer") {
    const lecturer = timetableData.lecturers.find((item) => item.id === value);
    return lecturer?.name ?? "Lecturer timetable";
  }

  if (kind === "cohort") {
    const cohort = timetableData.cohorts.find((item) => item.id === value);
    return cohort?.name ?? "Cohort timetable";
  }

  if (kind === "program") {
    const program = timetableData.programs.find((item) => item.id === value);
    return program?.name ?? "Program timetable";
  }

  return value;
}

// Maps the short day codes used in slot ids (e.g. "tue") to the actual
// calendar date shown for that day in the current displayed week.
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

// Turns a flat list of slot ids like ["tue-09", "tue-10", "fri-09", ...]
// into merged FullCalendar background events, e.g. one block for
// Tuesday 09:00-18:00 and one block for Friday 09:00-14:00, instead of
// a separate one-hour event per slot.
// TODO:: this is terrible code
function buildUnavailableEvents(slotIds: string[]): BackgroundEvent[] {
  const hoursByDay: Record<string, number[]> = {};

  slotIds.forEach((slotId) => {
    const [day, hourStr] = slotId.split("-");
    const hour = parseInt(hourStr, 10);
    if (!hoursByDay[day]) hoursByDay[day] = [];
    hoursByDay[day].push(hour);
  });

  const events: BackgroundEvent[] = [];

  Object.entries(hoursByDay).forEach(([day, hours]) => {
    const date = dayToDate[day];
    if (!date) return;

    const sortedHours = [...hours].sort((a, b) => a - b);

    let blockStart = sortedHours[0];
    let prevHour = sortedHours[0];

    for (let i = 1; i <= sortedHours.length; i++) {
      const currentHour = sortedHours[i];
      const isConsecutive = currentHour === prevHour + 1;

      if (!isConsecutive) {
        events.push({
          id: `unavailable-${day}-${blockStart}`,
          title: "Unavailable",
          start: `${date}T${String(blockStart).padStart(2, "0")}:00:00`,
          end: `${date}T${String(prevHour + 1).padStart(2, "0")}:00:00`,
          display: "background",
          backgroundColor: "#dc2626",
        });
        blockStart = currentHour;
      }

      prevHour = currentHour;
    }
  });

  return events;
}

export function StakeholderTimetablePage() {
  const [searchParams] = useSearchParams();

  const kind =
    (searchParams.get("type") as StakeholderKind | null) ??
    (searchParams.get("lecturer") ? "lecturer" : null) ??
    (searchParams.get("cohort") ? "cohort" : null) ??
    (searchParams.get("program") ? "program" : null) ??
    (searchParams.get("room") ? "room" : null);

  const value =
    searchParams.get("value") ??
    searchParams.get("lecturer") ??
    searchParams.get("cohort") ??
    searchParams.get("program") ??
    searchParams.get("room");

  const filteredSessions = getFilteredSessions(kind, value);

  const events = mapSessionsToCalendarEvents(
    filteredSessions,
    timetableData.modules,
    timetableData.lecturers,
    timetableData.programs,
    timetableData.cohorts
  );

  const selectedLecturer =
    kind === "lecturer"
      ? timetableData.lecturers.find((l) => l.id === value)
      : undefined;

  const unavailableSlotIds = lecturerUnavailableSlots(selectedLecturer);
  const unavailableEvents = buildUnavailableEvents(unavailableSlotIds);

  const calendarEvents = [...events, ...unavailableEvents];

  return (
    <section className="timetable-shell">
      <Link to={-1 as unknown as string} className="back-link">
        ← Back
      </Link>

      <h1 className="timetable-title">{getTitle(kind, value)}</h1>

      <p className="step-description">
        Read-only timetable preview. Reschedule actions are disabled here.
      </p>

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
            const session = eventInfo.event.extendedProps.session;

            if (!session) {
              return null; // background event
            }

            return (
              <div className="timetable-event">
                <div className="event-time">{eventInfo.timeText}</div>
                <div className="event-title">{eventInfo.event.title}</div>
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
