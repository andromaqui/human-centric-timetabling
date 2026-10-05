import { useState } from "react";

import { useTimetableData } from "../hooks/useTimetableData";
import { mapSessionsToCalendarEvents } from "../utils/calendarMappers";
import { TimetableView } from "./TimetableView";

import {
  resetTempTimetable,
  loadStudySeed,
  type StudySeed,
} from "../../../shared/api/timetableApi";

import "./TimetableCalendar.css";

const STUDY_SEEDS: {
  id: StudySeed;
  label: string;
}[] = [
  {
    id: "main",
    label: "Main / Development",
  },
  {
    id: "explanations",
    label: "Concrete Explainability",
  },
  {
    id: "any-explanations",
    label: "ANY / FIND Explainability",
  },
];

export function TimetableCalendar() {
  const [showStudySetup, setShowStudySetup] = useState(false);

  const [selectedSeed, setSelectedSeed] =
    useState<StudySeed>("main");

  const [isLoadingSeed, setIsLoadingSeed] =
    useState(false);

  const { data, error } = useTimetableData();

  async function handleReset() {
    await resetTempTimetable();
    window.location.reload();
  }

  async function handleLoadSeed() {
    console.log("Load dataset clicked");
    console.log("Selected seed:", selectedSeed);

    setIsLoadingSeed(true);

    try {
      console.log("Calling /study/load-seed...");

      const result = await loadStudySeed(selectedSeed);

      console.log("Study seed loaded:", result);

      window.location.reload();
    } catch (error) {
      console.error(
        "Failed to load study dataset:",
        error,
      );

      alert(
        error instanceof Error
          ? error.message
          : "Failed to load study dataset.",
      );
    } finally {
      setIsLoadingSeed(false);
    }
  }

  if (error) {
    return (
      <section className="timetable-shell">
        <div className="timetable-header">
          <p className="timetable-eyebrow">
            Timetable
          </p>

          <h1 className="timetable-title">
            University Timetable
          </h1>
        </div>

        <p className="timetable-error">
          Failed to load timetable: {error.message}
        </p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="timetable-shell">
        <div className="timetable-header">
          <p className="timetable-eyebrow">
            Timetable
          </p>

          <h1 className="timetable-title">
            University Timetable
          </h1>
        </div>

        <p className="timetable-loading">
          Loading timetable…
        </p>
      </section>
    );
  }

  const events = mapSessionsToCalendarEvents(
    data.sessions,
    data.modules,
    data.lecturers,
    data.programs,
    data.cohorts,
  );

  return (
    <>
      <div className="study-toolbar">
        <div className="study-setup-wrapper">
          <button
            type="button"
            className="study-setup-trigger"
            onClick={() =>
              setShowStudySetup(
                (current) => !current,
              )
            }
            aria-expanded={showStudySetup}
          >
            ⚙ Study setup
          </button>

          {showStudySetup && (
            <div className="study-setup-panel">
              <div className="study-setup-panel-header">
                <strong>Study dataset</strong>

                <button
                  type="button"
                  className="study-setup-close"
                  onClick={() =>
                    setShowStudySetup(false)
                  }
                  aria-label="Close study setup"
                >
                  ×
                </button>
              </div>

              <p className="study-setup-description">
                Select the dataset to use for the
                current study section.
              </p>

              <div className="study-seed-options">
                {STUDY_SEEDS.map((seed) => (
                  <label
                    key={seed.id}
                    className={[
                      "study-seed-option",
                      selectedSeed === seed.id
                        ? "is-selected"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <input
                      type="radio"
                      name="study-seed"
                      value={seed.id}
                      checked={
                        selectedSeed === seed.id
                      }
                      onChange={() =>
                        setSelectedSeed(seed.id)
                      }
                    />

                    <span>{seed.label}</span>
                  </label>
                ))}
              </div>

              <div className="study-setup-actions">
                <button
                  type="button"
                  className="study-load-button"
                  disabled={isLoadingSeed}
                  onClick={handleLoadSeed}
                >
                  {isLoadingSeed
                    ? "Loading…"
                    : "Load dataset"}
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="timetable-reset-button"
          onClick={handleReset}
        >
          Reset timetable
        </button>
      </div>

      <TimetableView
        events={events}
        showHeader
        eyebrow="Timetable"
        title="University Timetable"
        showLegend
        showFilters
        showWeekHeading
        showLecturerAvailability
      />
    </>
  );
}