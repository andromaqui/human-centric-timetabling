import { useMemo, useState } from "react";
import "./ObjectiveVisualisations.css";

export type CohortRoomChangeCohort = {
  id: string;
  name: string;
};

export type CohortRoomChangeSession = {
  id: string;
  moduleCode: string;
  moduleName?: string;
  cohortIds: string[];
  day: string;
  startTime: string;
  endTime: string;
  roomId: string;
  roomName: string;
};

type CohortRoomChangeVisualisationProps = {
  cohorts: CohortRoomChangeCohort[];
  sessions: CohortRoomChangeSession[];
  initialCohortId?: string | null;
  proposedSessionId?: string | null;
};

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function CohortRoomChangeVisualisation({
  cohorts,
  sessions,
  initialCohortId,
  proposedSessionId,
}: CohortRoomChangeVisualisationProps) {
  const [selectedCohortId, setSelectedCohortId] = useState(
    initialCohortId ?? cohorts[0]?.id ?? "",
  );

  const selectedCohort = useMemo(
    () =>
      cohorts.find(
        (cohort) => cohort.id === selectedCohortId,
      ),
    [cohorts, selectedCohortId],
  );

  const cohortSessions = useMemo(
    () =>
      sessions
        .filter((session) =>
          session.cohortIds.includes(selectedCohortId),
        )
        .sort((a, b) => {
          const dayCompare = a.day.localeCompare(b.day);

          if (dayCompare !== 0) {
            return dayCompare;
          }

          return (
            timeToMinutes(a.startTime) -
            timeToMinutes(b.startTime)
          );
        }),
    [sessions, selectedCohortId],
  );

  const sessionsByDay = useMemo(() => {
    const groups = new Map<
      string,
      CohortRoomChangeSession[]
    >();

    for (const session of cohortSessions) {
      const existing = groups.get(session.day) ?? [];
      existing.push(session);
      groups.set(session.day, existing);
    }

    return Array.from(groups.entries());
  }, [cohortSessions]);

  const totalRoomChanges = useMemo(() => {
    let count = 0;

    for (const [, daySessions] of sessionsByDay) {
      for (let i = 0; i < daySessions.length - 1; i++) {
        const current = daySessions[i];
        const next = daySessions[i + 1];

        const backToBack =
          timeToMinutes(current.endTime) ===
          timeToMinutes(next.startTime);

        if (
          backToBack &&
          current.roomId !== next.roomId
        ) {
          count += 1;
        }
      }
    }

    return count;
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

          <h3>Back-to-back room changes</h3>

          <p>
            See when a cohort has to change rooms between
            consecutive classes.
          </p>
        </div>

        <div className="objective-selector">
          <label htmlFor="room-change-cohort">
            Cohort
          </label>

          <select
            id="room-change-cohort"
            value={selectedCohortId}
            onChange={(event) =>
              setSelectedCohortId(event.target.value)
            }
          >
            {cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="objective-summary">
        <span>
          Back-to-back room changes
          {selectedCohort
            ? ` · ${selectedCohort.name}`
            : ""}
        </span>

        <strong>
          {totalRoomChanges}{" "}
          {totalRoomChanges === 1 ? "change" : "changes"}
        </strong>
      </div>

      <div className="room-change-days">
        {sessionsByDay.length === 0 ? (
          <p className="objective-empty">
            No classes are scheduled for this cohort.
          </p>
        ) : (
          sessionsByDay.map(([day, daySessions]) => (
            <div
              key={day}
              className="room-change-day"
            >
              <strong className="room-change-day-title">
                {day}
              </strong>

              <div className="room-change-sequence">
                {daySessions.map((session, index) => {
                  const next = daySessions[index + 1];

                  const backToBack =
                    next != null &&
                    timeToMinutes(session.endTime) ===
                      timeToMinutes(next.startTime);

                  const roomChanges =
                    backToBack &&
                    next != null &&
                    session.roomId !== next.roomId;

                  const isProposed =
                    session.id === proposedSessionId;

                  return (
                    <div
                      key={session.id}
                      className="room-change-sequence-item"
                    >
                      <article
                        className={`objective-session ${
                          isProposed ? "proposed" : ""
                        }`}
                      >
                        <div className="objective-session-heading">
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

                          {isProposed && (
                            <span className="objective-proposed-badge">
                              Proposed
                            </span>
                          )}
                        </div>

                        <div className="objective-session-meta">
                          {session.startTime}–
                          {session.endTime}
                        </div>

                        <div className="room-change-room">
                          {session.roomName}
                        </div>
                      </article>

                      {next && (
                        <div
                          className={`room-change-transition ${
                            roomChanges
                              ? "penalty"
                              : "no-penalty"
                          }`}
                        >
                          <span className="room-change-arrow">
                            →
                          </span>

                          {roomChanges ? (
                            <span className="room-change-label">
                              Room change
                            </span>
                          ) : backToBack ? (
                            <span className="room-change-label">
                              Same room
                            </span>
                          ) : (
                            <span className="room-change-label">
                              Gap
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}