import { Link } from "react-router-dom";
import type { Module, Session } from "../types";
import "./MiniTimetablePreview.css";

type MiniTimetablePreviewProps = {
  title: string;
  busySlots: string[];
  selectedSlots: string[];
  fullTimetableLink: string;
};

const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const times = ["09", "10", "11", "12", "13", "14", "15", "16", "17"];

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

        <Link to={fullTimetableLink} target="_blank" className="mini-timetable-link">
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
              {time}
            </div>

            {days.map((day) => {
              const slotId = `${day.toLowerCase()}-${time}`;
              const isUnavailable = unavailableSlots.includes(slotId);
              const isSelected = selectedSlots.includes(slotId);
              const isBusy = busySlots.includes(slotId) && !isSelected;

              return (
                <div
                  key={`${day}-${time}`}
                  className={[
                    "mini-cell",
                    isBusy ? "busy" : "",
                    isUnavailable ? "unavailable" : "",
                    isSelected ? "selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  title={
                      isSelected
                        ? "Selected class"
                        : isUnavailable
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
          <i className="legend-selected" /> Selected class
        </span>
        <span>
          <i className="legend-busy" /> Busy
        </span>
        <span>
          <i className="legend-unavailable" /> Unavailable
        </span>
      </div>
    </div>
  );
}