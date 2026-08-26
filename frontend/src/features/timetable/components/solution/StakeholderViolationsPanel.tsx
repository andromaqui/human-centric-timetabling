import { useState } from "react";
import { ChevronRight, GraduationCap, DoorClosed, UsersRound } from "lucide-react";
import { MiniTimetablePreview } from "../MiniTimetablePreview";
import { getBusySlots } from "../../data/timetableData";
import "./StakeholderViolationsPanel.css";

type Violation = {
  type: string;
  [key: string]: any;
};

type NamedEntity = { id: string; name: string };

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

const STAKEHOLDER_ICONS: Record<StakeholderType, typeof GraduationCap> = {
  lecturer: GraduationCap,
  room: DoorClosed,
  cohort: UsersRound,
};

// Every violation type already carries the id of exactly one stakeholder
// on the object itself — no extra lookup needed, just a switch on `type`.
function getViolationStakeholder(v: Violation): { type: StakeholderType; id: string } | null {
  switch (v.type) {
    case "lecturer_overlap":
    case "lecturer_unavailable":
    case "lecturer_daily_hours":
    case "lecturer_lunch_break":
      return v.lecturer_id ? { type: "lecturer", id: v.lecturer_id } : null;
    case "room_overlap":
    case "class_capacity":
    case "class_equipment":
      return v.room_id ? { type: "room", id: v.room_id } : null;
    case "cohort_daily_hours":
      return v.cohort_id ? { type: "cohort", id: v.cohort_id } : null;
    default:
      return null;
  }
}

function groupViolations(violations: Violation[]): {
  groups: ViolationGroup[];
  ungrouped: Violation[];
} {
  const map = new Map<string, ViolationGroup>();
  const ungrouped: Violation[] = [];

  for (const v of violations) {
    const stakeholder = getViolationStakeholder(v);

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

  return { groups: Array.from(map.values()), ungrouped };
}

type StakeholderViolationsPanelProps = {
  violations: Violation[];
  // The single proposed slot every violation in this diagnosis is checked
  // against — shared across all cards, not derived per violation.
  proposedSlots: string[];
  excludeSessionId: string;
  lecturers: NamedEntity[];
  rooms: NamedEntity[];
  cohorts: NamedEntity[];
  sessions: SessionLike[];
  lecturerUnavailableSlotMap: Record<string, string[]>;
  formatViolationNice: (v: Violation) => string;
  isRelaxableViolation: (type: string) => boolean;
};

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
}: StakeholderViolationsPanelProps) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  function toggleGroup(key: string) {
    setOpenGroups((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  if (violations.length === 0) {
    return (
      <p className="step-description">
        No direct constraint violations were detected by the diagnostic checker.
      </p>
    );
  }

  const { groups, ungrouped } = groupViolations(violations);

  return (
    <div>
      <div className="sv-heading">
        <span className="sv-heading-title">
          This change breaks {violations.length} {violations.length === 1 ? "rule" : "rules"}
        </span>
        <p className="step-description">
          Expand each one to see how it affects the people, cohorts, or rooms involved.
        </p>
      </div>

      <div className="sv-bar-list">
        {groups.map((group) => {
          let label = group.stakeholderId;
          let timetableTitle = group.stakeholderId;
          let busySlots: string[] = [];
          let unavailableSlots: string[] = [];
          let fullTimetableLink = "#";

          if (group.stakeholderType === "lecturer") {
            const lecturer = lecturers.find((l) => l.id === group.stakeholderId);
            label = lecturer?.name ?? group.stakeholderId;
            timetableTitle = `Lecturer: ${label}`;
            busySlots = getBusySlots(
              sessions,
              (s) => s.lecturerId === group.stakeholderId,
              excludeSessionId,
            );
            unavailableSlots = lecturerUnavailableSlotMap[group.stakeholderId] ?? [];
            fullTimetableLink = `/timetable-preview?lecturer=${group.stakeholderId}`;
          }

          if (group.stakeholderType === "room") {
            const room = rooms.find((r) => r.id === group.stakeholderId);
            label = room?.name ?? group.stakeholderId;
            timetableTitle = `Room: ${label}`;
            busySlots = getBusySlots(sessions, (s) => s.room === label, excludeSessionId);
            fullTimetableLink = `/timetable-preview?room=${encodeURIComponent(label)}`;
          }

          if (group.stakeholderType === "cohort") {
            const cohort = cohorts.find((c) => c.id === group.stakeholderId);
            label = cohort?.name ?? group.stakeholderId;
            timetableTitle = `Cohort: ${label}`;
            busySlots = getBusySlots(
              sessions,
              (s) => s.cohortIds.includes(group.stakeholderId),
              excludeSessionId,
            );
            fullTimetableLink = `/timetable-preview?cohort=${group.stakeholderId}`;
          }

          const isOpen = openGroups.has(group.key);
          const isUnrelaxable = group.violations.some((v) => !isRelaxableViolation(v.type));
          const Icon = STAKEHOLDER_ICONS[group.stakeholderType];
          const ruleCount = group.violations.length;

          return (
            <div key={group.key} className="sv-bar">
              <button
                type="button"
                className="sv-bar-header"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={isOpen}
              >
                <div className="sv-bar-header-main">
                  <span className="sv-bar-chevron">
                    <ChevronRight
                      size={14}
                      style={{
                        transform: isOpen ? "rotate(90deg)" : "none",
                        transition: "transform 150ms ease",
                      }}
                    />
                  </span>
                  <Icon size={16} className="sv-bar-icon" />
                  <div className="sv-bar-copy">
                    <span className="sv-bar-title">{label}</span>
                    <span className="sv-bar-subtitle">
                      {ruleCount} {ruleCount === 1 ? "rule broken" : "rules broken"}
                    </span>
                  </div>
                </div>

                <span className={`sv-type-badge ${isUnrelaxable ? "unrelaxable" : "relaxable"}`}>
                  {isUnrelaxable ? "Unrelaxable" : "Relaxable"}
                </span>
              </button>

              {isOpen && (
                <div className="sv-bar-content">
                  <ul className="violation-list">
                    {group.violations.map((v, idx) => (
                      <li key={idx} className="violation-item">
                        <span>{formatViolationNice(v)}</span>
                        <span
                          className={
                            isRelaxableViolation(v.type) ? "badge relaxable" : "badge unrelaxable"
                          }
                        >
                          {isRelaxableViolation(v.type) ? "Relaxable" : "Unrelaxable"}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <MiniTimetablePreview
                    title={timetableTitle}
                    busySlots={busySlots}
                    selectedSlots={proposedSlots}
                    unavailableSlots={unavailableSlots}
                    fullTimetableLink={fullTimetableLink}
                  />
                </div>
              )}
            </div>
          );
        })}

        {ungrouped.length > 0 && (
          <div className="sv-bar">
            <button
              type="button"
              className="sv-bar-header"
              onClick={() => toggleGroup("ungrouped")}
              aria-expanded={openGroups.has("ungrouped")}
            >
              <div className="sv-bar-header-main">
                <span className="sv-bar-chevron">
                  <ChevronRight
                    size={14}
                    style={{
                      transform: openGroups.has("ungrouped") ? "rotate(90deg)" : "none",
                      transition: "transform 150ms ease",
                    }}
                  />
                </span>
                <div className="sv-bar-copy">
                  <span className="sv-bar-title">Other</span>
                  <span className="sv-bar-subtitle">
                    {ungrouped.length} {ungrouped.length === 1 ? "rule broken" : "rules broken"}
                  </span>
                </div>
              </div>
            </button>

            {openGroups.has("ungrouped") && (
              <div className="sv-bar-content">
                <ul className="violation-list">
                  {ungrouped.map((v, idx) => (
                    <li key={idx} className="violation-item">
                      <span>{formatViolationNice(v)}</span>
                      <span
                        className={
                          isRelaxableViolation(v.type) ? "badge relaxable" : "badge unrelaxable"
                        }
                      >
                        {isRelaxableViolation(v.type) ? "Relaxable" : "Unrelaxable"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}