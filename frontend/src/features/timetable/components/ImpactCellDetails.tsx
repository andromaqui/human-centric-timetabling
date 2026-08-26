import type { HistoricalImpactType } from "../data/historicalStakeholderImpact";
import "./ImpactCellDetails.css";

type ImpactCellDetailsProps = {
  impactType: HistoricalImpactType;
  semester: string;
  stakeholderName: string;
};

export function ImpactCellDetails({
  impactType,
  semester,
}: ImpactCellDetailsProps) {
  const isLunchBreak =
    impactType === "lunch-break-reduced";

  return (
    <div className="impact-cell-details">
      <div className="impact-cell-details-title">
        {semester}
      </div>

      {isLunchBreak ? (
        <>
          <div className="impact-cell-details-columns lunch-break">
            <span>Day</span>
            <span>Lunch received</span>
            <span>Lost</span>
          </div>

          <div className="impact-cell-details-row lunch-break">
            <span>Monday</span>
            <strong>45 min</strong>
            <span className="impact-cell-details-impact">
              −15 min
            </span>
          </div>

          <div className="impact-cell-details-row lunch-break">
            <span>Tuesday</span>
            <strong>30 min</strong>
            <span className="impact-cell-details-impact">
              −30 min
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="impact-cell-details-columns daily-hours">
            <span>Day</span>
            <span>Teaching hours</span>
            <span>Limit</span>
            <span>Over</span>
          </div>

          <div className="impact-cell-details-row daily-hours">
            <span>Monday</span>
            <strong>6 h</strong>
            <span>4 h</span>
            <span className="impact-cell-details-impact">
              +2 h
            </span>
          </div>

          <div className="impact-cell-details-row daily-hours">
            <span>Tuesday</span>
            <strong>5 h</strong>
            <span>4 h</span>
            <span className="impact-cell-details-impact">
              +1 h
            </span>
          </div>
        </>
      )}
    </div>
  );
}