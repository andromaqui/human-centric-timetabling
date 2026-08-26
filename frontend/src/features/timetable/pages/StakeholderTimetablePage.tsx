import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTimetableData } from "../hooks/useTimetableData";
import { mapSessionsToCalendarEvents } from "../utils/calendarMappers";
import type { Session } from "../types";
import {
  TimetableView,
  type TimetableInitialFilter,
} from "../components/TimetableView";

import "../components/TimetableCalendar.css";

type StakeholderKind =
  | "lecturer"
  | "cohort"
  | "program"
  | "room";

type SavedSolutionChange = {
  session_id?: string;
  sessionId?: string;
  module_code?: string;
};

type SavedSolutionHighlight = {
  moduleCode?: string;
  moduleTitle?: string;

  requestedSessionId?: string;
  requested_session_id?: string;

  result?: {
    day?: string;
    time?: string;
    room?: string;
    lecturer?: string;
  };

  additionalChanges?: SavedSolutionChange[];

  resultingSessions?: Session[];
};

function normalizeDayFromIso(value?: string) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date
    .toLocaleDateString("en-US", {
      weekday: "short",
    })
    .slice(0, 3)
    .toLowerCase();
}

function normalizeTimeFromIso(value?: string) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${String(date.getHours()).padStart(
    2,
    "0",
  )}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function normalizeTimeFromText(value?: string) {
  if (!value) return null;

  const match = value.match(/\d{1,2}:\d{2}/);

  if (!match) {
    return null;
  }

  const [hour, minute] = match[0].split(":");

  return `${hour.padStart(2, "0")}:${minute}`;
}

export function StakeholderTimetablePage() {
  const [searchParams] = useSearchParams();
  const { data, loading, error } = useTimetableData();

  const [savedSolution, setSavedSolution] =
    useState<SavedSolutionHighlight | null>(null);

  const [solutionLoading, setSolutionLoading] =
    useState(false);

  const solutionId = searchParams.get("solution");

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

  useEffect(() => {
    let cancelled = false;

    if (!solutionId) {
      setSavedSolution(null);
      setSolutionLoading(false);
      return;
    }

    setSolutionLoading(true);

    fetch(
      `http://localhost:8000/candidate-solutions/${encodeURIComponent(
        solutionId,
      )}`,
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to load saved solution (${response.status}).`,
          );
        }

        return response.json();
      })
      .then((solution: SavedSolutionHighlight) => {
        if (!cancelled) {
          setSavedSolution(solution);
        }
      })
      .catch((requestError) => {
        if (cancelled) return;

        console.error(
          "Could not load saved solution for timetable preview:",
          requestError,
        );

        setSavedSolution(null);
      })
      .finally(() => {
        if (!cancelled) {
          setSolutionLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [solutionId]);

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
        <Link
          to={-1 as unknown as string}
          className="back-link"
        >
          ← Back
        </Link>

        <p>Could not load timetable.</p>
      </section>
    );
  }

  const selectedLecturer =
    kind === "lecturer"
      ? data.lecturers.find(
          (lecturer) => lecturer.id === value,
        )
      : undefined;

  const selectedCohort =
    kind === "cohort"
      ? data.cohorts.find(
          (cohort) => cohort.id === value,
        )
      : undefined;

  const selectedProgram =
    kind === "program"
      ? data.programs.find(
          (program) => program.id === value,
        )
      : undefined;

  const title =
    kind === "lecturer"
      ? selectedLecturer?.name ??
        "Lecturer timetable"
      : kind === "cohort"
        ? selectedCohort?.name ??
          "Cohort timetable"
        : kind === "program"
          ? selectedProgram?.name ??
            "Program timetable"
          : kind === "room"
            ? value ?? "Room timetable"
            : "Timetable";

  const initialFilter: TimetableInitialFilter | undefined =
    kind && value
      ? {
          type: kind,
          value,
        }
      : undefined;

  const sessionsToDisplay =
    savedSolution?.resultingSessions ??
    data.sessions;

  const events = mapSessionsToCalendarEvents(
    sessionsToDisplay,
    data.modules,
    data.lecturers,
    data.programs,
    data.cohorts,
  );

  /*
   * Prefer an explicit requested-session ID if the
   * candidate solution has one.
   */
  let requestedSessionId =
    savedSolution?.requestedSessionId ??
    savedSolution?.requested_session_id ??
    null;

  /*
   * Otherwise identify the requested session from:
   *
   * - the requested module
   * - the saved result day
   * - the saved result start time
   *
   * This makes the stakeholder timetable highlight
   * the same session as the saved-solution detail page.
   */
  if (
    !requestedSessionId &&
    savedSolution?.moduleCode &&
    savedSolution?.result &&
    savedSolution.resultingSessions
  ) {
    const requestedModule = data.modules.find(
      (module) =>
        module.code === savedSolution.moduleCode,
    );

    const requestedDay =
      savedSolution.result.day
        ?.trim()
        .slice(0, 3)
        .toLowerCase() ?? null;

    const requestedTime = normalizeTimeFromText(
      savedSolution.result.time,
    );

    const requestedSession =
      savedSolution.resultingSessions.find(
        (session) => {
          if (
            requestedModule &&
            session.moduleId !== requestedModule.id
          ) {
            return false;
          }

          const sessionDay =
            normalizeDayFromIso(session.start);

          const sessionTime =
            normalizeTimeFromIso(session.start);

          return (
            sessionDay === requestedDay &&
            sessionTime === requestedTime
          );
        },
      );

    requestedSessionId =
      requestedSession?.id ?? null;
  }

  const additionalChangeSessionIds = new Set(
    (savedSolution?.additionalChanges ?? [])
      .map(
        (change) =>
          change.session_id ??
          change.sessionId,
      )
      .filter(
        (sessionId): sessionId is string =>
          Boolean(sessionId),
      ),
  );

  const additionalChangeModuleCodes = new Set(
    (savedSolution?.additionalChanges ?? [])
      .map((change) => change.module_code)
      .filter(
        (moduleCode): moduleCode is string =>
          Boolean(moduleCode),
      ),
  );

  return (
    <section className="timetable-shell">
      <Link
        to={-1 as unknown as string}
        className="back-link"
      >
        ← Back
      </Link>

      <h1 className="timetable-title">
        {title}
      </h1>

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

      {solutionId && solutionLoading && (
        <p className="step-description">
          Loading saved-solution timetable…
        </p>
      )}

      <TimetableView
        events={events}
        initialFilter={initialFilter}
        showFilters={false}
        showHeader={false}
        showLegend={false}
        showWeekHeading
        showLecturerAvailability
        readOnly
        embedded
        requestedSessionId={requestedSessionId}
        requestedModuleCode={savedSolution?.moduleCode}
        additionalChangeSessionIds={
          additionalChangeSessionIds
        }
        additionalChangeModuleCodes={
          additionalChangeModuleCodes
        }
        showSolutionLegend={Boolean(savedSolution)}
      />
    </section>
  );
}