import { useEffect, useState } from "react";

import { api } from "../../../shared/api/client";
import { timetableData } from "../../timetable/data/timetableData";
import type { ConstraintDefinition } from "../types";
import { ConstraintDetailsModal } from "./ConstraintDetailsModal";
import {
  ConstraintHierarchy,
  type ConstraintHierarchyEntityGroup,
  type ConstraintHierarchyLeaf,
  type ConstraintHierarchyRelaxation,
} from "./ConstraintHierarchy";
import "./ConstraintsPage.css";
import { SchedulingHorizon } from "./SchedulingHorizon";


const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};

async function fetchRelaxation(
  instanceType: ConstraintHierarchyLeaf["instanceType"],
  instanceId: string,
): Promise<ConstraintHierarchyRelaxation | null> {
  const relaxations = await api.get<ConstraintHierarchyRelaxation[]>(
    `/relaxations/?instance_type=${instanceType}&instance_id=${instanceId}`,
  );

  return relaxations[0] ?? null;
}

export function ConstraintsPage() {
  const [constraints, setConstraints] =
    useState<ConstraintDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [entitiesByConstraint, setEntitiesByConstraint] =
    useState<Record<string, ConstraintHierarchyEntityGroup[]>>(
      {},
    );

  const [loadingConstraint, setLoadingConstraint] =
    useState<string | null>(null);

  const [selectedLeaf, setSelectedLeaf] = useState<{
    constraint: ConstraintDefinition;
    leaf: ConstraintHierarchyLeaf;
  } | null>(null);

  useEffect(() => {
    api
      .get<ConstraintDefinition[]>("/constraints/")
      .then(setConstraints)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function loadEntitiesForConstraint(
    constraint: ConstraintDefinition,
  ) {
    setLoadingConstraint(constraint.id);

    try {
      const groups: ConstraintHierarchyEntityGroup[] = [];

      if (constraint.stakeholder === "Lecturer") {
        const lecturers = await api.get<
          { id: string; name: string }[]
        >("/lecturers/");

        for (const lecturer of lecturers) {
          const instances = await api.get<
            {
              id: string;
              constraint_id: string;
              day: string | null;
              is_activated: boolean;
            }[]
          >(`/lecturers/${lecturer.id}/constraints`);

          const matches = instances.filter(
            (instance) =>
              instance.constraint_id === constraint.id,
          );

          if (matches.length === 0) continue;

          const isDayScoped = matches.some(
            (instance) => instance.day !== null,
          );

          const leaves = await Promise.all(
            matches.map(async (instance) => ({
              key: instance.id,
              label: isDayScoped
                ? DAY_LABELS[instance.day as string] ??
                  instance.day ??
                  "Day"
                : lecturer.name,
              groupLabel: isDayScoped
                ? lecturer.name
                : null,
              infoText: "",
              instanceType: "lecturer" as const,
              instanceId: instance.id,
              isActivated: instance.is_activated,
              relaxation: await fetchRelaxation(
                "lecturer",
                instance.id,
              ),
            })),
          );

          groups.push({
            key: lecturer.id,
            label: lecturer.name,
            isDayScoped,
            leaves,
          });
        }
      }

      if (constraint.stakeholder === "Cohort") {
        const cohorts = await api.get<
          { id: string; name: string }[]
        >("/cohorts/");

        for (const cohort of cohorts) {
          const instances = await api.get<
            {
              id: string;
              constraint_id: string;
              day: string | null;
              is_activated: boolean;
            }[]
          >(`/cohorts/${cohort.id}/constraints`);

          const matches = instances.filter(
            (instance) =>
              instance.constraint_id === constraint.id,
          );

          if (matches.length === 0) continue;

          const isDayScoped = matches.some(
            (instance) => instance.day !== null,
          );

          const leaves = await Promise.all(
            matches.map(async (instance) => ({
              key: instance.id,
              label: isDayScoped
                ? DAY_LABELS[instance.day as string] ??
                  instance.day ??
                  "Day"
                : cohort.name,
              groupLabel: isDayScoped ? cohort.name : null,
              infoText: "",
              instanceType: "cohort" as const,
              instanceId: instance.id,
              isActivated: instance.is_activated,
              relaxation: await fetchRelaxation(
                "cohort",
                instance.id,
              ),
            })),
          );

          groups.push({
            key: cohort.id,
            label: cohort.name,
            isDayScoped,
            leaves,
          });
        }
      }

      if (
        constraint.stakeholder === "Session" &&
        (constraint.id === "class-equipment" ||
          constraint.id === "class-capacity")
      ) {
        const sessions = await api.get<
          { id: string; module_id: string }[]
        >("/sessions/");

        for (const module of timetableData.modules) {
          const session = sessions.find(
            (item) => item.module_id === module.id,
          );

          if (!session) continue;

          const instances = await api.get<
            {
              id: string;
              constraint_id: string;
              is_activated: boolean;
            }[]
          >(`/sessions/${session.id}/constraints`);

          const instance = instances.find(
            (item) =>
              item.constraint_id === constraint.id,
          );

          if (!instance) continue;

          const infoText =
            constraint.id === "class-equipment"
              ? `Needs: ${(module.requiredEquipment ?? []).join(", ") || "None"}`
              : `Requires at least ${module.requiredCapacity ?? "?"} seats`;

          const leaf: ConstraintHierarchyLeaf = {
            key: instance.id,
            label: `${module.code} · ${module.title}`,
            groupLabel: null,
            infoText,
            instanceType: "session",
            instanceId: instance.id,
            isActivated: instance.is_activated,
            relaxation: await fetchRelaxation(
              "session",
              instance.id,
            ),
            equipmentOptions:
              module.requiredEquipment ?? [],
          };

          groups.push({
            key: module.id,
            label: leaf.label,
            isDayScoped: false,
            leaves: [leaf],
          });
        }
      }

      if (
        constraint.id === "room-one-booking-at-time"
      ) {
        const rooms = await api.get<
          { id: string; name: string }[]
        >("/rooms/");

        for (const room of rooms) {
          const instances = await api.get<
            {
              id: string;
              constraint_id: string;
              is_activated: boolean;
            }[]
          >(`/rooms/${room.id}/constraints`);

          const instance = instances.find(
            (item) =>
              item.constraint_id === constraint.id,
          );

          if (!instance) continue;

          const leaf: ConstraintHierarchyLeaf = {
            key: instance.id,
            label: room.name,
            groupLabel: null,
            infoText: "",
            instanceType: "room",
            instanceId: instance.id,
            isActivated: instance.is_activated,
            relaxation: await fetchRelaxation(
              "room",
              instance.id,
            ),
          };

          groups.push({
            key: room.id,
            label: room.name,
            isDayScoped: false,
            leaves: [leaf],
          });
        }
      }

      setEntitiesByConstraint((current) => ({
        ...current,
        [constraint.id]: groups,
      }));
    } finally {
      setLoadingConstraint(null);
    }
  }

  if (loading) {
    return (
      <p className="constraints-loading">
        Loading constraints…
      </p>
    );
  }

  if (error) {
    return (
      <p className="constraints-error">
        Couldn't load constraints: {error}
      </p>
    );
  }

  return (
    <section className="constraints-page">
      <div className="constraints-header">
        <h1>Constraints</h1>
        <p>
          Browse scheduling rules by stakeholder. Expand a
          constraint to see and manage each instance it
          applies to.
        </p>
      </div>

      <SchedulingHorizon/>

      <h2 className="constraints-section-title">
          Stakeholder Constraints
       </h2>

      <ConstraintHierarchy
        constraints={constraints}
        entitiesByConstraint={entitiesByConstraint}
        mode="manage"
        loadingConstraint={loadingConstraint}
        onExpandConstraint={loadEntitiesForConstraint}
        onLeafClick={setSelectedLeaf}
        initialOpenStakeholders={["Lecturer"]}
      />

      <div className="constraints-note">
        <span className="constraints-note-icon">i</span>
        <p>
          Unrelaxable constraints must never be violated.
          Relaxable constraints are preferred but can be
          temporarily relaxed when necessary.
        </p>
      </div>

      {selectedLeaf && (
        <ConstraintDetailsModal
          constraint={selectedLeaf.constraint}
          leaf={selectedLeaf.leaf}
          onClose={() => setSelectedLeaf(null)}
          onUpdate={(updatedLeaf) => {
            setEntitiesByConstraint((current) => {
              const groups =
                current[selectedLeaf.constraint.id] ?? [];

              return {
                ...current,
                [selectedLeaf.constraint.id]:
                  groups.map((group) => ({
                    ...group,
                    leaves: group.leaves.map((leaf) =>
                      leaf.key === updatedLeaf.key
                        ? updatedLeaf
                        : leaf,
                    ),
                  })),
              };
            });

            setSelectedLeaf((current) =>
              current
                ? {
                    ...current,
                    leaf: updatedLeaf,
                  }
                : current,
            );
          }}
        />
      )}
    </section>
  );
}
