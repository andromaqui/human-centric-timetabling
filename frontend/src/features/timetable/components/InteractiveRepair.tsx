import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useTimetableData } from "../hooks/useTimetableData";
import { mapSessionsToCalendarEvents } from "../utils/calendarMappers";

import { TimetableView } from "../components/TimetableView";

import type {
  Session,
} from "../types";

import "./components/TimetableCalendar.css";
import "./InteractiveRepairPage.css";

export function InteractiveRepair({
  sessions,
  modules,
  lecturers,
  programs,
  cohorts,
  requestedSessionId,
  shuffleCredit,
}: InteractiveRepairProps) {
  const events = mapSessionsToCalendarEvents(
    sessions,
    modules,
    lecturers,
    programs,
    cohorts,
  );

  return (
    <div className="interactive-repair">
      <div className="interactive-repair-header">
        <div>
          <h2>Interactive repair</h2>
          <p>
            Resolve the remaining conflicts one decision at a time.
          </p>
        </div>

        <div className="interactive-repair-credit">
          <span>Shuffle credit</span>
          <strong>{shuffleCredit}</strong>
        </div>
      </div>

      <div className="interactive-repair-timetable">
        <TimetableView
          events={events}
          showFilters={false}
          showHeader={false}
          showLegend={false}
          showWeekHeading
          embedded
          requestedSessionId={requestedSessionId}
        />
      </div>
    </div>
  );
}