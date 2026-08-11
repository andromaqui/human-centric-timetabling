import { useState } from "react";
import { api } from "../../../shared/api/client";
import type { ConstraintDefinition } from "../types";
import "./ConstraintDetailsModal.css";

type RelaxationOut = {
  id: string;
  instance_type: string;
  instance_id: string;
  relaxation_type: "disable" | "adjust";
  details: Record<string, unknown> | null;
  reason: string;
};

export type LeafRow = {
  key: string;
  label: string;
  groupLabel: string | null;
  infoText: string;
  instanceType: "session" | "lecturer" | "cohort" | "room";
  instanceId: string;
  isActivated: boolean;
  relaxation: RelaxationOut | null;
  equipmentOptions?: string[];
};

type Props = {
  constraint: ConstraintDefinition;
  leaf: LeafRow;
  onClose: () => void;
  onUpdate: (leaf: LeafRow) => void;
};

type EquipmentField = { kind: "equipment" };
type NumberField = { kind: "number"; field: string; label: string };
type SlotsField = { kind: "slots" };
type DetailField = EquipmentField | NumberField | SlotsField;

const DETAIL_FIELD: Record<string, DetailField> = {
  "class-equipment": { kind: "equipment" },
  "class-capacity": { kind: "number", field: "reduced_capacity", label: "Reduced capacity" },
  "cohort-max-teaching-hours-per-day": { kind: "number", field: "max_hours", label: "Max hours" },
  "lecturer-max-one-hour-per-day": { kind: "number", field: "max_hours", label: "Max hours" },
  "lecturer-lunch-break": { kind: "number", field: "lunch_hour", label: "Lunch hour (24h)" },
  "lecturer-unavailability": { kind: "slots" },
};

export function ConstraintDetailsModal({ constraint, leaf, onClose, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [draftEquipment, setDraftEquipment] = useState<string[]>([]);
  const [draftNumber, setDraftNumber] = useState<number | "">("");
  const [draftSlots, setDraftSlots] = useState("");

  const field = DETAIL_FIELD[constraint.id];
  const canRelax = constraint.type === "relaxable";

  async function toggleActivation() {
    const action = leaf.isActivated ? "deactivate" : "activate";
    await api.patch(`/constraint-instances/${leaf.instanceType}/${leaf.instanceId}/${action}`);
    onUpdate({
      ...leaf,
      isActivated: !leaf.isActivated,
      relaxation: action === "deactivate" ? null : leaf.relaxation,
    });
  }

  function startRelaxation() {
    setDraftEquipment([]);
    setDraftNumber("");
    setDraftSlots("");
    setEditing(true);
  }

  async function saveRelaxation() {
    if (!field) return;

    let details: Record<string, unknown>;
    if (field.kind === "equipment") {
      details = { waived_equipment: draftEquipment };
    } else if (field.kind === "number") {
      details = { [field.field]: Number(draftNumber) };
    } else {
      const overridden_slots = draftSlots
        .split(",")
        .map((pair) => pair.trim())
        .filter(Boolean)
        .map((pair) => {
          const [day, hour] = pair.split(":").map((s) => s.trim());
          return { day, hour: Number(hour) };
        });
      details = { overridden_slots };
    }

    const relaxation = await api.post<RelaxationOut>("/relaxations/", {
      instance_type: leaf.instanceType,
      instance_id: leaf.instanceId,
      relaxation_type: "adjust",
      details,
      reason: "",
    });

    onUpdate({ ...leaf, relaxation });
    setEditing(false);
  }

  async function deleteRelaxation() {
    if (!leaf.relaxation) return;
    await api.delete(`/relaxations/${leaf.relaxation.id}`);
    onUpdate({ ...leaf, relaxation: null });
  }

  function renderBadge() {
    if (!leaf.isActivated) return <span className="status-badge disabled">Disabled</span>;
    if (leaf.relaxation) {
      return (
        <span className="status-badge relaxed">
          Relaxed: {JSON.stringify(leaf.relaxation.details)}
        </span>
      );
    }
    return <span className="status-badge active">Active</span>;
  }

  return (
    <div className="constraint-modal-backdrop">
      <div className="constraint-modal">
        <div className="constraint-modal-header">
          <div className="constraint-modal-title-row">
            <h2>{constraint.name}</h2>
            <span className={`constraint-type-badge ${constraint.type}`}>
              {constraint.type === "unrelaxable" ? "Unrelaxable" : "Relaxable"}
            </span>
          </div>
          <button onClick={onClose} className="constraint-modal-close">
            ×
          </button>
        </div>

        {constraint.description && (
          <p className="constraint-modal-description">{constraint.description}</p>
        )}

        <div className="constraint-detail-list">
          <div className="constraint-detail-row">
            <div className="constraint-row-main">
              <strong>{leaf.groupLabel ? `${leaf.groupLabel} · ${leaf.label}` : leaf.label}</strong>
              {leaf.infoText && <span>{leaf.infoText}</span>}
              {renderBadge()}
            </div>

            {!editing && (
              <div className="constraint-row-actions">
                <button className="secondary-action-button" onClick={toggleActivation}>
                  {leaf.isActivated ? "Temporarily disable constraint" : "Reactivate constraint"}
                </button>

                {canRelax &&
                  (leaf.relaxation ? (
                    <button className="secondary-action-button" onClick={deleteRelaxation}>
                      Remove relaxation
                    </button>
                  ) : (
                    <button
                      className="primary-action-button"
                      onClick={startRelaxation}
                      disabled={!leaf.isActivated}
                    >
                      Define relaxation
                    </button>
                  ))}
              </div>
            )}

            {canRelax && editing && field && (
              <div className="relaxation-editor">
                <h3>Define relaxation</h3>

                {field.kind === "equipment" && (
                  <>
                    <p>Select equipment that is not required.</p>
                    <div className="relaxation-chip-list">
                      {(leaf.equipmentOptions ?? []).map((item) => (
                        <button
                          key={item}
                          className={
                            draftEquipment.includes(item)
                              ? "relaxation-chip selected"
                              : "relaxation-chip"
                          }
                          onClick={() =>
                            setDraftEquipment((prev) =>
                              prev.includes(item)
                                ? prev.filter((e) => e !== item)
                                : [...prev, item]
                            )
                          }
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {field.kind === "number" && (
                  <label className="relaxation-reason">
                    {field.label}
                    <input
                      type="number"
                      value={draftNumber}
                      onChange={(e) =>
                        setDraftNumber(e.target.value === "" ? "" : Number(e.target.value))
                      }
                    />
                  </label>
                )}

                {field.kind === "slots" && (
                  <label className="relaxation-reason">
                    Override slots (format: day:hour, day:hour)
                    <input
                      type="text"
                      placeholder="fri:9, fri:10"
                      value={draftSlots}
                      onChange={(e) => setDraftSlots(e.target.value)}
                    />
                  </label>
                )}

                <div className="relaxation-actions">
                  <button className="secondary-action-button" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                  <button className="primary-action-button" onClick={saveRelaxation}>
                    Save relaxation
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}