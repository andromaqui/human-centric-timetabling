import { useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Clock,
} from "lucide-react";

import "./SchedulingHorizon.css";

export function SchedulingHorizon() {
  const [windowOpen, setWindowOpen] = useState(false);
  const [intervalOpen, setIntervalOpen] = useState(false);

  return (
    <section className="scheduling-horizon-section">
      <div className="scheduling-horizon-heading">
        <h2>Scheduling horizon</h2>
        <p>
          Defines when sessions can be scheduled and which start
          times the scheduler can consider.
        </p>
      </div>

      <div className="constraint-bar-list">
        <div className="constraint-bar constraint-bar-nested">
          <button
            type="button"
            className="constraint-row"
            onClick={() =>
              setWindowOpen((current) => !current)
            }
            aria-expanded={windowOpen}>
            <span className="constraint-row-main">
              <span className="constraint-row-chevron">
                <ChevronRight
                  size={14}
                  style={{
                    transform: windowOpen
                      ? "rotate(90deg)"
                      : "none",
                    transition: "transform 150ms ease",
                  }}
                />
              </span>

              <CalendarDays
                size={16}
                className="constraint-row-icon"
              />

              <span className="scheduling-horizon-rule-title">
                Scheduling window
              </span>
            </span>
          </button>

          {windowOpen && (
            <div className="scheduling-horizon-details">
              <div>
                <span>Days</span>
                <strong>Monday–Friday</strong>
              </div>

              <div>
                <span>Teaching hours</span>
                <strong>09:00–17:00</strong>
              </div>
            </div>
          )}
        </div>

        <div className="constraint-bar constraint-bar-nested">
          <button
            type="button"
            className="constraint-row"
            onClick={() =>
              setIntervalOpen((current) => !current)
            }
            aria-expanded={intervalOpen}
          >
            <span className="constraint-row-main">
              <span className="constraint-row-chevron">
                <ChevronRight
                  size={14}
                  style={{
                    transform: intervalOpen
                      ? "rotate(90deg)"
                      : "none",
                    transition: "transform 150ms ease",
                  }}
                />
              </span>

              <Clock
                size={16}
                className="constraint-row-icon"
              />

              <span className="scheduling-horizon-rule-title">
                Start-time interval
              </span>
            </span>
          </button>

          {intervalOpen && (
            <div className="scheduling-horizon-details">
              <div>
                <span>Interval</span>
                <strong>Every 60 minutes</strong>
              </div>

              <div>
                <span>Possible starts</span>
                <strong>
                  09:00, 10:00, 11:00, 12:00, …
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}