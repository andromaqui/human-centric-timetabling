import { useState } from "react";

import { constraints } from "../data/constraints";
import type { ConstraintDefinition } from "../types";
import { ConstraintDetailsModal } from "./ConstraintDetailsModal";
import "./ConstraintsPage.css";
import {
  GraduationCap,
  Users,
  Building2,
  CalendarX,
  Clock,
  Coffee,
  DoorClosed,
  Monitor,
  Armchair,
} from "lucide-react";

const stakeholders = ["Lecturer", "Cohort", "Class"] as const;

export function ConstraintsPage() {
  const [selectedConstraint, setSelectedConstraint] =
    useState<ConstraintDefinition | null>(null);

  const groupedConstraints = stakeholders.map((stakeholder) => ({
    stakeholder,
    constraints: constraints.filter(
      (constraint) => constraint.stakeholder === stakeholder
    ),
  }));

  const stakeholderMeta = {
      Lecturer: {
        Icon: GraduationCap,
        color: "purple",
        description: "Rules related to lecturer availability and workload.",
      },
      Cohort: {
        Icon: Users,
        color: "green",
        description: "Rules for cohort workload and daily limits.",
      },
      Class: {
        Icon: Building2,
        color: "blue",
        description: "Rules related to rooms, equipment and capacity.",
      },
    };

  function getConstraintIcon(constraintId: string) {
      switch (constraintId) {
        case "lecturer-one-class-at-time":
          return GraduationCap;
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

  return (
    <section className="constraints-page">
      <div className="constraints-header">
        <h1>Constraints</h1>
       <p>
          Browse scheduling rules by stakeholder. Click a constraint to inspect what it
          applies to and how it affects timetabling.
        </p>
      </div>

      <div className="constraints-grid">
          {groupedConstraints.map((group) => {
            const meta = stakeholderMeta[group.stakeholder];

            return (
              <article key={group.stakeholder} className={`constraint-group-card ${meta.color}`}>
                <div className="constraint-card-header">
                  <div className={`constraint-card-icon ${meta.color}`}>
                    <meta.Icon size={24} />
                  </div>

                  <div>
                    <h2>{group.stakeholder}</h2>
                    <p>{meta.description}</p>
                  </div>

                  <span className={`constraint-count ${meta.color}`}>
                    {group.constraints.length}{" "}
                    {group.constraints.length === 1 ? "rule" : "rules"}
                  </span>
                </div>

                <div className="constraint-list">
                  {group.constraints.map((constraint) => (
                    <button
                      key={constraint.id}
                      className="constraint-row"
                      onClick={() => setSelectedConstraint(constraint)}
                    >
                      <span className={`constraint-row-icon ${meta.color}`}>
                          {(() => {
                            const Icon = getConstraintIcon(constraint.id);
                            return <Icon size={18} />;
                          })()}
                        </span>

                        <span>{constraint.name}</span>


                      <span className={`constraint-type ${constraint.type}`}>
                        {constraint.type}
                      </span>
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>

      <div className="constraints-note">
          <span className="constraints-note-icon">i</span>
          <p>
            Unrelaxable constraints must never be violated. Relaxable constraints are preferred but can be temporarily relaxed when necessary.
          </p>
      </div>

      {selectedConstraint && (
        <ConstraintDetailsModal
          constraint={selectedConstraint}
          onClose={() => setSelectedConstraint(null)}
        />
      )}
    </section>
  );
}