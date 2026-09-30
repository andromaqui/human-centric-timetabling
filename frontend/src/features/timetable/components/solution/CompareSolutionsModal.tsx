import { useEffect, useState } from "react";
import type { StoredSolutionCandidate } from "./Step4Solution";
import "./Step4solution.css";

type CompareSolutionsModalProps = {
  open: boolean;
  solutions: StoredSolutionCandidate[];
  originalDay: string;
  originalTime: string;
  originalRoomId: string;
  originalLecturerId: string;
  getSessionLabel: (sessionId: string) => string;
  getRoomName: (roomId: string) => string;
  getLecturerName: (lecturerId: string) => string;
  getCohortName: (cohortId: string) => string;
  getConstraintName: (constraintId: string) => string;
  onClose: () => void;
  onChoose: (solution: StoredSolutionCandidate) => void;
};

function displayDay(day?: string) {
  if (!day) return "—";
  return day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
}

function ChangeLine({
  label,
  from,
  to,
}: {
  label: string;
  from: string;
  to: string;
}) {
  if (from === to) return null;

  return (
    <div className="compare-change-line">
      <span className="compare-change-label">{label}</span>

      <span className="compare-change-values">
        <span>{from}</span>
        <span className="compare-arrow">→</span>
        <strong>{to}</strong>
      </span>
    </div>
  );
}


function formatImpactNumber(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, "");
}

function impactBadge(delta: number, unit: string) {
  if (delta === 0) {
    return {
      text: "No change",
      style: {
        color: "#64748b",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
      },
    };
  }

  const improved = delta < 0;
  const amount = formatImpactNumber(Math.abs(delta));

  return {
    text: `${improved ? "↓" : "↑"} ${amount}${unit ? ` ${unit}` : ""}`,
    style: improved
      ? {
          color: "#166534",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
        }
      : {
          color: "#991b1b",
          background: "#fef2f2",
          border: "1px solid #fecaca",
        },
  };
}

type CompactImpactRow = {
  key: string;
  stakeholder: string;
  label: string;
  delta: number;
  unit: string;
};

function CompactStakeholderImpact({
  solution,
  getCohortName,
  getLecturerName,
  getSessionLabel,
}: {
  solution: StoredSolutionCandidate;
  getCohortName: (cohortId: string) => string;
  getLecturerName: (lecturerId: string) => string;
  getSessionLabel: (sessionId: string) => string;
}) {
  const impact = solution.impact;
  if (!impact) return null;

  const rows: CompactImpactRow[] = [
    ...impact.objectives.cohort_gaps.affected.map((item) => ({
      key: `cohort-gaps-${item.id}`,
      stakeholder: getCohortName(item.id),
      label: "Timetable gaps",
      delta: item.delta,
      unit: "hrs",
    })),
    ...impact.objectives.cohort_room_changes.affected.map((item) => ({
      key: `cohort-room-changes-${item.id}`,
      stakeholder: getCohortName(item.id),
      label: "Room changes",
      delta: item.delta,
      unit: "",
    })),
    ...impact.objectives.lecturer_idle.affected.map((item) => ({
      key: `lecturer-idle-${item.id}`,
      stakeholder: getLecturerName(item.id),
      label: "Idle time",
      delta: item.delta,
      unit: "hrs",
    })),
    ...impact.objectives.room_waste.affected.map((item) => ({
      key: `room-waste-${item.id}`,
      stakeholder: getSessionLabel(item.id),
      label: "Room capacity waste",
      delta: item.delta,
      unit: "seats",
    })),
  ];

  if (rows.length === 0) {
    return <p className="compare-empty">No stakeholder impact changes.</p>;
  }

  const groups = new Map<string, CompactImpactRow[]>();
  rows.forEach((row) => {
    const current = groups.get(row.stakeholder) ?? [];
    current.push(row);
    groups.set(row.stakeholder, current);
  });

  return (
    <div
      style={{
        border: "1px solid #dbe3ee",
        borderRadius: "8px",
        overflow: "hidden",
        background: "#ffffff",
      }}
    >
      {Array.from(groups.entries()).map(([stakeholder, stakeholderRows], groupIndex) => (
        <div
          key={stakeholder}
          style={{
            borderTop: groupIndex === 0 ? undefined : "1px solid #dbe3ee",
          }}
        >
          <div
            style={{
              padding: "8px 10px",
              background: "#f8fafc",
              fontSize: "12px",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            {stakeholder}
          </div>

          {stakeholderRows.map((row) => {
            const badge = impactBadge(row.delta, row.unit);

            return (
              <div
                key={row.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 140px",
                  borderTop: "1px solid #eef2f7",
                }}
              >
                <div
                  style={{
                    padding: "8px 10px",
                    fontSize: "12px",
                    color: "#475569",
                  }}
                >
                  {row.label}
                </div>

                <div
                  style={{
                    padding: "6px 8px",
                    borderLeft: "1px solid #eef2f7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      minWidth: "82px",
                      padding: "5px 9px",
                      borderRadius: "6px",
                      textAlign: "center",
                      fontSize: "11px",
                      fontWeight: 700,
                      ...badge.style,
                    }}
                  >
                    {badge.text}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function CompareSolutionsModal({
  open,
  solutions,
  originalDay,
  originalTime,
  originalRoomId,
  originalLecturerId,
  getSessionLabel,
  getRoomName,
  getLecturerName,
  getCohortName,
  getConstraintName,
  onClose,
  onChoose,
}: CompareSolutionsModalProps) {
  const [expandedSolutions, setExpandedSolutions] = useState<Set<string>>(
    () => new Set(),
  );

  // Whenever the modal opens, expand the first solution by default.
  useEffect(() => {
    if (!open) return;

    setExpandedSolutions(
      new Set(solutions.length > 0 ? [solutions[0].key] : []),
    );
  }, [open, solutions]);

  // Allow Escape to close the modal.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  function toggleSolution(key: string) {
    setExpandedSolutions((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  if (!open) return null;

  return (
    <div
      className="compare-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="compare-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-modal-title"
      >
        <header className="compare-modal-header">
          <div>
            <h2 id="compare-modal-title">Compare and choose</h2>

            <p>
              {solutions.length} shortlisted solution
              {solutions.length === 1 ? "" : "s"}
            </p>
          </div>

          <button
            type="button"
            className="compare-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="compare-modal-body">
          {solutions.map((solution, index) => {
            const expanded = expandedSolutions.has(solution.key);

            const targetDay = solution.day
              ? displayDay(solution.day)
              : originalDay;

            const targetTime = solution.time ?? originalTime;

            const targetRoom = solution.room_id
              ? getRoomName(solution.room_id)
              : getRoomName(originalRoomId);

            const targetLecturer = solution.lecturer_id
              ? getLecturerName(solution.lecturer_id)
              : getLecturerName(originalLecturerId);

            const originalTimeLabel = `${originalDay} ${originalTime}`;
            const targetTimeLabel = `${targetDay} ${targetTime}`;

            const originalRoom = getRoomName(originalRoomId);
            const originalLecturer = getLecturerName(originalLecturerId);

            const primaryChangeExists =
              originalTimeLabel !== targetTimeLabel ||
              originalRoom !== targetRoom ||
              originalLecturer !== targetLecturer;

            return (
              <article
                className={`compare-solution-card ${
                  expanded ? "expanded" : "collapsed"
                }`}
                key={solution.key}
              >
                <div className="compare-solution-heading">
                  <button
                    type="button"
                    className="compare-solution-toggle"
                    onClick={() => toggleSolution(solution.key)}
                    aria-expanded={expanded}
                  >
                    <div className="compare-solution-title">
                      <span>Solution {index + 1}</span>

                      <strong>{solution.label}</strong>

                      <small>
                        {solution.additional_changes.length} additional change
                        {solution.additional_changes.length === 1 ? "" : "s"}
                        {" · "}
                        {solution.relaxations.length} relaxation
                        {solution.relaxations.length === 1 ? "" : "s"}
                      </small>
                    </div>

                    <span
                      className="compare-solution-chevron"
                      aria-hidden="true"
                    >
                      {expanded ? "⌃" : "⌄"}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="compare-choose-button"
                    onClick={() => onChoose(solution)}
                  >
                    Choose
                  </button>
                </div>

                {expanded && (
                  <div className="compare-solution-content">
                    {/* Primary change */}
                    <section className="compare-section">
                      <h3>Primary change</h3>

                      <ChangeLine
                        label="Time"
                        from={originalTimeLabel}
                        to={targetTimeLabel}
                      />

                      <ChangeLine
                        label="Room"
                        from={originalRoom}
                        to={targetRoom}
                      />

                      <ChangeLine
                        label="Lecturer"
                        from={originalLecturer}
                        to={targetLecturer}
                      />

                      {!primaryChangeExists && (
                        <p className="compare-empty">
                          Requested placement retained.
                        </p>
                      )}
                    </section>

                    {/* Additional changes */}
                    <section className="compare-section">
                      <h3>
                        Additional changes{" "}
                        <span>{solution.additional_changes.length}</span>
                      </h3>

                      {solution.additional_changes.length === 0 ? (
                        <p className="compare-empty">None</p>
                      ) : (
                        solution.additional_changes.map(
                          (change, changeIndex) => (
                            <div
                              className="compare-detail-row"
                              key={`${change.session_id}-${changeIndex}`}
                            >
                              <strong>
                                {getSessionLabel(change.session_id)}
                              </strong>

                              {change.time_changed && (
                                <span>
                                  {displayDay(change.old_day)}{" "}
                                  {change.old_time}
                                  {" → "}
                                  {displayDay(change.new_day)}{" "}
                                  {change.new_time}
                                </span>
                              )}

                              {change.room_changed && (
                                <span>
                                  {getRoomName(change.old_room_id)}
                                  {" → "}
                                  {getRoomName(change.new_room_id)}
                                </span>
                              )}
                            </div>
                          ),
                        )
                      )}
                    </section>

                    {/* Constraint relaxations */}
                    <section className="compare-section">
                      <h3>
                        Constraint relaxations{" "}
                        <span>{solution.relaxations.length}</span>
                      </h3>

                      {solution.relaxations.length === 0 ? (
                        <p className="compare-empty">None</p>
                      ) : (
                        solution.relaxations.map(
                          (relaxation, relaxationIndex) => (
                            <div
                              className="compare-detail-row"
                              key={`${relaxation.constraint_id}-${relaxation.instance_id}-${relaxationIndex}`}
                            >
                              <strong>
                                {getConstraintName(
                                  relaxation.constraint_id,
                                )}
                              </strong>

                              <span>
                                {relaxation.instance_type}
                                {" · "}
                                {relaxation.instance_id}

                                {relaxation.day
                                  ? ` · ${displayDay(relaxation.day)}`
                                  : ""}
                              </span>
                            </div>
                          ),
                        )
                      )}
                    </section>

                    {/* Stakeholder impact */}
                    {solution.impact && (
                      <section className="compare-section">
                        <h3>Stakeholder impact</h3>

                        <CompactStakeholderImpact
                          solution={solution}
                          getCohortName={getCohortName}
                          getLecturerName={getLecturerName}
                          getSessionLabel={getSessionLabel}
                        />

                        <p
                          style={{
                            margin: "7px 0 0",
                            fontSize: "10px",
                            color: "#64748b",
                          }}
                        >
                          ↓ indicates a reduction in impact; ↑ indicates an increase.
                        </p>
                      </section>
                    )}

                    {/* Objective impact */}
                    <section className="compare-section">
                      <h3>Objective impact</h3>

                      <p className="compare-empty">
                        {solution.objective_score == null
                          ? "No objective score available for this solution."
                          : `Overall objective score: ${solution.objective_score}`}
                      </p>
                    </section>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
