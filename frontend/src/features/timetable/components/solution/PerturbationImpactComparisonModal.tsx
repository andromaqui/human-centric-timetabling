import { X } from "lucide-react";
import type { PerturbationImpact } from "./PerturbationImpactModal";

type ComparisonSolution = {
  rank: number;
  objective_score: number | null;
  impact?: PerturbationImpact;
};

type Props = {
  solutions: ComparisonSolution[];
  sessions: {
    id: string;
    moduleId?: string;
    lecturerId: string;
    room?: string;
    roomId?: string | null;
    cohortIds: string[];
  }[];
  modules: {
    id: string;
    code?: string;
    name?: string;
    title?: string;
  }[];
  cohorts: {
    id: string;
    name: string;
    capacity?: number;
  }[];
  lecturers: {
    id: string;
    name: string;
    capacity?: number;
  }[];
  rooms: {
    id: string;
    name: string;
    capacity?: number;
  }[];
  onClose: () => void;
};

type ComparisonRow = {
  key: string;
  stakeholderType: "cohort" | "lecturer" | "session";
  stakeholderId: string;
  stakeholderName: string;
  objectiveId:
    | "room_waste"
    | "cohort_gaps"
    | "lecturer_idle"
    | "cohort_room_changes";
  objectiveLabel: string;
  unit: string;
  deltas: (number | null)[];
};

const objectiveMeta = {
  room_waste: {
    label: "Room capacity waste",
    unit: "seats",
    stakeholderType: "session" as const,
  },
  cohort_gaps: {
    label: "Timetable gaps",
    unit: "hrs",
    stakeholderType: "cohort" as const,
  },
  lecturer_idle: {
    label: "Idle time",
    unit: "hrs",
    stakeholderType: "lecturer" as const,
  },
  cohort_room_changes: {
    label: "Room changes",
    unit: "",
    stakeholderType: "cohort" as const,
  },
};

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, "");
}

function formatDelta(delta: number | null, unit: string) {
  if (delta === null) {
    return {
      text: "—",
      kind: "neutral" as const,
    };
  }

  if (delta === 0) {
    return {
      text: "No change",
      kind: "neutral" as const,
    };
  }

  const arrow = delta < 0 ? "↓" : "↑";
  const amount = formatNumber(Math.abs(delta));
  const suffix = unit ? ` ${unit}` : "";

  return {
    text: `${arrow} ${amount}${suffix}`,
    kind: delta < 0 ? ("improved" as const) : ("worsened" as const),
  };
}

function changeStyle(kind: "improved" | "worsened" | "neutral") {
  if (kind === "improved") {
    return {
      color: "#166534",
      background: "#f0fdf4",
      border: "1px solid #bbf7d0",
    };
  }

  if (kind === "worsened") {
    return {
      color: "#991b1b",
      background: "#fef2f2",
      border: "1px solid #fecaca",
    };
  }

  return {
    color: "#64748b",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  };
}

export function PerturbationImpactComparisonModal({
  solutions,
  sessions,
  modules,
  cohorts,
  lecturers,
  onClose,
}: Props) {
  const getCohortName = (id: string) =>
    cohorts.find((item) => item.id === id)?.name ?? id;

  const getLecturerName = (id: string) =>
    lecturers.find((item) => item.id === id)?.name ?? id;

  const getSessionName = (id: string) => {
    const session = sessions.find((item) => item.id === id);

    if (!session?.moduleId) {
      return id;
    }

    const module = modules.find((item) => item.id === session.moduleId);

    if (!module) {
      return session.moduleId;
    }

    const code = module.code ?? module.id;
    const name = module.name ?? module.title;

    return name ? `${code} · ${name}` : code;
  };

  /*
   * Build one row for each stakeholder/objective pair that appears in
   * at least one solution's `affected` list.
   *
   * PerturbationImpact's real shape is:
   *
   * impact.objectives.<objective>.affected = [
   *   { id, before, after, delta, before_details, after_details }
   * ]
   */
  const rowDefinitions = new Map<
    string,
    Omit<ComparisonRow, "deltas">
  >();

  solutions.forEach((solution) => {
    if (!solution.impact) return;

    const objectives = solution.impact.objectives;

    objectives.room_waste.affected.forEach((change) => {
      const meta = objectiveMeta.room_waste;
      const key = `session:${change.id}:room_waste`;

      rowDefinitions.set(key, {
        key,
        stakeholderType: meta.stakeholderType,
        stakeholderId: change.id,
        stakeholderName: getSessionName(change.id),
        objectiveId: "room_waste",
        objectiveLabel: meta.label,
        unit: meta.unit,
      });
    });

    objectives.cohort_gaps.affected.forEach((change) => {
      const meta = objectiveMeta.cohort_gaps;
      const key = `cohort:${change.id}:cohort_gaps`;

      rowDefinitions.set(key, {
        key,
        stakeholderType: meta.stakeholderType,
        stakeholderId: change.id,
        stakeholderName: getCohortName(change.id),
        objectiveId: "cohort_gaps",
        objectiveLabel: meta.label,
        unit: meta.unit,
      });
    });

    objectives.lecturer_idle.affected.forEach((change) => {
      const meta = objectiveMeta.lecturer_idle;
      const key = `lecturer:${change.id}:lecturer_idle`;

      rowDefinitions.set(key, {
        key,
        stakeholderType: meta.stakeholderType,
        stakeholderId: change.id,
        stakeholderName: getLecturerName(change.id),
        objectiveId: "lecturer_idle",
        objectiveLabel: meta.label,
        unit: meta.unit,
      });
    });

    objectives.cohort_room_changes.affected.forEach((change) => {
      const meta = objectiveMeta.cohort_room_changes;
      const key = `cohort:${change.id}:cohort_room_changes`;

      rowDefinitions.set(key, {
        key,
        stakeholderType: meta.stakeholderType,
        stakeholderId: change.id,
        stakeholderName: getCohortName(change.id),
        objectiveId: "cohort_room_changes",
        objectiveLabel: meta.label,
        unit: meta.unit,
      });
    });
  });

  const findDelta = (
    solution: ComparisonSolution,
    row: Omit<ComparisonRow, "deltas">,
  ): number | null => {
    if (!solution.impact) {
      return null;
    }

    const affected =
      solution.impact.objectives[row.objectiveId].affected;

    const match = affected.find(
      (change) => change.id === row.stakeholderId,
    );

    /*
     * If this stakeholder is not in `affected`, that objective did not
     * change for them in this solution, so its delta is zero.
     */
    return match?.delta ?? 0;
  };

  const rows: ComparisonRow[] = Array.from(rowDefinitions.values())
    .map((row) => ({
      ...row,
      deltas: solutions.map((solution) => findDelta(solution, row)),
    }))
    .filter((row) =>
      row.deltas.some((delta) => delta !== null && delta !== 0),
    );

  /*
   * Group rows by stakeholder so that, for example:
   *
   * DS Year 3
   *   Timetable gaps
   *   Room changes
   *
   * appears as one section.
   */
  const stakeholderGroups = Array.from(
    rows.reduce((groups, row) => {
      const stakeholderKey = `${row.stakeholderType}:${row.stakeholderId}`;

      const existing = groups.get(stakeholderKey);

      if (existing) {
        existing.rows.push(row);
      } else {
        groups.set(stakeholderKey, {
          key: stakeholderKey,
          name: row.stakeholderName,
          rows: [row],
        });
      }

      return groups;
    }, new Map<string, { key: string; name: string; rows: ComparisonRow[] }>()),
  ).map(([, group]) => group);

  const solutionCount = Math.max(solutions.length, 1);

  const gridTemplateColumns =
    `minmax(220px, 1.35fr) repeat(${solutionCount}, minmax(135px, 1fr))`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="perturbation-impact-comparison-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(1180px, 96vw)",
          maxHeight: "90vh",
          background: "#ffffff",
          borderRadius: 14,
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 20,
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "#64748b",
              }}
            >
              PERTURBATION RECOVERY
            </div>

            <h2
              id="perturbation-impact-comparison-title"
              style={{
                margin: "4px 0 0",
                fontSize: 21,
                color: "#0f172a",
              }}
            >
              Compare impacts
            </h2>

            <div
              style={{
                marginTop: 5,
                fontSize: 12,
                lineHeight: 1.5,
                color: "#64748b",
              }}
            >
              Compare how each rearrangement changes the impact on timetable
              stakeholders.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close comparison"
            style={{
              border: 0,
              background: "transparent",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            padding: 20,
            background: "#f8fafc",
          }}
        >
          {stakeholderGroups.length === 0 ? (
            <div
              style={{
                padding: 24,
                border: "1px dashed #cbd5e1",
                borderRadius: 10,
                background: "#ffffff",
                color: "#64748b",
                fontSize: 13,
              }}
            >
              No stakeholder impact changes are available to compare.
            </div>
          ) : (
            <div
              style={{
                minWidth: Math.max(760, 260 + solutions.length * 150),
                border: "1px solid #dbe3ee",
                borderRadius: 12,
                overflow: "hidden",
                background: "#ffffff",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns,
                  background: "#f8fafc",
                  borderBottom: "1px solid #dbe3ee",
                  position: "sticky",
                  top: 0,
                  zIndex: 4,
                }}
              >
                <div
                  style={{
                    padding: "14px 16px",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#64748b",
                  }}
                >
                  Stakeholder / impact
                </div>

                {solutions.map((solution, index) => (
                  <div
                    key={`${solution.rank}-${index}`}
                    style={{
                      padding: "14px 16px",
                      borderLeft: "1px solid #e2e8f0",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      Solution {index + 1}
                    </div>
                  </div>
                ))}
              </div>

              {stakeholderGroups.map((group, groupIndex) => (
                <div
                  key={group.key}
                  style={{
                    borderTop:
                      groupIndex === 0 ? undefined : "1px solid #dbe3ee",
                  }}
                >
                  <div
                    style={{
                      padding: "11px 16px",
                      background: "#f8fafc",
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#0f172a",
                    }}
                  >
                    {group.name}
                  </div>

                  {group.rows.map((row) => (
                    <div
                      key={row.key}
                      style={{
                        display: "grid",
                        gridTemplateColumns,
                        borderTop: "1px solid #eef2f7",
                        background: "#ffffff",
                      }}
                    >
                      <div
                        style={{
                          padding: "14px 16px",
                          display: "flex",
                          alignItems: "center",
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#334155",
                        }}
                      >
                        {row.objectiveLabel}
                      </div>

                      {row.deltas.map((delta, solutionIndex) => {
                        const formatted = formatDelta(delta, row.unit);

                        return (
                          <div
                            key={`${row.key}-${solutionIndex}`}
                            style={{
                              padding: "10px 12px",
                              borderLeft: "1px solid #eef2f7",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <div
                              style={{
                                minWidth: 90,
                                padding: "7px 10px",
                                borderRadius: 7,
                                textAlign: "center",
                                fontSize: 12,
                                fontWeight: 700,
                                ...changeStyle(formatted.kind),
                              }}
                            >
                              {formatted.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              lineHeight: 1.5,
              color: "#64748b",
            }}
          >
            ↓ indicates a reduction in the measured impact; ↑ indicates an
            increase. Objectives with no change in any solution are omitted.
          </div>
        </div>
      </div>
    </div>
  );
}
