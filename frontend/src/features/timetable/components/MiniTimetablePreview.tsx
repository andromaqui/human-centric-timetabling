import { Link } from "react-router-dom";
import "./MiniTimetablePreview.css";

type MiniTimetablePreviewProps = {
  title: string;
  busySlots: string[];
  selectedSlots: string[];
  unavailableSlots?: string[];
  fullTimetableLink: string;
};

const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// Each row represents one hour.
// 16:00 is the final row because it covers 16:00–17:00.
const times = ["09", "10", "11", "12", "13", "14", "15", "16"];

export function MiniTimetablePreview({
  title,
  busySlots,
  selectedSlots,
  unavailableSlots = [],
  fullTimetableLink,
}: MiniTimetablePreviewProps) {

  return (
    <div className="mini-timetable-card">
      <div className="mini-timetable-header">
        <h4>{title}</h4>

        <Link
          to={fullTimetableLink}
          target="_blank"
          className="mini-timetable-link"
        >
          Open full timetable ↗
        </Link>
      </div>

      <div className="mini-timetable-grid">
        <div className="mini-timetable-corner" />

        {days.map((day) => (
          <div key={day} className="mini-day-label">
            {day}
          </div>
        ))}

        {times.map((time) => (
          <>
            <div key={`${time}-label`} className="mini-time-label">
              {time}:00
            </div>

            {days.map((day) => {
              const slotId = `${day.toLowerCase()}-${time}`;
              const isUnavailable = unavailableSlots.includes(slotId);
              const isSelected = selectedSlots.includes(slotId);
              const isBusyRaw = busySlots.includes(slotId);

              // Collision states take priority over a plain "selected" cell,
              // so a requested slot that lands on an unavailable/busy slot
              // is still visible instead of being hidden behind solid purple.
              const collidesUnavailable = isSelected && isUnavailable;
              const collidesBusy = isSelected && isBusyRaw && !isUnavailable;
              const isBusy = isBusyRaw && !isSelected;
              const isPlainUnavailable = isUnavailable && !isSelected;
              const isPlainSelected = isSelected && !isUnavailable && !isBusyRaw;

              return (
                <div
                  key={`${day}-${time}`}
                  className={[
                    "mini-cell",
                    isBusy ? "busy" : "",
                    isPlainUnavailable ? "unavailable" : "",
                    isPlainSelected ? "selected" : "",
                    collidesUnavailable ? "selected-unavailable" : "",
                    collidesBusy ? "selected-busy" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  title={
                    collidesUnavailable
                      ? "Requested time collides with unavailability"
                      : collidesBusy
                        ? "Requested time collides with an existing booking"
                        : isPlainSelected
                          ? "Selected class"
                          : isPlainUnavailable
                            ? "Unavailable"
                            : isBusy
                              ? "Busy"
                              : "Available"
                  }
                />
              );
            })}
          </>
        ))}
      </div>

      <div className="mini-timetable-legend">
        <span>
          <i className="legend-selected" />
          Selected class
        </span>

        <span>
          <i className="legend-busy" />
          Busy
        </span>

        <span>
          <i className="legend-unavailable" />
          Unavailable
        </span>

        <span>
          <i className="legend-selected-unavailable" />
          Collides with unavailability
        </span>

        <span>
          <i className="legend-selected-busy" />
          Collides with existing booking
        </span>
      </div>
    </div>
  );
}