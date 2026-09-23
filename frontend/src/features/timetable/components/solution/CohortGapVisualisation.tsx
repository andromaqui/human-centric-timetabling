import { useMemo, useState } from "react";
import "./ObjectiveVisualisations.css";

export type CohortGapCohort = {
  id: string;
  name: string;
};

export type CohortGapSession = {
  id: string;
  moduleCode: string;
  moduleName?: string;
  cohortIds: string[];
  day: string;
  startTime: string;
  endTime: string;
};

type CohortGapVisualisationProps = {
  cohorts: CohortGapCohort[];
  sessions: CohortGapSession[];
  initialCohortId?: string | null;
  proposedSessionId?: string | null;
};

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

function formatGap(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

export function CohortGapVisualisation({
  cohorts,
  sessions,
  initialCohortId,
  proposedSessionId,
}: CohortGapVisualisationProps) {
  const [selectedCohortId, setSelectedCohortId] =
    useState(
      initialCohortId ?? cohorts[0]?.id ?? "",
    );

  const cohortSessions = useMemo(
    () =>
      sessions.filter((session) =>
        session.cohortIds.includes(selectedCohortId),
      ),
    [sessions, selectedCohortId],
  );

  const sessionsByDay = useMemo(() => {
    const grouped = new Map<
      string,
      CohortGapSession[]
    >();

    for (const session of cohortSessions) {
      const existing = grouped.get(session.day) ?? [];
      existing.push(session);
      grouped.set(session.day, existing);
    }

    for (const daySessions of grouped.values()) {
      daySessions.sort(
        (a, b) =>
          timeToMinutes(a.startTime) -
          timeToMinutes(b.startTime),
      );
    }

    return grouped;
  }, [cohortSessions]);

  const totalGapMinutes = useMemo(() => {
    let total = 0;

    for (const daySessions of sessionsByDay.values()) {
      for (
        let index = 0;
        index < daySessions.length - 1;
        index += 1
      ) {
        const current = daySessions[index];
        const next = daySessions[index + 1];

        const gap =
          timeToMinutes(next.startTime) -
          timeToMinutes(current.endTime);

        if (gap > 0) {
          total += gap;
        }
      }
    }

    return total;
  }, [sessionsByDay]);

  if (cohorts.length === 0) {
    return (
      <div className="objective-visualisation">
        <p>No cohort information is available.</p>
      </div>
    );
  }

  return (
    <section className="objective-visualisation">
      <div className="objective-visualisation-header">
        <div>
          <span className="objective-eyebrow">
            COHORT OBJECTIVE
          </span>

          <h3>Timetable gaps</h3>

          <p>
            See the waiting time between classes for the
            selected cohort.
          </p>
        </div>

        <div className="objective-selector">
          <label htmlFor="cohort-gap-cohort">
            Cohort
          </label>

          <select
            id="cohort-gap-cohort"
            value={selectedCohortId}
            onChange={(event) =>
              setSelectedCohortId(event.target.value)
            }
          >
            {cohorts.map((cohort) => (
              <option
                key={cohort.id}
                value={cohort.id}
              >
                {cohort.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="objective-summary">
        <span>Total timetable gaps</span>
        <strong>
          {totalGapMinutes === 0
            ? "No gaps"
            : formatGap(totalGapMinutes)}
        </strong>
      </div>

      <div className="cohort-days">
        {DAY_ORDER.map((day) => {
          const daySessions =
            sessionsByDay.get(day);

          if (!daySessions?.length) {
            return null;
          }

          return (
            <div
              key={day}
              className="cohort-day"
            >
              <h4>{day}</h4>

              <div className="cohort-day-sessions">
                {daySessions.map(
                  (session, index) => {
                    const nextSession =
                      daySessions[index + 1];

                    const gapMinutes =
                      nextSession
                        ? timeToMinutes(
                            nextSession.startTime,
                          ) -
                          timeToMinutes(
                            session.endTime,
                          )
                        : 0;

                    const isProposed =
                      session.id ===
                      proposedSessionId;

                    return (
                      <div key={session.id}>
                        <div
                          className={`cohort-session ${
                            isProposed
                              ? "proposed"
                              : ""
                          }`}
                        >
                          <div>
                            <strong>
                              {session.moduleCode}
                            </strong>

                            {session.moduleName && (
                              <span>
                                {session.moduleName}
                              </span>
                            )}
                          </div>

                          <div className="cohort-session-time">
                            {session.startTime}–
                            {session.endTime}
                          </div>

                          {isProposed && (
                            <span className="objective-proposed-badge">
                              Proposed
                            </span>
                          )}
                        </div>

                        {gapMinutes > 0 && (
                          <div className="cohort-gap">
                            <div className="cohort-gap-line" />

                            <span>
                              {formatGap(
                                gapMinutes,
                              )}{" "}
                              gap
                            </span>

                            <div className="cohort-gap-line" />
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}