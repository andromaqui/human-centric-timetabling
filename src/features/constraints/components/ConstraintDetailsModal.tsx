import { useState } from "react";
import { timetableData } from "../../timetable/data/timetableData";
import type { Module } from "../../timetable/types";
import type { ConstraintDefinition } from "../types";
import "./ConstraintDetailsModal.css";

type Props = {
  constraint: ConstraintDefinition;
  onClose: () => void;
};

type RelaxationDraft = {
  moduleId: string;
  relaxedEquipment: string[];
  reason: string;
};

export function ConstraintDetailsModal({ constraint, onClose }: Props) {
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RelaxationDraft | null>(null);
  const [savedRelaxations, setSavedRelaxations] = useState<RelaxationDraft[]>([]);

  function startEquipmentRelaxation(module: Module) {
    setEditingModuleId(module.id);
    setDraft({
      moduleId: module.id,
      relaxedEquipment: [],
      reason: "",
    });
  }

  function toggleEquipment(equipment: string) {
    if (!draft) return;

    setDraft({
      ...draft,
      relaxedEquipment: draft.relaxedEquipment.includes(equipment)
        ? draft.relaxedEquipment.filter((item) => item !== equipment)
        : [...draft.relaxedEquipment, equipment],
    });
  }

  function saveRelaxation() {
    if (!draft) return;

    setSavedRelaxations((current) => [
      ...current.filter((item) => item.moduleId !== draft.moduleId),
      draft,
    ]);

    setEditingModuleId(null);
    setDraft(null);
  }

  function renderEquipmentRow(module: Module) {
    const equipment = module.requiredEquipment ?? [];
    const saved = savedRelaxations.find((item) => item.moduleId === module.id);
    const isEditing = editingModuleId === module.id;

    return (
      <div key={module.id} className="constraint-detail-row">
        <div className="constraint-row-main">
          <strong>
            {module.code} · {module.title}
          </strong>

          <span>Needs: {equipment.join(", ") || "None"}</span>

          {saved && saved.relaxedEquipment.length > 0 && (
            <div className="saved-relaxation">
              Relaxed for this class: {saved.relaxedEquipment.join(", ")}
            </div>
          )}
        </div>

        {!isEditing && (
          <div className="constraint-row-actions">
            <button className="secondary-action-button">
              Temporarily disable constraint
            </button>

            <button
              className="primary-action-button"
              onClick={() => startEquipmentRelaxation(module)}
            >
              Define relaxation
            </button>
          </div>
        )}

        {isEditing && draft && (
          <div className="relaxation-editor">
            <h3>Relax equipment requirement</h3>

            <p>Select equipment that is not required for this class.</p>

            <div className="relaxation-chip-list">
              {equipment.map((item) => {
                const selected = draft.relaxedEquipment.includes(item);

                return (
                  <button
                    key={item}
                    className={
                      selected
                        ? "relaxation-chip selected"
                        : "relaxation-chip"
                    }
                    onClick={() => toggleEquipment(item)}
                  >
                    {item}
                  </button>
                );
              })}
            </div>

            <label className="relaxation-reason">
              Reason
              <textarea
                value={draft.reason}
                onChange={(event) =>
                  setDraft({ ...draft, reason: event.target.value })
                }
                placeholder="Example: Projector not needed for this session."
              />
            </label>

            <div className="relaxation-actions">
              <button
                className="secondary-action-button"
                onClick={() => {
                  setEditingModuleId(null);
                  setDraft(null);
                }}
              >
                Cancel
              </button>

              <button className="primary-action-button" onClick={saveRelaxation}>
                Save relaxation
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="constraint-modal-backdrop">
      <div className="constraint-modal">
        <div className="constraint-modal-header">
          <div>

            <div className="constraint-modal-title-row">
              <h2>{constraint.name}</h2>
              <span className="constraint-type-pill">{constraint.type}</span>
            </div>
          </div>

          <button onClick={onClose} className="constraint-modal-close">
            ×
          </button>
        </div>

        {constraint.id === "class-equipment" && (
          <div className="constraint-detail-list">
            {timetableData.modules.map(renderEquipmentRow)}
          </div>
        )}

        {constraint.id === "class-capacity" && (
          <div className="constraint-detail-list">
            {timetableData.modules.map((module) => (
              <div key={module.id} className="constraint-detail-row">
                <div className="constraint-row-main">
                  <strong>
                    {module.code} · {module.title}
                  </strong>
                  <span>
                    Requires at least {module.requiredCapacity ?? "?"} seats
                  </span>
                </div>

                <div className="constraint-row-actions">
                  <button className="secondary-action-button">
                    Temporarily disable constraint
                  </button>

                  <button className="primary-action-button">
                    Define relaxation
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {constraint.id !== "class-equipment" &&
          constraint.id !== "class-capacity" && (
            <p className="constraint-empty-state">
              We have not connected this constraint to timetable data yet.
            </p>
          )}
      </div>
    </div>
  );
}