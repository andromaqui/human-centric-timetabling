import { useEffect, useMemo, useState } from "react";

import {
  fetchHistoricalImpacts,
  type HistoricalImpact,
  type HistoricalImpactType,
  type HistoricalStakeholderType,
} from "./historicalImpacts";

import { ImpactCellDetails } from "../components/ImpactCellDetails";
import { ImpactBarChart } from "../components/ImpactBarChart";

import "./HistoricalStakeholderImpactPage.css";

type ImpactOption = {
  value: HistoricalImpactType;
  label: string;
};

type HoveredCell = {
  x: number;
  y: number;
  stakeholderId: string;
  stakeholderName: string;
  semesterId: string;
  semesterName: string;
};

const impactOptions: ImpactOption[] = [
  {
    value: "lunch-break-reduced",
    label: "Lunch breaks",
  },
  {
    value: "consecutive-teaching",
    label: "Consecutive teaching",
  },
];

export function HistoricalStakeholderImpactPage() {
  const [stakeholderType, setStakeholderType] =
    useState<HistoricalStakeholderType>("lecturer");

  const [impactType, setImpactType] =
    useState<HistoricalImpactType>("lunch-break-reduced");

  const [historicalImpacts, setHistoricalImpacts] = useState<
    HistoricalImpact[]
  >([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [hoveredCell, setHoveredCell] =
    useState<HoveredCell | null>(null);

  /*
   * Fetch historical impacts whenever the selected
   * stakeholder type or impact type changes.
   */
  useEffect(() => {
    async function loadHistoricalImpacts() {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchHistoricalImpacts(
          stakeholderType,
          impactType,
        );

        console.log(
          "Historical impacts from backend:",
          data,
        );

        setHistoricalImpacts(data);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load historical impacts",
        );
      } finally {
        setLoading(false);
      }
    }

    loadHistoricalImpacts();
  }, [stakeholderType, impactType]);

  /*
   * Build one matrix row per stakeholder.
   *
   * Each HistoricalImpact record represents one
   * affected day, therefore every record adds one dot.
   */
  const matrixRows = useMemo(() => {
    const rows = new Map<
      string,
      {
        id: string;
        name: string;
        semesterCounts: Record<string, number>;
      }
    >();

    historicalImpacts.forEach((impact) => {
      const existing = rows.get(
        impact.stakeholder_id,
      );

      if (!existing) {
        rows.set(impact.stakeholder_id, {
          id: impact.stakeholder_id,
          name: impact.stakeholder_name,
          semesterCounts: {
            [impact.semester_id]: 1,
          },
        });

        return;
      }

      existing.semesterCounts[
        impact.semester_id
      ] =
        (existing.semesterCounts[
          impact.semester_id
        ] ?? 0) + 1;
    });

    return Array.from(rows.values());
  }, [historicalImpacts]);

  /*
   * Build semester columns.
   *
   * We keep:
   * - id for matching database records
   * - name for display
   * - firstDate for chronological ordering
   */
  const semesters = useMemo(() => {
    const semesterMap = new Map<
      string,
      {
        id: string;
        name: string;
        firstDate: number;
      }
    >();

    historicalImpacts.forEach((impact) => {
      const date = new Date(
        impact.occurred_on,
      ).getTime();

      const existing = semesterMap.get(
        impact.semester_id,
      );

      if (
        !existing ||
        date < existing.firstDate
      ) {
        semesterMap.set(
          impact.semester_id,
          {
            id: impact.semester_id,
            name: impact.semester_name,
            firstDate: date,
          },
        );
      }
    });

    return Array.from(
      semesterMap.values(),
    ).sort(
      (a, b) =>
        a.firstDate - b.firstDate,
    );
  }, [historicalImpacts]);

  /*
   * When a matrix cell is hovered, select the impacts
   * belonging specifically to that stakeholder +
   * semester.
   */
  const hoveredCellImpacts = useMemo(() => {
    if (!hoveredCell) {
      return [];
    }

    return historicalImpacts.filter(
      (impact) =>
        impact.stakeholder_id ===
          hoveredCell.stakeholderId &&
        impact.semester_id ===
          hoveredCell.semesterId,
    );
  }, [historicalImpacts, hoveredCell]);

  function showPopover(
    event: React.MouseEvent<HTMLTableCellElement>,
    stakeholderId: string,
    stakeholderName: string,
    semesterId: string,
    semesterName: string,
  ) {
    const rect =
      event.currentTarget.getBoundingClientRect();

    setHoveredCell({
      x: rect.left + rect.width / 2,
      y: rect.top,
      stakeholderId,
      stakeholderName,
      semesterId,
      semesterName,
    });
  }

  return (
    <section className="impact-matrix-page">
      <header className="impact-matrix-page-header">
        <h1>Historical Stakeholder Impact</h1>
      </header>

      <div className="impact-matrix-controls">
        <div className="impact-matrix-control">
          <span className="impact-matrix-control-label">
            Impact
          </span>

          <div className="impact-matrix-toggle">
            {impactOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={
                  impactType === option.value
                    ? "is-selected"
                    : ""
                }
                onClick={() => {
                  setImpactType(option.value);
                  setHoveredCell(null);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="impact-matrix-control">
          <span className="impact-matrix-control-label">
            Stakeholders
          </span>

          <div className="impact-matrix-toggle">
            <button
              type="button"
              className={
                stakeholderType === "lecturer"
                  ? "is-selected"
                  : ""
              }
              onClick={() => {
                setStakeholderType("lecturer");
                setHoveredCell(null);
              }}
            >
              Lecturers
            </button>

            <button
              type="button"
              className={
                stakeholderType === "cohort"
                  ? "is-selected"
                  : ""
              }
              onClick={() => {
                setStakeholderType("cohort");
                setHoveredCell(null);
              }}
            >
              Cohorts
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <p className="impact-matrix-status">
          Loading historical impacts...
        </p>
      )}

      {error && (
        <p className="impact-matrix-status impact-matrix-error">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <div className="impact-matrix-wrapper">
            <table className="impact-matrix">
              <thead>
                <tr>
                  <th className="impact-matrix-name-column">
                    {stakeholderType === "lecturer"
                      ? "Lecturer"
                      : "Cohort"}
                  </th>

                  {semesters.map(
                    (semester) => (
                      <th key={semester.id}>
                        {semester.name}
                      </th>
                    ),
                  )}
                </tr>
              </thead>

              <tbody>
                {matrixRows.map((row) => (
                  <tr key={row.id}>
                    <th className="impact-matrix-person">
                      {row.name}
                    </th>

                    {semesters.map(
                      (semester) => {
                        const count =
                          row.semesterCounts[
                            semester.id
                          ] ?? 0;

                        return (
                          <td
                            key={`${row.id}-${semester.id}`}
                            className={
                              count > 0
                                ? "impact-matrix-cell is-populated"
                                : "impact-matrix-cell"
                            }
                            aria-label={`${row.name}, ${semester.name}: ${count} occurrences`}
                            onMouseEnter={(
                              event,
                            ) => {
                              if (count > 0) {
                                showPopover(
                                  event,
                                  row.id,
                                  row.name,
                                  semester.id,
                                  semester.name,
                                );
                              }
                            }}
                            onMouseLeave={() =>
                              setHoveredCell(
                                null,
                              )
                            }
                          >
                            {count === 0 ? (
                              <span className="impact-matrix-empty">
                                —
                              </span>
                            ) : (
                              <span className="impact-matrix-dots">
                                {"●".repeat(
                                  count,
                                )}
                              </span>
                            )}
                          </td>
                        );
                      },
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="impact-matrix-legend">
            <span className="impact-matrix-dots">
              ●
            </span>

            <span>
              one affected day
            </span>
          </div>

          <ImpactBarChart
            impactType={impactType}
            stakeholderType={
              stakeholderType
            }
            impacts={historicalImpacts}
          />
        </>
      )}

      {hoveredCell && (
        <div
          className="impact-floating-popover"
          style={{
            left: hoveredCell.x,
            top: hoveredCell.y,
          }}
        >
          <ImpactCellDetails
            impactType={impactType}
            semester={
              hoveredCell.semesterName
            }
            stakeholderName={
              hoveredCell.stakeholderName
            }
            impacts={hoveredCellImpacts}
          />
        </div>
      )}
    </section>
  );
}