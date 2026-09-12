import type {
  HistoricalImpact,
  HistoricalImpactType,
} from "../pages/historicalImpacts";

import "./ImpactCellDetails.css";

type ImpactCellDetailsProps = {
  impactType: HistoricalImpactType;
  semester: string;
  stakeholderName: string;
  impacts: HistoricalImpact[];
};

const dayLabels: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};

export function ImpactCellDetails({
  impactType,
  semester,
  impacts,
}: ImpactCellDetailsProps) {
  const isLunch =
    impactType === "lunch-break-reduced";

  return (
    <div className="impact-cell-details">
      <div className="impact-cell-details-title">
        {semester}
      </div>

      {isLunch ? (
        <>
          <div className="impact-cell-details-columns lunch-break">
            <span>Day</span>
            <span>Lunch received</span>
            <span>Lost</span>
          </div>

          {impacts.map((impact) => (
            <div
              key={impact.id}
              className="impact-cell-details-row lunch-break"
            >
              <span>
                {dayLabels[impact.day] ?? impact.day}
              </span>

              <strong>
                {impact.details.received_minutes ?? 0} min
              </strong>

              <span className="impact-cell-details-impact">
                −{impact.magnitude_minutes} min
              </span>
            </div>
          ))}
        </>
      ) : (
        <>
          <div className="impact-cell-details-columns daily-hours">
            <span>Day</span>
            <span>Teaching hours</span>
            <span>Limit</span>
            <span>Over</span>
          </div>

          {impacts.map((impact) => {
            const actualMinutes =
              impact.details.actual_minutes ?? 0;

            const limitMinutes =
              impact.details.limit_minutes ?? 0;

            return (
              <div
                key={impact.id}
                className="impact-cell-details-row daily-hours"
              >
                <span>
                  {dayLabels[impact.day] ?? impact.day}
                </span>

                <strong>
                  {formatMinutes(actualMinutes)}
                </strong>

                <span>
                  {formatMinutes(limitMinutes)}
                </span>

                <span className="impact-cell-details-impact">
                  +{formatMinutes(
                    impact.magnitude_minutes,
                  )}
                </span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) {
    return `${remainder} min`;
  }

  if (remainder === 0) {
    return `${hours} h`;
  }

  return `${hours} h ${remainder} min`;
}