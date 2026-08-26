import { useState } from "react";
import {
  Armchair,
  Building2,
  CalendarX,
  ChevronRight,
  Clock,
  Coffee,
  DoorClosed,
  GraduationCap,
  Monitor,
  UserCheck,
  Users,
  UsersRound,
} from "lucide-react";

import type { ConstraintDefinition } from "../types";
import "./ConstraintsPage.css";

export type ConstraintHierarchyMode = "manage" | "review" | "snapshot";

export type ConstraintHierarchyRelaxation = {
  id: string;
  instance_type: string;
  instance_id: string;
  relaxation_type: "disable" | "adjust";
  details: Record<string, unknown> | null;
  reason: string;
};

export type ConstraintHierarchyLeaf = {
  key: string;
  label: string;
  groupLabel?: string | null;
  infoText: string;
  instanceType: "session" | "lecturer" | "cohort" | "room";
  instanceId: string;
  isActivated: boolean;
  relaxation?: ConstraintHierarchyRelaxation | null;

  /**
   * Optional immutable display state used by saved-solution snapshots.
   * Examples: "Active", "Temporarily deactivated", "Relaxed".
   */
  statusLabel?: string | null;

  equipmentOptions?: string[];
};

export type ConstraintHierarchyEntityGroup = {
  key: string;
  label: string;
  isDayScoped: boolean;
  leaves: ConstraintHierarchyLeaf[];
};

type SelectedLeaf = {
  constraint: ConstraintDefinition;
  leaf: ConstraintHierarchyLeaf;
};

type ConstraintHierarchyProps = {
  constraints: ConstraintDefinition[];
  entitiesByConstraint: Record<string, ConstraintHierarchyEntityGroup[]>;
  mode: ConstraintHierarchyMode;

  loadingConstraint?: string | null;

  /**
   * Manage mode can lazily load the instances the first time a rule is opened.
   * Snapshot/review callers normally pass all data up front.
   */
  onExpandConstraint?: (constraint: ConstraintDefinition) => void;

  /**
   * Only used in manage mode. If omitted, leaves are always read-only.
   */
  onLeafClick?: (selection: SelectedLeaf) => void;

  /**
   * Global page: false (show all rule definitions).
   * Saved solution: true (show only rule definitions that actually have
   * snapshot instances).
   */
  hideEmptyConstraints?: boolean;

  /**
   * Snapshot/detail pages can opt into a compact status summary.
   */
  showStatusSummary?: boolean;

  /**
   * When enabled, renders a checkbox that filters the hierarchy down to
   * temporarily deactivated / relaxed leaves only.
   */
  allowExceptionFilter?: boolean;

  initialOpenStakeholders?: string[];
};

const stakeholders = ["Lecturer", "Cohort", "Session", "Room"] as const;

const stakeholderMeta = {
  Lecturer: {
    description: "Rules related to lecturer availability and workload.",
  },
  Cohort: {
    description: "Rules for cohort workload and daily limits.",
  },
  Session: {
    description: "Rules related to equipment and capacity.",
  },
  Room: {
    description: "Rules related to room booking availability.",
  },
};

const FOLDABLE_CONSTRAINT_IDS = new Set([
  "lecturer-max-one-hour-per-day",
  "lecturer-lunch-break",
  "cohort-max-teaching-hours-per-day",
]);

const FLAT_CONSTRAINT_IDS = new Set([
  "lecturer-one-class-at-time",
  "lecturer-unavailability",
  "class-equipment",
  "class-capacity",
  "room-one-booking-at-time",
]);

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

function statusClass(status: string) {
  const normalized = status.toLowerCase();

  if (
    normalized.includes("deactivated") ||
    normalized.includes("disabled")
  ) {
    return "disabled";
  }

  if (normalized.includes("relax")) {
    return "relaxed";
  }

  return "active";
}

export function ConstraintHierarchy({
  constraints,
  entitiesByConstraint,
  mode,
  loadingConstraint = null,
  onExpandConstraint,
  onLeafClick,
  hideEmptyConstraints = false,
  showStatusSummary = false,
  allowExceptionFilter = false,
  initialOpenStakeholders = ["Lecturer"],
}: ConstraintHierarchyProps) {
  const [openStakeholders, setOpenStakeholders] = useState<Set<string>>(
    new Set(initialOpenStakeholders),
  );
  const [openConstraints, setOpenConstraints] = useState<Set<string>>(
    new Set(),
  );
  const [openEntities, setOpenEntities] = useState<Set<string>>(
    new Set(),
  );

  const [showOnlyExceptions, setShowOnlyExceptions] =
    useState(false);

  function getLeafState(leaf: ConstraintHierarchyLeaf) {
    const label =
      leaf.statusLabel?.trim().toLowerCase() ?? "";

    if (
      label.includes("deactivated") ||
      label.includes("disabled")
    ) {
      return "deactivated" as const;
    }

    if (
      label.includes("relax") ||
      Boolean(leaf.relaxation)
    ) {
      return "relaxed" as const;
    }

    if (!leaf.isActivated) {
      return "deactivated" as const;
    }

    return "active" as const;
  }

  const allLeaves = Object.values(entitiesByConstraint)
    .flatMap((groups) => groups)
    .flatMap((group) => group.leaves);

  const statusCounts = allLeaves.reduce(
    (counts, leaf) => {
      const state = getLeafState(leaf);
      counts[state] += 1;
      return counts;
    },
    {
      active: 0,
      deactivated: 0,
      relaxed: 0,
    },
  );

  const filteredEntitiesByConstraint =
    showOnlyExceptions
      ? Object.fromEntries(
          Object.entries(entitiesByConstraint)
            .map(([constraintId, groups]) => {
              const filteredGroups = groups
                .map((group) => ({
                  ...group,
                  leaves: group.leaves.filter(
                    (leaf) =>
                      getLeafState(leaf) !== "active",
                  ),
                }))
                .filter(
                  (group) => group.leaves.length > 0,
                );

              return [constraintId, filteredGroups];
            })
            .filter(
              ([, groups]) =>
                (groups as ConstraintHierarchyEntityGroup[])
                  .length > 0,
            ),
        )
      : entitiesByConstraint;

  const visibleConstraints = hideEmptyConstraints || showOnlyExceptions
    ? constraints.filter(
        (constraint) =>
          (filteredEntitiesByConstraint[constraint.id]?.length ?? 0) > 0,
      )
    : constraints;

  const groupedConstraints = stakeholders
    .map((stakeholder) => ({
      stakeholder,
      constraints: visibleConstraints.filter(
        (constraint) => constraint.stakeholder === stakeholder,
      ),
    }))
    .filter(
      (group) =>
        !hideEmptyConstraints || group.constraints.length > 0,
    );

  function toggleStakeholder(stakeholder: string) {
    setOpenStakeholders((current) => {
      const next = new Set(current);
      next.has(stakeholder)
        ? next.delete(stakeholder)
        : next.add(stakeholder);
      return next;
    });
  }

  function toggleConstraint(constraint: ConstraintDefinition) {
    const isOpen = openConstraints.has(constraint.id);

    setOpenConstraints((current) => {
      const next = new Set(current);
      isOpen
        ? next.delete(constraint.id)
        : next.add(constraint.id);
      return next;
    });

    if (
      !isOpen &&
      !entitiesByConstraint[constraint.id] &&
      onExpandConstraint
    ) {
      onExpandConstraint(constraint);
    }
  }

  function toggleEntity(
    constraintId: string,
    entityKey: string,
  ) {
    const key = `${constraintId}:${entityKey}`;

    setOpenEntities((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function renderLeafBadge(leaf: ConstraintHierarchyLeaf) {
    if (leaf.statusLabel) {
      return (
        <span
          className={`status-badge ${statusClass(leaf.statusLabel)}`}
        >
          {leaf.statusLabel}
        </span>
      );
    }

    if (!leaf.isActivated) {
      return <span className="status-badge disabled">Disabled</span>;
    }

    if (leaf.relaxation) {
      return <span className="status-badge relaxed">Relaxed</span>;
    }

    return <span className="status-badge active">Active</span>;
  }

  function renderLeafRow(
    constraint: ConstraintDefinition,
    leaf: ConstraintHierarchyLeaf,
  ) {
    const canOpenModal =
      mode === "manage" &&
      constraint.type === "relaxable" &&
      Boolean(onLeafClick);

    if (!canOpenModal) {
      return (
        <div key={leaf.key} className="constraint-detail-row">
          <div className="constraint-row-main">
            <strong>{leaf.label}</strong>

            {leaf.infoText && <span>{leaf.infoText}</span>}

            {mode !== "manage" && renderLeafBadge(leaf)}
          </div>
        </div>
      );
    }

    return (
      <button
        key={leaf.key}
        type="button"
        className="constraint-detail-row constraint-detail-row-clickable"
        onClick={() => onLeafClick?.({ constraint, leaf })}
      >
        <div className="constraint-row-main">
          <strong>{leaf.label}</strong>
          {leaf.infoText && <span>{leaf.infoText}</span>}
          {renderLeafBadge(leaf)}
        </div>

        <span className="preview-constraint-link">
          Preview constraint
        </span>
      </button>
    );
  }

  function renderEntityGroup(
    constraint: ConstraintDefinition,
    group: ConstraintHierarchyEntityGroup,
  ) {
    if (!group.isDayScoped) {
      const leaf = group.leaves[0];

      return leaf
        ? renderLeafRow(constraint, leaf)
        : null;
    }

    const entityKey = `${constraint.id}:${group.key}`;
    const isOpen = openEntities.has(entityKey);

    return (
      <div
        key={group.key}
        className="constraint-bar constraint-bar-nested"
      >
        <button
          type="button"
          className="constraint-bar-header"
          onClick={() =>
            toggleEntity(constraint.id, group.key)
          }
          aria-expanded={isOpen}
        >
          <div className="constraint-bar-header-main">
            <span className="constraint-bar-chevron">
              <ChevronRight
                size={14}
                style={{
                  transform: isOpen
                    ? "rotate(90deg)"
                    : "none",
                  transition: "transform 150ms ease",
                }}
              />
            </span>

            <span className="constraint-bar-copy">
              <h2>{group.label}</h2>
            </span>
          </div>
        </button>

        {isOpen && (
          <div className="constraint-bar-content">
            {group.leaves.map((leaf) =>
              renderLeafRow(constraint, leaf),
            )}
          </div>
        )}
      </div>
    );
  }

  const totalExceptions =
    statusCounts.deactivated + statusCounts.relaxed;

  if (groupedConstraints.length === 0 && !showOnlyExceptions) {
    return (
      <p className="constraint-empty-state">
        No constraint settings were recorded for this solution.
      </p>
    );
  }

  return (
    <div className="constraint-hierarchy-shell">
      {(showStatusSummary || allowExceptionFilter) && (
        <div className="constraint-hierarchy-toolbar">
          {showStatusSummary && (
            <div className="constraint-hierarchy-summary">
              <strong>
                {statusCounts.active} active
              </strong>
              <span aria-hidden="true">·</span>
              <strong>
                {statusCounts.deactivated} temporarily deactivated
              </strong>
              <span aria-hidden="true">·</span>
              <strong>
                {statusCounts.relaxed} partially relaxed
              </strong>
            </div>
          )}

          {allowExceptionFilter && (
            <label className="constraint-hierarchy-exception-filter">
              <input
                type="checkbox"
                checked={showOnlyExceptions}
                onChange={(event) =>
                  setShowOnlyExceptions(event.target.checked)
                }
              />
              <span>Show only relaxed or disabled constraints</span>
            </label>
          )}

          {showStatusSummary && totalExceptions > 0 && (
            <p className="constraint-hierarchy-summary-note">
              {totalExceptions} constraint exception
              {totalExceptions === 1 ? "" : "s"} were used for this solution.
            </p>
          )}

          {showStatusSummary && totalExceptions === 0 && (
            <p className="constraint-hierarchy-summary-note">
              All recorded constraints remained active for this solution.
            </p>
          )}
        </div>
      )}

      {showOnlyExceptions && groupedConstraints.length === 0 ? (
        <p className="constraint-empty-state">
          No relaxed or deactivated constraints were used for this solution.
        </p>
      ) : (
        <div className="constraint-bar-list constraint-hierarchy">
      {groupedConstraints.map((group) => {
        const meta = stakeholderMeta[group.stakeholder];
        const isOpen = openStakeholders.has(group.stakeholder);

        return (
          <div
            key={group.stakeholder}
            className="constraint-bar"
          >
            <button
              type="button"
              className="constraint-bar-header"
              onClick={() =>
                toggleStakeholder(group.stakeholder)
              }
              aria-expanded={isOpen}
            >
              <div className="constraint-bar-header-main">
                <span className="constraint-bar-chevron">
                  <ChevronRight
                    size={16}
                    style={{
                      transform: isOpen
                        ? "rotate(90deg)"
                        : "none",
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
                {group.constraints.length}{" "}
                {group.constraints.length === 1
                  ? "rule"
                  : "rules"}
              </span>
            </button>

            {isOpen && (
              <div className="constraint-bar-content">
                {group.constraints.map((constraint) => {
                  const Icon = getConstraintIcon(constraint.id);
                  const isConstraintOpen =
                    openConstraints.has(constraint.id);
                  const entities =
                    filteredEntitiesByConstraint[constraint.id];

                  return (
                    <div
                      key={constraint.id}
                      className="constraint-bar constraint-bar-nested"
                    >
                      <button
                        type="button"
                        className="constraint-row"
                        onClick={() =>
                          toggleConstraint(constraint)
                        }
                        aria-expanded={isConstraintOpen}
                      >
                        <span className="constraint-row-main">
                          <span className="constraint-row-chevron">
                            <ChevronRight
                              size={14}
                              style={{
                                transform: isConstraintOpen
                                  ? "rotate(90deg)"
                                  : "none",
                                transition:
                                  "transform 150ms ease",
                              }}
                            />
                          </span>

                          <Icon
                            size={16}
                            className="constraint-row-icon"
                          />

                          {constraint.name}
                        </span>

                        <span
                          className={`constraint-type-badge ${constraint.type}`}
                        >
                          {constraint.type === "unrelaxable"
                            ? "Unrelaxable"
                            : "Relaxable"}
                        </span>
                      </button>

                      {isConstraintOpen && (
                        <div
                          className={
                            FOLDABLE_CONSTRAINT_IDS.has(
                              constraint.id,
                            )
                              ? "constraint-bar-content constraint-bar-content-foldable"
                              : FLAT_CONSTRAINT_IDS.has(
                                    constraint.id,
                                  )
                                ? "constraint-bar-content constraint-bar-content-flat"
                                : "constraint-bar-content"
                          }
                        >
                          {loadingConstraint ===
                            constraint.id && (
                            <p className="constraint-empty-state">
                              Loading…
                            </p>
                          )}

                          {entities?.length === 0 && (
                            <p className="constraint-empty-state">
                              No data found.
                            </p>
                          )}

                          {entities?.map((entityGroup) =>
                            renderEntityGroup(
                              constraint,
                              entityGroup,
                            ),
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
      )}
    </div>
  );
}
