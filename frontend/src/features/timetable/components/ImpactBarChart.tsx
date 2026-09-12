import { useMemo } from "react";

import type {
  HistoricalImpact,
  HistoricalImpactType,
  HistoricalStakeholderType,
} from "../pages/historicalImpacts";

import "./ImpactBarChart.css";

type ImpactBarChartProps = {
  impactType: HistoricalImpactType;
  stakeholderType: HistoricalStakeholderType;
  impacts: HistoricalImpact[];
};

export function ImpactBarChart({
  impactType,
  stakeholderType,
  impacts,
}: ImpactBarChartProps) {
  const isLunch =
    impactType === "lunch-break-reduced";

  const data = useMemo(() => {
    const totals = new Map<
      string,
      {
        name: string;
        value: number;
      }
    >();

    impacts.forEach((impact) => {
      const existing = totals.get(
        impact.stakeholder_id,
      );

      if (!existing) {
        totals.set(impact.stakeholder_id, {
          name: impact.stakeholder_name,
          value: impact.magnitude_minutes,
        });

        return;
      }

      existing.value += impact.magnitude_minutes;
    });

    return Array.from(totals.values()).sort(
      (a, b) => b.value - a.value,
    );
  }, [impacts]);

  const maxValue =
    data.length > 0
      ? Math.max(...data.map((item) => item.value))
      : 0;

  function formatValue(value: number) {
    if (isLunch) {
      return `${value} min`;
    }

    const hours = Math.floor(value / 60);
    const minutes = value % 60;

    if (hours === 0) {
      return `${minutes} min`;
    }

    if (minutes === 0) {
      return `${hours} h`;
    }

    return `${hours} h ${minutes} min`;
  }

  return (
    <section className="impact-bar-chart">
      <div className="impact-bar-chart-header">
        <h2>Accumulated impact</h2>

        <p>
          {isLunch
            ? "Total lunch-break time lost across displayed semesters."
            : "Total teaching time above the daily limit across displayed semesters."}
        </p>
      </div>

      {data.length === 0 ? (
        <p className="impact-bar-chart-empty">
          No historical impact data available.
        </p>
      ) : (
        <div className="impact-bar-chart-list">
          {data.map((item) => (
            <div
              key={item.name}
              className="impact-bar-chart-row"
            >
              <span className="impact-bar-chart-name">
                {item.name}
              </span>

              <div className="impact-bar-chart-track">
                <div
                  className="impact-bar-chart-fill"
                  style={{
                    width:
                      maxValue === 0
                        ? "0%"
                        : `${
                            (item.value / maxValue) * 100
                          }%`,
                  }}
                />
              </div>

              <strong className="impact-bar-chart-value">
                {formatValue(item.value)}
              </strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}