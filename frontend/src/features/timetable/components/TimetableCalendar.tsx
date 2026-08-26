import { useTimetableData } from "../hooks/useTimetableData";
import { mapSessionsToCalendarEvents } from "../utils/calendarMappers";
import { TimetableView } from "./TimetableView";

import "./TimetableCalendar.css";

export function TimetableCalendar() {
  const { data, error } = useTimetableData();

  if (error) {
    return (
      <section className="timetable-shell">
        <div className="timetable-header">
          <p className="timetable-eyebrow">
            Timetable
          </p>

          <h1 className="timetable-title">
            University Timetable
          </h1>
        </div>

        <p className="timetable-error">
          Failed to load timetable: {error.message}
        </p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="timetable-shell">
        <div className="timetable-header">
          <p className="timetable-eyebrow">
            Timetable
          </p>

          <h1 className="timetable-title">
            University Timetable
          </h1>
        </div>

        <p className="timetable-loading">
          Loading timetable…
        </p>
      </section>
    );
  }

  const events = mapSessionsToCalendarEvents(
    data.sessions,
    data.modules,
    data.lecturers,
    data.programs,
    data.cohorts,
  );

  return (
    <TimetableView
      events={events}
      showHeader
      eyebrow="Timetable"
      title="University Timetable"
      showLegend
      showFilters
      showWeekHeading
      showLecturerAvailability
    />
  );
}