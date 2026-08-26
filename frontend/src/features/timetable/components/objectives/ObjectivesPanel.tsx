import type { Objective, ObjectiveStakeholder } from "../types"; // adjust path to wherever these types live
import "./ObjectivesPanel.css";

type ObjectivesPanelProps = {
  objectives: Objective[];
  onWeightChange: (id: string, weight: number) => void;
  onToggle: (id: string) => void;
};

const objectiveStakeholders: ObjectiveStakeholder[] = [
  "Lecturer",
  "Cohort",
  "Room",
  "General",
];

export function ObjectivesPanel({
  objectives,
  onWeightChange,
  onToggle,
}: ObjectivesPanelProps) {
  return (
    <>
      <h2>Priorities</h2>
      <p className="step-description">
        Set how much each objective matters to the solver, from 1 (low) to 100 (high).
      </p>

      <div className="objective-groups">
        {objectiveStakeholders.map((stakeholder) => {
          const stakeholderObjectives = objectives.filter(
            (objective) => objective.stakeholder === stakeholder,
          );

          return (
            <section key={stakeholder} className="objective-group">
              <div className="objective-group-heading">
                <h3>{stakeholder} objectives</h3>
                <span>{stakeholderObjectives.length}</span>
              </div>

              <div className="objective-list">
                {stakeholderObjectives.map((objective) => (
                  <div
                    key={objective.id}
                    className={
                      objective.enabled
                        ? "objective-row"
                        : "objective-row objective-disabled"
                    }
                  >
                    <div className="objective-details">
                      <span className="objective-label">{objective.label}</span>

                      <label className="objective-toggle">
                        <input
                          type="checkbox"
                          checked={objective.enabled}
                          onChange={() => onToggle(objective.id)}
                        />
                        <span>{objective.enabled ? "Enabled" : "Disabled"}</span>
                      </label>
                    </div>

                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={objective.weight}
                      disabled={!objective.enabled}
                      onChange={(event) =>
                        onWeightChange(objective.id, Number(event.target.value))
                      }
                      className="objective-slider"
                    />

                    <span className="objective-weight">
                      {objective.enabled ? objective.weight : "Off"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}