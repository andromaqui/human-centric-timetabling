import "./RequestedChangeSummary.css";

type RequestedChangeSummaryProps = {
  originalTime: string;
  requestedTime: string;

  originalRoom: string;
  requestedRoom: string;

  originalLecturer: string;
  requestedLecturer: string;

  rescheduleScope: string;

  variant?: "default" | "embedded";
};

export function RequestedChangeSummary({
  originalTime,
  requestedTime,
  originalRoom,
  requestedRoom,
  originalLecturer,
  requestedLecturer,
  rescheduleScope,
  variant = "default",
}: RequestedChangeSummaryProps) {
  const isEmbedded = variant === "embedded";

  return (
    <section
      className={`requested-change-summary ${
        isEmbedded ? "requested-change-summary--embedded" : ""
      }`}
      style={
        isEmbedded
          ? {
              margin: 0,
              padding: 0,
              border: "none",
              borderRadius: 0,
              background: "transparent",
              boxShadow: "none",
            }
          : undefined
      }
    >
      <div className="requested-change-summary-heading">
        <span className="requested-change-summary-eyebrow">
          {isEmbedded ? "Requested change" : "Your request"}
        </span>

        {!isEmbedded && <h3>Requested timetable change</h3>}
      </div>

      <div className="requested-change-summary-list">
        <div className="requested-change-summary-row">
          <span className="requested-change-summary-label">
            Time
          </span>

          <div className="requested-change-summary-values">
            <span>{originalTime}</span>
            <span className="requested-change-summary-arrow">
              →
            </span>
            <strong>{requestedTime}</strong>
          </div>
        </div>

        <div className="requested-change-summary-row">
          <span className="requested-change-summary-label">
            Room
          </span>

          <div className="requested-change-summary-values">
            <span>{originalRoom}</span>
            <span className="requested-change-summary-arrow">
              →
            </span>
            <strong>{requestedRoom}</strong>
          </div>
        </div>

        <div className="requested-change-summary-row">
          <span className="requested-change-summary-label">
            Lecturer
          </span>

          <div className="requested-change-summary-values">
            <span>{originalLecturer}</span>
            <span className="requested-change-summary-arrow">
              →
            </span>
            <strong>{requestedLecturer}</strong>
          </div>
        </div>
      </div>

      <div className="requested-change-summary-scope">
        <span>Rearrangement allowance</span>
        <strong>{rescheduleScope}</strong>
      </div>
    </section>
  );
}
