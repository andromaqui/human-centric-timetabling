import { useState, type ReactNode } from "react";
import {
  ChevronRight,
  GraduationCap,
  DoorClosed,
  UsersRound,
} from "lucide-react";

import { MiniTimetablePreview } from "../MiniTimetablePreview";
import { getBusySlots } from "../../data/timetableData";
import "./StakeholderViolationsPanel.css";

type Violation = {
  type: string;
  [key: string]: any;
};

type NamedEntity = {
  id: string;
  name: string;
};

type SessionLike = {
  id: string;
  lecturerId: string;
  room?: string;
  cohortIds: string[];
};

type StakeholderType = "lecturer" | "room" | "cohort";

type ViolationGroup = {
  key: string;
  stakeholderType: StakeholderType;
  stakeholderId: string;
  violations: Violation[];
};

const STAKEHOLDER_ICONS: Record<
  StakeholderType,
  typeof GraduationCap
> = {
  lecturer: GraduationCap,
  room: DoorClosed,
  cohort: UsersRound,
};

function getViolationStakeholder(
  v: Violation,
): {
  type: StakeholderType;
  id: string;
} | null {
  switch (v.type) {
    case "lecturer_overlap":
    case "lecturer_unavailable":
    case "lecturer_daily_hours":
    case "lecturer_lunch_break":
      return v.lecturer_id
        ? {
            type: "lecturer",
            id: v.lecturer_id,
          }
        : null;

    case "room_overlap":
    case "class_capacity":
    case "class_equipment":
      return v.room_id
        ? {
            type: "room",
            id: v.room_id,
          }
        : null;

    case "cohort_overlap":
    case "cohort_daily_hours":
      return v.cohort_id
        ? {
            type: "cohort",
            id: v.cohort_id,
          }
        : null;

    default:
      return null;
  }
}

function groupViolations(
  violations: Violation[],
): {
  groups: ViolationGroup[];
  ungrouped: Violation[];
} {
  const map = new Map<string, ViolationGroup>();
  const ungrouped: Violation[] = [];

  for (const v of violations) {
    const stakeholder =
      getViolationStakeholder(v);

    if (!stakeholder) {
      ungrouped.push(v);
      continue;
    }

    const key = `${stakeholder.type}-${stakeholder.id}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        stakeholderType: stakeholder.type,
        stakeholderId: stakeholder.id,
        violations: [],
      });
    }

    map.get(key)!.violations.push(v);
  }

  return {
    groups: Array.from(map.values()),
    ungrouped,
  };
}

type StakeholderViolationsPanelProps = {
  violations: Violation[];

  proposedSlots: string[];
  excludeSessionId: string;

  lecturers: NamedEntity[];
  rooms: NamedEntity[];
  cohorts: NamedEntity[];

  sessions: SessionLike[];

  lecturerUnavailableSlotMap: Record<
    string,
    string[]
  >;

  formatViolationNice: (
    v: Violation,
  ) => string;

  isRelaxableViolation: (
    type: string,
  ) => boolean;

  /*
   * IMPORTANT:
   * The current stakeholder's violations are
   * passed into this callback.
   *
   * Step4Solution uses these to determine whether
   * RoomSuitability should emphasise capacity,
   * equipment, or both.
   */
  renderRoomSuitability?: (
    violations: Violation[],
  ) => ReactNode;
};

function getConstraintLabel(type: string): string {
  const labels: Record<string, string> = {
    room_overlap: "Room overlap",
    lecturer_overlap: "Lecturer overlap",
    cohort_overlap: "Cohort overlap",
    lecturer_unavailable: "Lecturer unavailable",
    class_capacity: "Room capacity",
    class_equipment: "Room equipment",
    cohort_daily_hours: "Cohort daily-hours limit",
    lecturer_daily_hours: "Lecturer daily-hours limit",
    lecturer_lunch_break: "Lecturer lunch-break constraint",
  };

  return labels[type] ?? type.replaceAll("_", " ");
}

export function StakeholderViolationsPanel({
  violations,
  proposedSlots,
  excludeSessionId,
  lecturers,
  rooms,
  cohorts,
  sessions,
  lecturerUnavailableSlotMap,
  formatViolationNice,
  isRelaxableViolation,
  renderRoomSuitability,
}: StakeholderViolationsPanelProps) {
  const [openGroups, setOpenGroups] =
    useState<Set<string>>(new Set());

  const [explanationView, setExplanationView] =
    useState<"plain" | "matrix" | "visual">("plain");

  function toggleGroup(key: string) {
    setOpenGroups((current) => {
      const next = new Set(current);

      next.has(key)
        ? next.delete(key)
        : next.add(key);

      return next;
    });
  }

  if (violations.length === 0) {
    return (
      <p className="step-description">
        No direct constraint violations were
        detected by the diagnostic checker.
      </p>
    );
  }

  const { groups, ungrouped } =
    groupViolations(violations);

  function getStakeholderLabel(violation: Violation): string {
    const stakeholder = getViolationStakeholder(violation);
    if (!stakeholder) return "Other";

    if (stakeholder.type === "lecturer") {
      return lecturers.find((item) => item.id === stakeholder.id)?.name ?? stakeholder.id;
    }

    if (stakeholder.type === "room") {
      return rooms.find((item) => item.id === stakeholder.id)?.name ?? stakeholder.id;
    }

    return cohorts.find((item) => item.id === stakeholder.id)?.name ?? stakeholder.id;
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          marginBottom: "18px",
        }}
      >
        <div className="sv-heading" style={{ marginBottom: 0 }}>
          <span className="sv-heading-title">
            This change breaks {violations.length}{" "}
            {violations.length === 1
              ? "rule"
              : "rules"}
          </span>
        </div>

        {/* Neutral view controls: no condition names are shown to participants. */}
        <div
          role="group"
          aria-label="Explanation view"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            paddingTop: "4px",
            flexShrink: 0,
          }}
        >
          {(["plain", "matrix", "visual"] as const).map((view, index) => {
            const selected = explanationView === view;

            return (
              <button
                key={view}
                type="button"
                onClick={() => setExplanationView(view)}
                aria-label={`View ${index + 1}`}
                aria-pressed={selected}
                title={`View ${index + 1}`}
                style={{
                  width: "14px",
                  height: "14px",
                  padding: 0,
                  borderRadius: "999px",
                  border: selected
                    ? "2px solid #64748b"
                    : "2px solid #94a3b8",
                  background: selected
                    ? "#64748b"
                    : "#ffffff",
                  cursor: "pointer",
                  boxShadow: selected
                    ? "0 0 0 3px rgba(100, 116, 139, 0.14)"
                    : "none",
                  transition: "all 150ms ease",
                }}
              />
            );
          })}
        </div>
      </div>

      {explanationView === "plain" ? (
        <div
          aria-label="Plain explanation"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {violations.map((violation, index) => (
            <p
              key={`${violation.type}-${index}`}
              style={{
                margin: 0,
                color: "#1e293b",
                fontSize: "15px",
                lineHeight: 1.55,
              }}
            >
              {formatViolationNice(violation)}
            </p>
          ))}
        </div>
      ) : explanationView === "matrix" ? (
        <div
          aria-label="Explanation matrix"
          style={{
            overflowX: "auto",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "14px",
              textAlign: "left",
            }}
          >
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0" }}>
                  Affected stakeholder / resource
                </th>
                <th style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0" }}>
                  Constraint
                </th>
                <th style={{ padding: "11px 12px", borderBottom: "1px solid #e2e8f0" }}>
                  Violation
                </th>
              </tr>
            </thead>
            <tbody>
              {violations.map((violation, index) => (
                <tr key={`${violation.type}-${index}`}>
                  <td
                    style={{
                      padding: "11px 12px",
                      borderBottom:
                        index === violations.length - 1 ? "none" : "1px solid #e2e8f0",
                      verticalAlign: "top",
                      fontWeight: 600,
                      color: "#1e293b",
                    }}
                  >
                    {getStakeholderLabel(violation)}
                  </td>
                  <td
                    style={{
                      padding: "11px 12px",
                      borderBottom:
                        index === violations.length - 1 ? "none" : "1px solid #e2e8f0",
                      verticalAlign: "top",
                      color: "#334155",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {getConstraintLabel(violation.type)}
                  </td>
                  <td
                    style={{
                      padding: "11px 12px",
                      borderBottom:
                        index === violations.length - 1 ? "none" : "1px solid #e2e8f0",
                      verticalAlign: "top",
                      color: "#334155",
                      lineHeight: 1.5,
                    }}
                  >
                    {formatViolationNice(violation)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
      <div className="sv-bar-list">
        {groups.map((group) => {
          let label = group.stakeholderId;
          let timetableTitle =
            group.stakeholderId;

          let busySlots: string[] = [];
          let unavailableSlots: string[] = [];

          let fullTimetableLink = "#";

          /*
           * LECTURER
           */
          if (
            group.stakeholderType ===
            "lecturer"
          ) {
            const lecturer = lecturers.find(
              (l) =>
                l.id === group.stakeholderId,
            );

            label =
              lecturer?.name ??
              group.stakeholderId;

            timetableTitle = `Lecturer: ${label}`;

            busySlots = getBusySlots(
              sessions,
              (s) =>
                s.lecturerId ===
                group.stakeholderId,
              excludeSessionId,
            );

            unavailableSlots =
              lecturerUnavailableSlotMap[
                group.stakeholderId
              ] ?? [];

            fullTimetableLink =
              `/timetable-preview?lecturer=${group.stakeholderId}`;
          }

          /*
           * ROOM
           */
          if (
            group.stakeholderType === "room"
          ) {
            const room = rooms.find(
              (r) =>
                r.id === group.stakeholderId,
            );

            label =
              room?.name ??
              group.stakeholderId;

            timetableTitle = `Room: ${label}`;

            busySlots = getBusySlots(
              sessions,
              (s) => s.room === label,
              excludeSessionId,
            );

            fullTimetableLink =
              `/timetable-preview?room=${encodeURIComponent(
                label,
              )}`;
          }

          /*
           * COHORT
           */
          if (
            group.stakeholderType ===
            "cohort"
          ) {
            const cohort = cohorts.find(
              (c) =>
                c.id === group.stakeholderId,
            );

            label =
              cohort?.name ??
              group.stakeholderId;

            timetableTitle = `Cohort: ${label}`;

            busySlots = getBusySlots(
              sessions,
              (s) =>
                s.cohortIds.includes(
                  group.stakeholderId,
                ),
              excludeSessionId,
            );

            fullTimetableLink =
              `/timetable-preview?cohort=${group.stakeholderId}`;
          }

          const isOpen =
            openGroups.has(group.key);

          const isUnrelaxable =
            group.violations.some(
              (v) =>
                !isRelaxableViolation(
                  v.type,
                ),
            );

          const Icon =
            STAKEHOLDER_ICONS[
              group.stakeholderType
            ];

          const ruleCount =
            group.violations.length;

          /*
           * Room suitability should replace the
           * timetable only when this stakeholder
           * actually has a capacity/equipment
           * constraint.
           */
          const hasRoomSuitabilityViolation =
            group.violations.some(
              (v) =>
                v.type ===
                  "class_capacity" ||
                v.type ===
                  "class_equipment",
            );

          return (
            <div
              key={group.key}
              className="sv-bar"
            >
              {/* STAKEHOLDER HEADER */}
              <button
                type="button"
                className="sv-bar-header"
                onClick={() =>
                  toggleGroup(group.key)
                }
                aria-expanded={isOpen}
              >
                <div className="sv-bar-header-main">
                  <span className="sv-bar-chevron">
                    <ChevronRight
                      size={14}
                      style={{
                        transform: isOpen
                          ? "rotate(90deg)"
                          : "none",
                        transition:
                          "transform 150ms ease",
                      }}
                    />
                  </span>

                  <Icon
                    size={16}
                    className="sv-bar-icon"
                  />

                  <div className="sv-bar-copy">
                    <span className="sv-bar-title">
                      {label}
                    </span>

                    <span className="sv-bar-subtitle">
                      {ruleCount}{" "}
                      {ruleCount === 1
                        ? "rule broken"
                        : "rules broken"}
                    </span>
                  </div>
                </div>

                <span
                  className={`sv-type-badge ${
                    isUnrelaxable
                      ? "unrelaxable"
                      : "relaxable"
                  }`}
                >
                  {isUnrelaxable
                    ? "Unrelaxable"
                    : "Relaxable"}
                </span>
              </button>

              {/* EXPANDED STAKEHOLDER */}
              {isOpen && (
                <div className="sv-bar-content">
                  <ul className="violation-list">
                    {group.violations.map(
                      (v, idx) => (
                        <li
                          key={idx}
                          className="violation-item"
                        >
                          <span>
                            {formatViolationNice(
                              v,
                            )}
                          </span>

                          <span
                            className={
                              isRelaxableViolation(
                                v.type,
                              )
                                ? "badge relaxable"
                                : "badge unrelaxable"
                            }
                          >
                            {isRelaxableViolation(
                              v.type,
                            )
                              ? "Relaxable"
                              : "Unrelaxable"}
                          </span>
                        </li>
                      ),
                    )}
                  </ul>

                  {explanationView ===
                    "visual" &&
                    (hasRoomSuitabilityViolation ? (
                      /*
                       * IMPORTANT:
                       *
                       * Pass THIS stakeholder's
                       * actual violations to the
                       * RoomSuitability renderer.
                       */
                      renderRoomSuitability?.(
                        group.violations,
                      ) ?? null
                    ) : (
                      /*
                       * Everything else keeps the
                       * timetable exactly as before.
                       */
                      <MiniTimetablePreview
                        title={
                          timetableTitle
                        }
                        busySlots={busySlots}
                        selectedSlots={
                          proposedSlots
                        }
                        unavailableSlots={
                          unavailableSlots
                        }
                        fullTimetableLink={
                          fullTimetableLink
                        }
                      />
                    ))}
                </div>
              )}
            </div>
          );
        })}

        {/* VIOLATIONS WITH NO STAKEHOLDER */}
        {ungrouped.length > 0 && (
          <div className="sv-bar">
            <button
              type="button"
              className="sv-bar-header"
              onClick={() =>
                toggleGroup("ungrouped")
              }
              aria-expanded={openGroups.has(
                "ungrouped",
              )}
            >
              <div className="sv-bar-header-main">
                <span className="sv-bar-chevron">
                  <ChevronRight
                    size={14}
                    style={{
                      transform:
                        openGroups.has(
                          "ungrouped",
                        )
                          ? "rotate(90deg)"
                          : "none",
                      transition:
                        "transform 150ms ease",
                    }}
                  />
                </span>

                <div className="sv-bar-copy">
                  <span className="sv-bar-title">
                    Other
                  </span>

                  <span className="sv-bar-subtitle">
                    {ungrouped.length}{" "}
                    {ungrouped.length === 1
                      ? "rule broken"
                      : "rules broken"}
                  </span>
                </div>
              </div>
            </button>

            {openGroups.has("ungrouped") && (
              <div className="sv-bar-content">
                <ul className="violation-list">
                  {ungrouped.map(
                    (v, idx) => (
                      <li
                        key={idx}
                        className="violation-item"
                      >
                        <span>
                          {formatViolationNice(
                            v,
                          )}
                        </span>

                        <span
                          className={
                            isRelaxableViolation(
                              v.type,
                            )
                              ? "badge relaxable"
                              : "badge unrelaxable"
                          }
                        >
                          {isRelaxableViolation(
                            v.type,
                          )
                            ? "Relaxable"
                            : "Unrelaxable"}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
