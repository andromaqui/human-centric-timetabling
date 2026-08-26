import { useMemo, useState } from "react";

import {
  historicalStakeholderImpacts,
  type HistoricalImpactType,
  type HistoricalStakeholderType,
} from "../data/historicalStakeholderImpact";

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
  stakeholderName: string;
  semester: string;
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

function getOccurrenceCountForImpact(
  impact: (typeof historicalStakeholderImpacts)[number]["impacts"][number],
) {
  if (impact.details.kind === "lunch-break") {
    return impact.details.changes.length;
  }

  return 1;
}

export function HistoricalStakeholderImpactPage() {
  const [stakeholderType, setStakeholderType] =
    useState<HistoricalStakeholderType>("lecturer");

  const [impactType, setImpactType] =
    useState<HistoricalImpactType>("lunch-break-reduced");

  const [hoveredCell, setHoveredCell] =
    useState<HoveredCell | null>(null);

  /*
   * Build the matrix rows.
   */
  const matrixRows = useMemo(() => {
    return historicalStakeholderImpacts
      .filter(
        (stakeholder) =>
          stakeholder.stakeholderType === stakeholderType,
      )
      .map((stakeholder) => {
        const semesterCounts: Record<string, number> = {};

        stakeholder.impacts
          .filter((impact) => impact.impactType === impactType)
          .forEach((impact) => {
            const semester = impact.details.semester;

            semesterCounts[semester] =
              (semesterCounts[semester] ?? 0) +
              getOccurrenceCountForImpact(impact);
          });

        return {
          id: stakeholder.stakeholderId,
          name: stakeholder.stakeholderName,
          semesterCounts,
        };
      });
  }, [impactType, stakeholderType]);

  /*
   * Work out which semesters become columns.
   */
  const semesters = useMemo(() => {
    const semesterDates = new Map<string, number>();

    historicalStakeholderImpacts
      .filter(
        (stakeholder) =>
          stakeholder.stakeholderType === stakeholderType,
      )
      .forEach((stakeholder) => {
        stakeholder.impacts
          .filter((impact) => impact.impactType === impactType)
          .forEach((impact) => {
            const semester = impact.details.semester;
            const date = new Date(impact.date).getTime();

            const existing = semesterDates.get(semester);

            if (existing === undefined || date < existing) {
              semesterDates.set(semester, date);
            }
          });
      });

    return Array.from(semesterDates.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([semester]) => semester);
  }, [impactType, stakeholderType]);

  function showPopover(
    event: React.MouseEvent<HTMLTableCellElement>,
    stakeholderName: string,
    semester: string,
  ) {
    const rect = event.currentTarget.getBoundingClientRect();

    setHoveredCell({
      x: rect.left + rect.width / 2,
      y: rect.top,
      stakeholderName,
      semester,
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

      <div className="impact-matrix-wrapper">
        <table className="impact-matrix">
          <thead>
            <tr>
              <th className="impact-matrix-name-column">
                {stakeholderType === "lecturer"
                  ? "Lecturer"
                  : "Cohort"}
              </th>

              {semesters.map((semester) => (
                <th key={semester}>
                  {semester}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {matrixRows.map((row) => (
              <tr key={row.id}>
                <th className="impact-matrix-person">
                  {row.name}
                </th>

                {semesters.map((semester) => {
                  const count =
                    row.semesterCounts[semester] ?? 0;

                  return (
                    <td
                      key={`${row.id}-${semester}`}
                      className={
                        count > 0
                          ? "impact-matrix-cell is-populated"
                          : "impact-matrix-cell"
                      }
                      aria-label={`${row.name}, ${semester}: ${count} occurrences`}
                      onMouseEnter={(event) => {
                        if (count > 0) {
                          showPopover(
                            event,
                            row.name,
                            semester,
                          );
                        }
                      }}
                      onMouseLeave={() =>
                        setHoveredCell(null)
                      }
                    >
                      {count === 0 ? (
                        <span className="impact-matrix-empty">
                          —
                        </span>
                      ) : (
                        <span className="impact-matrix-dots">
                          {"●".repeat(count)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="impact-matrix-legend">
        <span className="impact-matrix-dots">●</span>
        <span>one affected day</span>
      </div>

      <ImpactBarChart
          impactType={impactType}
          stakeholderType={stakeholderType}
        />

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
            semester={hoveredCell.semester}
            stakeholderName={hoveredCell.stakeholderName}
          />
        </div>
      )}
    </section>
  );
}