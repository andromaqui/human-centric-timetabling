import { useEffect, useState } from "react";
import {
  ChevronRight,
  UserCheck,
  CalendarX,
  Coffee,
  Clock,
  Users,
  DoorClosed,
  Monitor,
  Armchair,
  GraduationCap,
  UsersRound,
  Building2,
} from "lucide-react";

import { api } from "../../../shared/api/client";
import { timetableData } from "../../timetable/data/timetableData";
import type { ConstraintDefinition } from "../types";
import { ConstraintDetailsModal } from "./ConstraintDetailsModal";
import "./ConstraintsPage.css";

const stakeholders = ["Lecturer", "Cohort", "Session", "Room"] as const;

const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};

// constraints whose entities unfold one level further into per-day rows —
// mirrors DAY_SCOPED_LECTURER_CONSTRAINTS / DAY_SCOPED_COHORT_CONSTRAINTS in
// backend/app/constraint_logic.py. Hardcoded rather than derived at render
// time so the extra spacing is guaranteed regardless of what the entity data
// happens to look like.
const FOLDABLE_CONSTRAINT_IDS = new Set([
  "lecturer-max-one-hour-per-day",
  "lecturer-lunch-break",
  "cohort-max-teaching-hours-per-day",
]);

// the complement of FOLDABLE_CONSTRAINT_IDS: constraints whose entities are
// flat leaf rows with no extra fold level. These need extra space right
// between the constraint's header button and its .constraint-bar-content,
// since without a fold layer in between the rows sit visually too close to
// the constraint header itself.
const FLAT_CONSTRAINT_IDS = new Set([
  "lecturer-one-class-at-time",
  "lecturer-unavailability",
  "class-equipment",
  "class-capacity",
  "room-one-booking-at-time",
]);

type RelaxationOut = {
  id: string;
  instance_type: string;
  instance_id: string;
  relaxation_type: "disable" | "adjust";
  details: Record<string, unknown> | null;
  reason: string;
};

type LeafRow = {
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

type EntityGroup = {
  key: string;
  label: string;
  isDayScoped: boolean;
  isOpen: boolean;
  // when not day-scoped, exactly one leaf; when day-scoped, one leaf per day
  leaves: LeafRow[];
};

async function fetchRelaxation(
  instanceType: LeafRow["instanceType"],
  instanceId: string
): Promise<RelaxationOut | null> {
  const relaxations = await api.get<RelaxationOut[]>(
    `/relaxations/?instance_type=${instanceType}&instance_id=${instanceId}`
  );
  return relaxations[0] ?? null;
}

export function ConstraintsPage() {
  const [constraints, setConstraints] = useState<ConstraintDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openStakeholders, setOpenStakeholders] = useState<Set<string>>(
    new Set(["Lecturer"])
  );
  const [openConstraints, setOpenConstraints] = useState<Set<string>>(new Set());
  const [entitiesByConstraint, setEntitiesByConstraint] = useState<
    Record<string, EntityGroup[]>
  >({});
  const [loadingConstraint, setLoadingConstraint] = useState<string | null>(null);

  const [selectedLeaf, setSelectedLeaf] = useState<{
    constraint: ConstraintDefinition;
    leaf: LeafRow;
  } | null>(null);

  useEffect(() => {
    api
      .get<ConstraintDefinition[]>("/constraints/")
      .then(setConstraints)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const groupedConstraints = stakeholders.map((stakeholder) => ({
    stakeholder,
    constraints: constraints.filter((c) => c.stakeholder === stakeholder),
  }));

  const stakeholderMeta = {
    Lecturer: { Icon: GraduationCap, description: "Rules related to lecturer availability and workload." },
    Cohort: { Icon: UsersRound, description: "Rules for cohort workload and daily limits." },
    Session: { Icon: Building2, description: "Rules related to equipment and capacity." },
    Room: { Icon: DoorClosed, description: "Rules related to room booking availability." },
  };

  function getConstraintIcon(constraintId: string) {
    switch (constraintId) {
      case "lecturer-one-class-at-time":
        return UserCheck;
      case "lecturer-unavailability":
        return CalendarX;
      case "lecturer-lunch-break":
        return Coffee;
      case "lecturer-max-one-hour-per-day":
        return Clock;
      case "cohort-max-teaching-hours-per-day":
        return Users;
      case "room-one-booking-at-time":
        return DoorClosed;
      case "class-equipment":
        return Monitor;
      case "class-capacity":
        return Armchair;
      default:
        return Clock;
    }
  }

  function toggleStakeholder(stakeholder: string) {
    setOpenStakeholders((prev) => {
      const next = new Set(prev);
      next.has(stakeholder) ? next.delete(stakeholder) : next.add(stakeholder);
      return next;
    });
  }

  async function loadEntitiesForConstraint(constraint: ConstraintDefinition) {
    setLoadingConstraint(constraint.id);
    const groups: EntityGroup[] = [];

    if (constraint.stakeholder === "Lecturer") {
      const lecturers = await api.get<{ id: string; name: string }[]>("/lecturers/");
      for (const lecturer of lecturers) {
        const instances = await api.get<
          { id: string; constraint_id: string; day: string | null; is_activated: boolean }[]
        >(`/lecturers/${lecturer.id}/constraints`);
        const matches = instances.filter((i) => i.constraint_id === constraint.id);
        if (matches.length === 0) continue;

        const isDayScoped = matches.some((m) => m.day !== null);
        const leaves = await Promise.all(
          matches.map(async (instance) => ({
            key: instance.id,
            label: isDayScoped ? DAY_LABELS[instance.day as string] : lecturer.name,
            groupLabel: isDayScoped ? lecturer.name : null,
            infoText: "",
            instanceType: "lecturer" as const,
            instanceId: instance.id,
            isActivated: instance.is_activated,
            relaxation: await fetchRelaxation("lecturer", instance.id),
          }))
        );

        groups.push({ key: lecturer.id, label: lecturer.name, isDayScoped, isOpen: false, leaves });
      }
    }

    if (constraint.stakeholder === "Cohort") {
      const cohorts = await api.get<{ id: string; name: string }[]>("/cohorts/");
      for (const cohort of cohorts) {
        const instances = await api.get<
          { id: string; constraint_id: string; day: string | null; is_activated: boolean }[]
        >(`/cohorts/${cohort.id}/constraints`);
        const matches = instances.filter((i) => i.constraint_id === constraint.id);
        if (matches.length === 0) continue;

        const isDayScoped = matches.some((m) => m.day !== null);
        const leaves = await Promise.all(
          matches.map(async (instance) => ({
            key: instance.id,
            label: isDayScoped ? DAY_LABELS[instance.day as string] : cohort.name,
            groupLabel: isDayScoped ? cohort.name : null,
            infoText: "",
            instanceType: "cohort" as const,
            instanceId: instance.id,
            isActivated: instance.is_activated,
            relaxation: await fetchRelaxation("cohort", instance.id),
          }))
        );

        groups.push({ key: cohort.id, label: cohort.name, isDayScoped, isOpen: false, leaves });
      }
    }

    if (constraint.stakeholder === "Session" && (constraint.id === "class-equipment" || constraint.id === "class-capacity")) {
      const sessions = await api.get<{ id: string; module_id: string }[]>("/sessions/");
      for (const module of timetableData.modules) {
        const session = sessions.find((s) => s.module_id === module.id);
        if (!session) continue;

        const instances = await api.get<
          { id: string; constraint_id: string; is_activated: boolean }[]
        >(`/sessions/${session.id}/constraints`);
        const instance = instances.find((i) => i.constraint_id === constraint.id);
        if (!instance) continue;

        const infoText =
          constraint.id === "class-equipment"
            ? `Needs: ${(module.requiredEquipment ?? []).join(", ") || "None"}`
            : `Requires at least ${module.requiredCapacity ?? "?"} seats`;

        const leaf: LeafRow = {
          key: instance.id,
          label: `${module.code} · ${module.title}`,
          groupLabel: null,
          infoText,
          instanceType: "session",
          instanceId: instance.id,
          isActivated: instance.is_activated,
          relaxation: await fetchRelaxation("session", instance.id),
          equipmentOptions: module.requiredEquipment ?? [],
        };

        groups.push({ key: module.id, label: leaf.label, isDayScoped: false, isOpen: false, leaves: [leaf] });
      }
    }

    if (constraint.id === "room-one-booking-at-time") {
      const rooms = await api.get<{ id: string; name: string }[]>("/rooms/");
      for (const room of rooms) {
        const instances = await api.get<
          { id: string; constraint_id: string; is_activated: boolean }[]
        >(`/rooms/${room.id}/constraints`);
        const instance = instances.find((i) => i.constraint_id === constraint.id);
        if (!instance) continue;

        const leaf: LeafRow = {
          key: instance.id,
          label: room.name,
          groupLabel: null,
          infoText: "",
          instanceType: "room",
          instanceId: instance.id,
          isActivated: instance.is_activated,
          relaxation: await fetchRelaxation("room", instance.id),
        };

        groups.push({ key: room.id, label: room.name, isDayScoped: false, isOpen: false, leaves: [leaf] });
      }
    }

    setEntitiesByConstraint((prev) => ({ ...prev, [constraint.id]: groups }));
    setLoadingConstraint(null);
  }

  function toggleConstraint(constraint: ConstraintDefinition) {
    const isOpen = openConstraints.has(constraint.id);
    setOpenConstraints((prev) => {
      const next = new Set(prev);
      isOpen ? next.delete(constraint.id) : next.add(constraint.id);
      return next;
    });
    if (!isOpen && !entitiesByConstraint[constraint.id]) {
      loadEntitiesForConstraint(constraint);
    }
  }

  function toggleEntity(constraintId: string, entityKey: string) {
    setEntitiesByConstraint((prev) => ({
      ...prev,
      [constraintId]: prev[constraintId].map((g) =>
        g.key === entityKey ? { ...g, isOpen: !g.isOpen } : g
      ),
    }));
  }

  function renderLeafBadge(leaf: LeafRow) {
    if (!leaf.isActivated) return <span className="status-badge disabled">Disabled</span>;
    if (leaf.relaxation) return <span className="status-badge relaxed">Relaxed</span>;
    return <span className="status-badge active">Active</span>;
  }

  // relaxable rows are clickable and open the modal ("Preview constraint" link on the right);
  // unrelaxable rows are plain, non-interactive, and don't show the active/disabled badge here
  // (that's only surfaced inside the modal, which unrelaxable rows no longer open).
  function renderClickableLeafRow(constraint: ConstraintDefinition, leaf: LeafRow) {
    if (constraint.type !== "relaxable") {
      return (
        <div key={leaf.key} className="constraint-detail-row">
          <div className="constraint-row-main">
            <strong>{leaf.label}</strong>
            {leaf.infoText && <span>{leaf.infoText}</span>}
          </div>
        </div>
      );
    }

    return (
      <button
        key={leaf.key}
        className="constraint-detail-row constraint-detail-row-clickable"
        onClick={() => setSelectedLeaf({ constraint, leaf })}
      >
        <div className="constraint-row-main">
          <strong>{leaf.label}</strong>
          {leaf.infoText && <span>{leaf.infoText}</span>}
          {renderLeafBadge(leaf)}
        </div>
        <span className="preview-constraint-link">Preview constraint</span>
      </button>
    );
  }

  function renderEntityGroup(constraint: ConstraintDefinition, group: EntityGroup) {
    // non-day-scoped: single leaf, no extra fold — render the leaf directly as the entity row
    if (!group.isDayScoped) {
      const leaf = group.leaves[0];
      return renderClickableLeafRow(constraint, leaf);
    }

    // day-scoped: entity is a fold, days are the leaves inside
    return (
      <div key={group.key} className="constraint-bar constraint-bar-nested">
        <button
          type="button"
          className="constraint-bar-header"
          onClick={() => toggleEntity(constraint.id, group.key)}
          aria-expanded={group.isOpen}
        >
          <div className="constraint-bar-header-main">
            <span className="constraint-bar-chevron">
              <ChevronRight
                size={14}
                style={{
                  transform: group.isOpen ? "rotate(90deg)" : "none",
                  transition: "transform 150ms ease",
                }}
              />
            </span>
            <span className="constraint-bar-copy">
              <h2>{group.label}</h2>
            </span>
          </div>
        </button>

        {group.isOpen && (
          <div className="constraint-bar-content">
            {group.leaves.map((leaf) => renderClickableLeafRow(constraint, leaf))}
          </div>
        )}
      </div>
    );
  }

  if (loading) return <p className="constraints-loading">Loading constraints…</p>;
  if (error) return <p className="constraints-error">Couldn't load constraints: {error}</p>;

  return (
    <section className="constraints-page">
      <div className="constraints-header">
        <h1>Constraints</h1>
        <p>
          Browse scheduling rules by stakeholder. Expand a constraint to see and manage each
          instance it applies to.
        </p>
      </div>

      <div className="constraint-bar-list">
        {groupedConstraints.map((group) => {
          const meta = stakeholderMeta[group.stakeholder];
          const isOpen = openStakeholders.has(group.stakeholder);

          return (
            <div key={group.stakeholder} className="constraint-bar">
              <button
                type="button"
                className="constraint-bar-header"
                onClick={() => toggleStakeholder(group.stakeholder)}
                aria-expanded={isOpen}
              >
                <div className="constraint-bar-header-main">
                  <span className="constraint-bar-chevron">
                    <ChevronRight
                      size={16}
                      style={{
                        transform: isOpen ? "rotate(90deg)" : "none",
                        transition: "transform 150ms ease",
                      }}
                    />
                  </span>
                  <div className="constraint-bar-copy">
                    <h2>{group.stakeholder}</h2>
                    <p>{meta.description}</p>
                  </div>
                </div>
                <span className="constraint-bar-count">
                  {group.constraints.length} {group.constraints.length === 1 ? "rule" : "rules"}
                </span>
              </button>

              {isOpen && (
                <div className="constraint-bar-content">
                  {group.constraints.map((constraint) => {
                    const Icon = getConstraintIcon(constraint.id);
                    const isConstraintOpen = openConstraints.has(constraint.id);
                    const entities = entitiesByConstraint[constraint.id];

                    return (
                      <div key={constraint.id} className="constraint-bar constraint-bar-nested">
                        <button
                          type="button"
                          className="constraint-row"
                          onClick={() => toggleConstraint(constraint)}
                          aria-expanded={isConstraintOpen}
                        >
                          <span className="constraint-row-main">
                            <span className="constraint-row-chevron">
                              <ChevronRight
                                size={14}
                                style={{
                                  transform: isConstraintOpen ? "rotate(90deg)" : "none",
                                  transition: "transform 150ms ease",
                                }}
                              />
                            </span>
                            <Icon size={16} className="constraint-row-icon" />
                            {constraint.name}
                          </span>
                          <span className={`constraint-type-badge ${constraint.type}`}>
                            {constraint.type === "unrelaxable" ? "Unrelaxable" : "Relaxable"}
                          </span>
                        </button>

                        {isConstraintOpen && (
                          <div
                            className={
                              FOLDABLE_CONSTRAINT_IDS.has(constraint.id)
                                ? "constraint-bar-content constraint-bar-content-foldable"
                                : FLAT_CONSTRAINT_IDS.has(constraint.id)
                                ? "constraint-bar-content constraint-bar-content-flat"
                                : "constraint-bar-content"
                            }
                          >
                            {loadingConstraint === constraint.id && (
                              <p className="constraint-empty-state">Loading…</p>
                            )}
                            {entities?.length === 0 && (
                              <p className="constraint-empty-state">No data found.</p>
                            )}
                            {entities?.map((entityGroup) =>
                              renderEntityGroup(constraint, entityGroup)
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="constraints-note">
        <span className="constraints-note-icon">i</span>
        <p>
          Unrelaxable constraints must never be violated. Relaxable constraints are preferred but
          can be temporarily relaxed when necessary.
        </p>
      </div>

      {selectedLeaf && (
        <ConstraintDetailsModal
          constraint={selectedLeaf.constraint}
          leaf={selectedLeaf.leaf}
          onClose={() => setSelectedLeaf(null)}
          onUpdate={(updatedLeaf) => {
            // reflect the change back into the page's own state so re-opening
            // shows the latest activation/relaxation without a full reload
            setEntitiesByConstraint((prev) => {
              const groups = prev[selectedLeaf.constraint.id] ?? [];
              return {
                ...prev,
                [selectedLeaf.constraint.id]: groups.map((g) => ({
                  ...g,
                  leaves: g.leaves.map((l) => (l.key === updatedLeaf.key ? updatedLeaf : l)),
                })),
              };
            });
            setSelectedLeaf((current) =>
              current ? { ...current, leaf: updatedLeaf } : current
            );
          }}
        />
      )}
    </section>
  );
}