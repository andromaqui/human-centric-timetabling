import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import "./ConstraintsOverviewPanel.css";

type ConstraintDefinition = {
  id: string;
  name: string;
  description: string;
  stakeholder: string;
  type: "unrelaxable" | "relaxable";
};

type RelaxationOut = {
  id: string;
  instance_type: string;
  instance_id: string;
  relaxation_type: "disable" | "adjust";
  details: Record<string, unknown> | null;
  reason: string;
};

type OverviewLeaf = {
  key: string;
  label: string;
  infoText: string;
  instanceType: "session" | "lecturer" | "cohort" | "room";
  instanceId: string;
  relaxation: RelaxationOut | null;
};

type OverviewEntityGroup = {
  key: string;
  label: string;
  isDayScoped: boolean;
  leaves: OverviewLeaf[];
};

const OVERVIEW_STAKEHOLDERS = ["Lecturer", "Cohort", "Session", "Room"] as const;

function describeRelaxation(relaxation: RelaxationOut): string {
  if (relaxation.reason) return relaxation.reason;
  if (relaxation.relaxation_type === "disable") return "Temporarily disabled";
  if (relaxation.details) {
    return Object.entries(relaxation.details)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
      .join(" · ");
  }
  return "Relaxed";
}

type ConstraintsOverviewPanelProps = {
  constraintDefinitions: ConstraintDefinition[];
  overviewEntitiesByConstraint: Record<string, OverviewEntityGroup[]>;
  overviewLoading: boolean;
  openStakeholders: Set<string>;
  openConstraints: Set<string>;
  openEntities: Set<string>;
  onToggleStakeholder: (stakeholder: string) => void;
  onToggleConstraint: (constraintId: string) => void;
  onToggleEntity: (constraintId: string, entityKey: string) => void;
};

export function ConstraintsOverviewPanel({
  constraintDefinitions,
  overviewEntitiesByConstraint,
  overviewLoading,
  openStakeholders,
  openConstraints,
  openEntities,
  onToggleStakeholder,
  onToggleConstraint,
  onToggleEntity,
}: ConstraintsOverviewPanelProps) {
  const activeOverviewConstraintCount = constraintDefinitions.filter(
    (constraint) => (overviewEntitiesByConstraint[constraint.id]?.length ?? 0) > 0,
  ).length;

  return (
    <>
      <h2>Active constraints overview</h2>

      <p className="step-description">
        Read-only overview of every active constraint currently configured
        in the timetable. Expand a section to quickly inspect where each
        rule applies.
      </p>

      <Link to="/constraints" className="review-constraints-link">
        Review &amp; modify constraints
        <ExternalLink size={16} />
      </Link>

      {overviewLoading && (
        <p className="step-description">Loading active constraints…</p>
      )}

      {!overviewLoading && activeOverviewConstraintCount === 0 && (
        <p className="step-description">
          No active constraints are currently configured.
        </p>
      )}

      {!overviewLoading && activeOverviewConstraintCount > 0 && (
        <div className="constraint-overview-list">
          {OVERVIEW_STAKEHOLDERS.map((stakeholder) => {
            const constraintsForStakeholder = constraintDefinitions.filter(
              (constraint) =>
                constraint.stakeholder === stakeholder &&
                (overviewEntitiesByConstraint[constraint.id]?.length ?? 0) > 0,
            );

            if (constraintsForStakeholder.length === 0) return null;

            const stakeholderOpen = openStakeholders.has(stakeholder);

            return (
              <section
                key={stakeholder}
                className="constraint-group-block constraint-overview-group"
              >
                <button
                  type="button"
                  className="constraint-overview-header"
                  onClick={() => onToggleStakeholder(stakeholder)}
                  aria-expanded={stakeholderOpen}
                >
                  <span>
                    <strong>{stakeholder}</strong>
                    <small>
                      {constraintsForStakeholder.length}{" "}
                      {constraintsForStakeholder.length === 1 ? "rule" : "rules"}
                    </small>
                  </span>
                  <span>{stakeholderOpen ? "−" : "+"}</span>
                </button>

                {stakeholderOpen && (
                  <div className="constraint-overview-content">
                    {constraintsForStakeholder.map((constraint) => {
                      const groups = overviewEntitiesByConstraint[constraint.id] ?? [];
                      const constraintOpen = openConstraints.has(constraint.id);
                      const instanceCount = groups.reduce(
                        (total, group) => total + group.leaves.length,
                        0,
                      );

                      return (
                        <div key={constraint.id} className="constraint-overview-rule">
                          <button
                            type="button"
                            className="constraint-overview-rule-header"
                            onClick={() => onToggleConstraint(constraint.id)}
                            aria-expanded={constraintOpen}
                          >
                            <span className="constraint-name">
                              {constraint.name}
                              <small>{instanceCount} active</small>
                            </span>

                            <span
                              className={
                                constraint.type === "relaxable"
                                  ? "constraint-type-badge relaxable"
                                  : "constraint-type-badge unrelaxable"
                              }
                            >
                              {constraint.type === "relaxable" ? "Relaxable" : "Unrelaxable"}
                            </span>
                          </button>

                          {constraintOpen && (
                            <div className="constraint-overview-entities">
                              {groups.map((group) => {
                                if (!group.isDayScoped) {
                                  const leaf = group.leaves[0];
                                  return (
                                    <div
                                      key={leaf.key}
                                      className="constraints-table-row constraint-overview-leaf"
                                    >
                                      <span className="constraint-name">
                                        {leaf.label}
                                        {leaf.infoText && <small>{leaf.infoText}</small>}
                                      </span>
                                      <span className="constraint-state">
                                        {leaf.relaxation
                                          ? describeRelaxation(leaf.relaxation)
                                          : "Active"}
                                      </span>
                                    </div>
                                  );
                                }

                                const entityKey = `${constraint.id}:${group.key}`;
                                const entityOpen = openEntities.has(entityKey);

                                return (
                                  <div key={group.key} className="constraint-overview-entity">
                                    <button
                                      type="button"
                                      className="constraint-overview-entity-header"
                                      onClick={() => onToggleEntity(constraint.id, group.key)}
                                      aria-expanded={entityOpen}
                                    >
                                      <span>{group.label}</span>
                                      <span>{entityOpen ? "−" : "+"}</span>
                                    </button>

                                    {entityOpen && (
                                      <div className="constraint-overview-days">
                                        {group.leaves.map((leaf) => (
                                          <div
                                            key={leaf.key}
                                            className="constraints-table-row constraint-overview-leaf"
                                          >
                                            <span className="constraint-name">
                                              {leaf.label}
                                            </span>
                                            <span className="constraint-state">
                                              {leaf.relaxation
                                                ? describeRelaxation(leaf.relaxation)
                                                : "Active"}
                                            </span>
                                          </div>
                                        ))}
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
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}