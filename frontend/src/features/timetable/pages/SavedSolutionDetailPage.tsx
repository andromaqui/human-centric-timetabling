import { useEffect, useState } from "react";
import type { EventInput } from "@fullcalendar/core";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  GraduationCap,
  MapPin,
  SlidersHorizontal,
  UserRound,
  Users,
} from "lucide-react";

import type { SavedSolution } from "../data/savedSolutionsData";
import { TimetableView } from "../../timetable/components/TimetableView";
import { useTimetableData } from "../../timetable/hooks/useTimetableData";
import {
  ConstraintHierarchy,
  type ConstraintHierarchyEntityGroup,
} from "../../constraints/components/ConstraintHierarchy";
import type { ConstraintDefinition } from "../../constraints/types";
import {
  historicalStakeholderImpacts,
  type HistoricalImpactDetails,
  type HistoricalImpactType,
} from "../data/historicalStakeholderImpact";
import "./SavedSolutionDetailPage.css";

const REFERENCE_WEEK_START = "2026-09-21";

const datesByDay: Record<string, string> = {
  mon: "2026-09-21",
  monday: "2026-09-21",

  tue: "2026-09-22",
  tues: "2026-09-22",
  tuesday: "2026-09-22",

  wed: "2026-09-23",
  wednesday: "2026-09-23",

  thu: "2026-09-24",
  thur: "2026-09-24",
  thurs: "2026-09-24",
  thursday: "2026-09-24",

  fri: "2026-09-25",
  friday: "2026-09-25",
};

function dateForDay(day?: string) {
  if (!day) {
    return REFERENCE_WEEK_START;
  }

  return (
    datesByDay[day.trim().toLowerCase()] ??
    REFERENCE_WEEK_START
  );
}

function formatDay(day?: string | null) {
  if (!day) {
    return "—";
  }

  const days: Record<string, string> = {
    mon: "Monday",
    monday: "Monday",
    tue: "Tuesday",
    tues: "Tuesday",
    tuesday: "Tuesday",
    wed: "Wednesday",
    wednesday: "Wednesday",
    thu: "Thursday",
    thur: "Thursday",
    thurs: "Thursday",
    thursday: "Thursday",
    fri: "Friday",
    friday: "Friday",
  };

  const normalized = day.trim().toLowerCase();

  return (
    days[normalized] ??
    day.charAt(0).toUpperCase() + day.slice(1)
  );
}


function normalizeTime(time?: string) {
  if (!time) {
    return "00:00";
  }

  const match = time.match(/\d{1,2}:\d{2}/);

  if (!match) {
    return "00:00";
  }

  const [hour, minute] = match[0].split(":");

  return `${hour.padStart(2, "0")}:${minute}`;
}

type TimetableFilterType =
  | "all"
  | "lecturer"
  | "cohort"
  | "room";

type FilterableSession = {
  id?: string;

  // Current candidate-solution snapshot shape.
  moduleId?: string;
  lecturerId?: string;
  programIds?: string[];
  cohortIds?: string[];
  start?: string;
  end?: string;
  room?: string;
  type?: string;

  // Older/demo snapshot compatibility.
  moduleCode?: string;
  moduleTitle?: string;
  day?: string;
  startTime?: string;
  endTime?: string;
  lecturer?: string;
  cohorts?: {
    id: string;
    label: string;
  }[];
};

type AdditionalChangeSide = {
  day?: string;
  time?: string;
  room_id?: string;
  room?: string;
  room_name?: string;
  lecturer_id?: string;
  lecturer?: string;
  lecturer_name?: string;
};

type AdditionalTimetableChange = {
  session_id?: string;
  sessionId?: string;
  module_id?: string;
  module_code?: string;
  module_title?: string;

  before?: AdditionalChangeSide;
  after?: AdditionalChangeSide;

  time_changed?: boolean;
  room_changed?: boolean;
  lecturer_changed?: boolean;

  old_day?: string;
  old_time?: string;
  old_room_id?: string;
  old_lecturer_id?: string;

  new_day?: string;
  new_time?: string;
  new_room_id?: string;
  new_lecturer_id?: string;
};

type LecturerOption = {
  id: string;
  name: string;
};

type SavedConstraintSnapshotEntry = {
  group?: string;
  rule: string;
  state: string;
  relaxable: boolean;

  constraint_id?: string;
  constraint_name?: string;
  constraint_description?: string;
  stakeholder?: string;
  constraint_type?: "unrelaxable" | "relaxable";

  entity_id?: string;
  entity_label?: string;

  instance_id?: string;
  instance_type?: "session" | "lecturer" | "cohort" | "room";

  day?: string | null;
  info_text?: string;
  is_activated?: boolean;
};

function getRoomId(side: AdditionalChangeSide) {
  return side.room_id ?? side.room;
}

function getLecturerId(side: AdditionalChangeSide) {
  return side.lecturer_id ?? side.lecturer;
}

function normalizeAdditionalChange(change: AdditionalTimetableChange) {
  const before: AdditionalChangeSide = change.before ?? {
    day: change.old_day,
    time: change.old_time,
    room_id: change.old_room_id,
    lecturer_id: change.old_lecturer_id,
  };

  const after: AdditionalChangeSide = change.after ?? {
    day: change.new_day,
    time: change.new_time,
    room_id: change.new_room_id,
    lecturer_id: change.new_lecturer_id,
  };

  const timeChanged =
    change.time_changed ??
    (before.day !== after.day || before.time !== after.time);

  const roomChanged =
    change.room_changed ??
    (getRoomId(before) !== getRoomId(after));

  const lecturerChanged =
    change.lecturer_changed ??
    (getLecturerId(before) !== getLecturerId(after));

  return {
    before,
    after,
    timeChanged,
    roomChanged,
    lecturerChanged,
  };
}


function formatImpactMinutes(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = minutes / 60;

  return Number.isInteger(hours)
    ? `${hours} ${hours === 1 ? "hour" : "hours"}`
    : `${hours.toFixed(1)} hours`;
}

function getHistoricalOccurrenceCount(
  stakeholderId: string,
  impactType: HistoricalImpactType,
) {
  const history = historicalStakeholderImpacts.find(
    (entry) => entry.stakeholderId === stakeholderId,
  );

  if (!history) {
    return 0;
  }

  return history.impacts
    .filter((impact) => impact.impactType === impactType)
    .reduce((total, impact) => {
      if (impact.details.kind === "lunch-break") {
        return total + impact.details.changes.length;
      }

      return total + 1;
    }, 0);
}

function getHistoricalDecisionCount(
  stakeholderId: string,
  impactType: HistoricalImpactType,
) {
  const history = historicalStakeholderImpacts.find(
    (entry) => entry.stakeholderId === stakeholderId,
  );

  return (
    history?.impacts.filter(
      (impact) => impact.impactType === impactType,
    ).length ?? 0
  );
}

function renderCandidateImpactDetails(
  details: HistoricalImpactDetails,
) {
  if (details.kind === "lunch-break") {
    return (
      <div className="saved-detail-impact-effect-list">
        {details.changes.map((change) => (
          <div
            key={change.day}
            className="saved-detail-impact-effect-row"
          >
            <span className="saved-detail-impact-effect-bullet" />

            <span>
              {change.day.slice(0, 3)} {change.after}
            </span>

            <em>
              ({formatImpactMinutes(change.lostMinutes)} shorter)
            </em>
          </div>
        ))}
      </div>
    );
  }

  if (details.kind === "consecutive-teaching") {
    return (
      <div className="saved-detail-impact-effect-list">
        <div className="saved-detail-impact-effect-row">
          <span className="saved-detail-impact-effect-bullet" />

          <span>
            {details.day.slice(0, 3)} {details.afterWindow}
          </span>

          <em>({details.afterHours} consecutive hours)</em>
        </div>

        <p className="saved-detail-impact-limit">
          Preferred maximum: {details.allowedHours} hours
        </p>
      </div>
    );
  }

  if (details.kind === "daily-teaching-hours") {
    return (
      <div className="saved-detail-impact-effect-list">
        <div className="saved-detail-impact-effect-row">
          <span className="saved-detail-impact-effect-bullet" />

          <span>
            {details.day.slice(0, 3)} {details.afterHours} teaching hours
          </span>
        </div>

        <p className="saved-detail-impact-limit">
          Preferred maximum: {details.allowedHours} hours
        </p>
      </div>
    );
  }

  if (details.kind === "large-timetable-gap") {
    return (
      <div className="saved-detail-impact-effect-list">
        <div className="saved-detail-impact-effect-row">
          <span className="saved-detail-impact-effect-bullet" />

          <span>
            {details.day.slice(0, 3)} {details.afterWindow}
          </span>

          <em>
            ({formatImpactMinutes(details.afterGapMinutes)} gap)
          </em>
        </div>
      </div>
    );
  }

  return (
    <div className="saved-detail-impact-effect-list">
      <div className="saved-detail-impact-effect-row">
        <span className="saved-detail-impact-effect-bullet" />

        <span>
          {details.day.slice(0, 3)} finishes at {details.actualFinish}
        </span>

        <em>
          ({formatImpactMinutes(details.additionalMinutes)} later)
        </em>
      </div>
    </div>
  );
}


type RelatedClassBadge = {
  key: string;
  moduleCode: string;
  moduleTitle?: string;
};

function getTimeStart(time?: string) {
  if (!time) return null;

  const match = time.match(/\d{1,2}:\d{2}/);

  if (!match) return null;

  const [hour, minute] = match[0].split(":");

  return `${hour.padStart(2, "0")}:${minute}`;
}

function getDayKeyFromIso(value?: string) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date
    .toLocaleDateString("en-US", { weekday: "short" })
    .slice(0, 3)
    .toLowerCase();
}

function getTimeKeyFromIso(value?: string) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function CollapsibleHeading({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <summary className="saved-detail-collapsible-summary">
      <div className="saved-detail-collapsible-summary-main">
        <span className="saved-detail-collapsible-icon">
          {icon}
        </span>

        <div className="saved-detail-collapsible-copy">
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>

      <span
        className="saved-detail-collapsible-chevron"
        aria-hidden="true"
      >
        <ChevronRight size={20} />
      </span>
    </summary>
  );
}

export function SavedSolutionDetailPage() {
  const { solutionId } = useParams();

  // The saved snapshot intentionally stores IDs for modules, lecturers,
  // cohorts and programs. Use the normal timetable data only as metadata
  // lookup so the historical start/end/room values still come from the
  // saved solution itself.
  const { data: timetableReferenceData } = useTimetableData();

  const [solution, setSolution] = useState<SavedSolution | null>(null);
  const [isLoadingSolution, setIsLoadingSolution] = useState(true);
  const [solutionError, setSolutionError] = useState<string | null>(null);
  const [lecturerNames, setLecturerNames] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadSolution() {
      if (!solutionId) {
        setSolution(null);
        setSolutionError("No candidate solution ID was provided.");
        setIsLoadingSolution(false);
        return;
      }

      try {
        setIsLoadingSolution(true);
        setSolutionError(null);

        const response = await fetch(
          `http://localhost:8000/candidate-solutions/${encodeURIComponent(
            solutionId,
          )}`,
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Saved solution not found.");
          }

          throw new Error(
            `Failed to load candidate solution (${response.status}).`,
          );
        }

        const data: SavedSolution = await response.json();
        setSolution(data);
      } catch (error) {
        console.error("Failed to load candidate solution:", error);
        setSolution(null);
        setSolutionError(
          error instanceof Error
            ? error.message
            : "Failed to load candidate solution.",
        );
      } finally {
        setIsLoadingSolution(false);
      }
    }

    void loadSolution();
  }, [solutionId]);

  useEffect(() => {
    async function loadLecturerNames() {
      try {
        const response = await fetch("http://localhost:8000/lecturers/");

        if (!response.ok) {
          throw new Error(`Failed to load lecturers (${response.status}).`);
        }

        const lecturers: LecturerOption[] = await response.json();

        setLecturerNames(
          Object.fromEntries(
            lecturers.map((lecturer) => [lecturer.id, lecturer.name]),
          ),
        );
      } catch (error) {
        console.error("Failed to load lecturer names:", error);
        setLecturerNames({});
      }
    }

    void loadLecturerNames();
  }, []);

  if (isLoadingSolution) {
    return (
      <section className="saved-solution-detail-page">
        <div className="saved-solution-not-found">
          <h1>Loading saved solution…</h1>
        </div>
      </section>
    );
  }

  if (!solution) {
    return (
      <section className="saved-solution-detail-page">
        <div className="saved-solution-not-found">
          <h1>Saved solution not found</h1>

          <p>
            {solutionError ??
              "This solution may have been removed or the URL may be incorrect."}
          </p>

          <Link
            to="/saved-solutions"
            className="saved-detail-primary-link"
          >
            <ArrowLeft size={17} />
            Back to Candidate Solutions
          </Link>
        </div>
      </section>
    );
  }

  const stakeholderImpacts =
    solution.stakeholderImpacts ?? [];

  const affectedStakeholders =
    solution.affectedStakeholders ?? [];

  const filterableSessions =
    (solution.resultingSessions ?? []) as unknown as FilterableSession[];

  const constraints =
    (solution.constraints ?? []) as unknown as SavedConstraintSnapshotEntry[];

  const objectives = solution.objectives ?? [];

  const snapshotConstraintDefinitions: ConstraintDefinition[] =
    Array.from(
      new Map(
        constraints
          .filter((constraint) => Boolean(constraint.constraint_id))
          .map((constraint) => {
            const id = constraint.constraint_id!;

            const stakeholder =
              constraint.stakeholder === "Cohort" ||
              constraint.stakeholder === "Session" ||
              constraint.stakeholder === "Room"
                ? constraint.stakeholder
                : "Lecturer";

            const definition: ConstraintDefinition = {
              id,
              name:
                constraint.constraint_name ??
                constraint.rule,
              description:
                constraint.constraint_description ?? "",
              stakeholder,
              type:
                constraint.constraint_type ??
                (constraint.relaxable
                  ? "relaxable"
                  : "unrelaxable"),
            };

            return [id, definition] as const;
          }),
      ).values(),
    );

  const snapshotEntitiesByConstraint =
    constraints.reduce<
      Record<string, ConstraintHierarchyEntityGroup[]>
    >((accumulator, constraint, index) => {
      if (!constraint.constraint_id) {
        return accumulator;
      }

      const constraintId = constraint.constraint_id;

      if (!accumulator[constraintId]) {
        accumulator[constraintId] = [];
      }

      const entityKey =
        constraint.entity_id ??
        `${constraint.instance_type ?? "instance"}-${index}`;

      let entity = accumulator[constraintId].find(
        (item) => item.key === entityKey,
      );

      if (!entity) {
        entity = {
          key: entityKey,
          label:
            constraint.entity_label ??
            constraint.rule,
          isDayScoped: Boolean(constraint.day),
          leaves: [],
        };

        accumulator[constraintId].push(entity);
      }

      entity.isDayScoped =
        entity.isDayScoped || Boolean(constraint.day);

      entity.leaves.push({
        key:
          constraint.instance_id ??
          `${constraintId}-${entityKey}-${index}`,
        label:
          constraint.day ??
          constraint.entity_label ??
          constraint.rule,
        groupLabel: constraint.day
          ? constraint.entity_label ?? null
          : null,
        infoText: constraint.info_text ?? "",
        instanceType:
          constraint.instance_type ?? "session",
        instanceId:
          constraint.instance_id ??
          `${constraintId}-${index}`,
        isActivated:
          constraint.is_activated ??
          !constraint.state
            .toLowerCase()
            .includes("deactivated"),
        relaxation: null,
        statusLabel: constraint.state,
      });

      return accumulator;
    }, {});

  const hasRichConstraintSnapshot =
    snapshotConstraintDefinitions.length > 0;

  const solveSettings = (
    solution as SavedSolution & {
      solveSettings?: {
        objectivesApplicable?: boolean;
      };
      solve_settings?: {
        objectives_applicable?: boolean;
      };
    }
  );

  // New saves explicitly record whether optimization participated in the solve.
  // For older saves, fall back to whether objective rows were actually stored.
  const objectivesApplicable =
    solveSettings.solveSettings?.objectivesApplicable ??
    solveSettings.solve_settings?.objectives_applicable ??
    objectives.length > 0;
  const additionalChanges = (
    solution.additionalChanges ?? []
  ) as unknown as AdditionalTimetableChange[];

  const getLecturerName = (lecturerId?: string) => {
    if (!lecturerId) {
      return "Unassigned";
    }

    const affectedLecturer = affectedStakeholders.find(
      (stakeholder) =>
        stakeholder.type === "lecturer" && stakeholder.id === lecturerId,
    );

    return (
      lecturerNames[lecturerId] ??
      affectedLecturer?.label ??
      "Unknown lecturer"
    );
  };

  const activeConstraints = constraints.filter(
    (constraint) => constraint.state !== "Disabled",
  );

  const inactiveWelfareConstraints = constraints.filter(
    (constraint) => constraint.state === "Disabled",
  );

  const affectedStakeholderCount =
    affectedStakeholders.length;

  const disabledConstraintCount = constraints.filter(
    (constraint) => {
      const state = constraint.state.toLowerCase();

      return (
        state.includes("disabled") ||
        state.includes("deactivated")
      );
    },
  ).length;

  const relaxedConstraintCount = constraints.filter(
    (constraint) =>
      constraint.state
        .toLowerCase()
        .includes("relax"),
  ).length;

  const activeObjectives = objectives.filter(
    (objective) => objective.enabled,
  );

  const additionalChangeSessionIds = new Set(
    additionalChanges
      .map((change) => change.session_id ?? change.sessionId)
      .filter((sessionId): sessionId is string => Boolean(sessionId)),
  );

  const additionalChangeModules = new Set(
    additionalChanges
      .map((change) => change.module_code)
      .filter((module): module is string => Boolean(module)),
  );

  const savedTimetableEvents: EventInput[] =
    filterableSessions.map((savedSession) => {
      const module = timetableReferenceData?.modules.find(
        (item) => item.id === savedSession.moduleId,
      );

      const moduleCode =
        module?.code ??
        savedSession.moduleCode ??
        savedSession.moduleId ??
        "Unknown module";

      const moduleTitle =
        module?.title ??
        savedSession.moduleTitle;

      const lecturer = timetableReferenceData?.lecturers.find(
        (item) => item.id === savedSession.lecturerId,
      );

      const lecturerName =
        lecturer?.name ??
        savedSession.lecturer ??
        (savedSession.lecturerId
          ? lecturerNames[savedSession.lecturerId]
          : undefined) ??
        savedSession.lecturerId ??
        "Unassigned";

      const cohorts =
        savedSession.cohorts?.map((cohort) => ({
          id: cohort.id,
          name: cohort.label,
        })) ??
        (savedSession.cohortIds ?? []).map((cohortId) => {
          const cohort =
            timetableReferenceData?.cohorts.find(
              (item) => item.id === cohortId,
            );

          return {
            id: cohortId,
            name: cohort?.name ?? cohortId,
          };
        });

      const programs =
        (savedSession.programIds ?? []).map((programId) => {
          const program =
            timetableReferenceData?.programs.find(
              (item) => item.id === programId,
            );

          return {
            id: programId,
            name: program?.name ?? programId,
          };
        });

      const date = dateForDay(savedSession.day);

      const start =
        savedSession.start ??
        `${date}T${normalizeTime(savedSession.startTime)}:00`;

      const end =
        savedSession.end ??
        `${date}T${normalizeTime(savedSession.endTime)}:00`;

      return {
        id:
          savedSession.id ??
          `${savedSession.moduleId ?? moduleCode}-${start}-${savedSession.room ?? "room"}`,
        title: moduleTitle
          ? `${moduleCode} · ${moduleTitle}`
          : moduleCode,
        start,
        end,
        extendedProps: {
          moduleCode,
          moduleId: savedSession.moduleId,
          session: {
            id: savedSession.id,
            room: savedSession.room ?? "TBC",
          },
          lecturer: {
            id:
              savedSession.lecturerId ??
              lecturerName,
            name: lecturerName,
          },
          cohorts,
          programs,
        },
      } satisfies EventInput;
    });


  const requestedSessionId =
    (
      solution as SavedSolution & {
        requestedSessionId?: string;
        requested_session_id?: string;
      }
    ).requestedSessionId ??
    (
      solution as SavedSolution & {
        requested_session_id?: string;
      }
    ).requested_session_id ??
    null;


  const requestedModule = timetableReferenceData?.modules.find(
    (module) => module.code === solution.moduleCode,
  );

  const requestedResultDay =
    solution.result.day.trim().slice(0, 3).toLowerCase();
  const requestedResultStart = getTimeStart(solution.result.time);

  const requestedSnapshotSession =
    filterableSessions.find(
      (session) => session.id === requestedSessionId,
    ) ??
    filterableSessions.find((session) => {
      if (
        requestedModule &&
        session.moduleId !== requestedModule.id
      ) {
        return false;
      }

      if (!requestedModule && session.moduleCode !== solution.moduleCode) {
        return false;
      }

      const day =
        session.day?.trim().slice(0, 3).toLowerCase() ??
        getDayKeyFromIso(session.start);

      const startTime =
        getTimeStart(session.startTime) ??
        getTimeKeyFromIso(session.start);

      return (
        day === requestedResultDay &&
        (!requestedResultStart ||
          startTime === requestedResultStart)
      );
    });

  const changedSessionClassBadges = new Map<
    string,
    RelatedClassBadge
  >();

  function addChangedSessionBadge(
    session: FilterableSession | undefined,
    fallbackCode?: string,
    fallbackTitle?: string,
  ) {
    if (!session && !fallbackCode) return;

    const module = timetableReferenceData?.modules.find(
      (item) => item.id === session?.moduleId,
    );

    const moduleCode =
      module?.code ??
      session?.moduleCode ??
      fallbackCode ??
      session?.moduleId ??
      "Class";

    const moduleTitle =
      module?.title ??
      session?.moduleTitle ??
      fallbackTitle;

    const key =
      session?.id ??
      `${moduleCode}-${moduleTitle ?? ""}`;

    changedSessionClassBadges.set(key, {
      key,
      moduleCode,
      moduleTitle,
    });
  }

  addChangedSessionBadge(
    requestedSnapshotSession,
    solution.moduleCode,
    solution.moduleTitle,
  );

  additionalChanges.forEach((change) => {
    const sessionId =
      change.session_id ?? change.sessionId;

    const session = sessionId
      ? filterableSessions.find(
          (item) => item.id === sessionId,
        )
      : undefined;

    addChangedSessionBadge(
      session,
      change.module_code,
      change.module_title,
    );
  });

  const getRelatedClassesForStakeholder = (
    stakeholder: (typeof affectedStakeholders)[number],
  ): RelatedClassBadge[] => {
    const related = new Map<string, RelatedClassBadge>();

    const considerSession = (
      session: FilterableSession | undefined,
      fallbackCode?: string,
      fallbackTitle?: string,
    ) => {
      if (!session) return;

      const matches =
        stakeholder.type === "lecturer"
          ? session.lecturerId === stakeholder.id
          : stakeholder.type === "cohort"
            ? (session.cohortIds ?? []).includes(
                stakeholder.id,
              )
            : stakeholder.type === "room"
              ? session.room === stakeholder.label
              : false;

      if (!matches) return;

      const module = timetableReferenceData?.modules.find(
        (item) => item.id === session.moduleId,
      );

      const moduleCode =
        module?.code ??
        session.moduleCode ??
        fallbackCode ??
        session.moduleId ??
        "Class";

      const moduleTitle =
        module?.title ??
        session.moduleTitle ??
        fallbackTitle;

      const key = `${moduleCode}-${moduleTitle ?? ""}`;

      related.set(key, {
        key,
        moduleCode,
        moduleTitle,
      });
    };

    considerSession(
      requestedSnapshotSession,
      solution.moduleCode,
      solution.moduleTitle,
    );

    additionalChanges.forEach((change) => {
      const sessionId =
        change.session_id ?? change.sessionId;

      const session = sessionId
        ? filterableSessions.find(
            (item) => item.id === sessionId,
          )
        : undefined;

      considerSession(
        session,
        change.module_code,
        change.module_title,
      );
    });

    return Array.from(related.values());
  };

  return (
    <section className="saved-solution-detail-page">
      <Link
        to="/saved-solutions"
        className="saved-detail-back-link"
      >
        <ArrowLeft size={17} />
        All Candidate Solutions
      </Link>

      <header className="saved-detail-header">
        <div>
          <div className="saved-detail-title-row">
            <span className="saved-detail-module-code">
              {solution.moduleCode}
            </span>

            <span className="saved-detail-status">
              <CheckCircle2 size={15} />
              Saved solution
            </span>
          </div>

          <h1>{solution.moduleTitle}</h1>

          <p>{solution.requestSummary}</p>
        </div>

        <div className="saved-detail-meta">
          <span>
            Saved{" "}
            {new Date(solution.savedAt).toLocaleDateString(
              undefined,
              {
                day: "numeric",
                month: "long",
                year: "numeric",
              },
            )}
          </span>

          <span>Solution ID: {solution.id}</span>
        </div>
      </header>

      <div className="saved-detail-layout">
        <main className="saved-detail-main">
          <details
            className="saved-detail-card saved-detail-collapsible"
            open
          >
            <CollapsibleHeading
              icon={<CalendarDays size={20} />}
              title="Requested change"
              description="The timetable change that produced this saved solution."
            />

            <div className="saved-detail-collapsible-content">

            <div className="saved-detail-change">
              <div className="saved-detail-change-column">
                <span className="saved-detail-label">From</span>

                <strong>{formatDay(solution.original.day)}</strong>

                <div>
                  <Clock size={16} />
                  {solution.original.time}
                </div>

                <div>
                  <MapPin size={16} />
                  {solution.original.room}
                </div>

                <div>
                  <Users size={16} />
                  {solution.original.lecturer}
                </div>
              </div>

              <div className="saved-detail-change-arrow">
                <ArrowRight size={26} />
              </div>

              <div className="saved-detail-change-column">
                <span className="saved-detail-label">To</span>

                <strong>{formatDay(solution.result.day)}</strong>

                <div>
                  <Clock size={16} />
                  {solution.result.time}
                </div>

                <div>
                  <MapPin size={16} />
                  {solution.result.room}
                </div>

                <div>
                  <Users size={16} />
                  {solution.result.lecturer}
                </div>
              </div>
            </div>
            </div>
          </details>

          {additionalChanges.length > 0 && (
            <details
              className="saved-detail-card saved-detail-collapsible"
              open
            >
              <CollapsibleHeading
                icon={<SlidersHorizontal size={20} />}
                title="Additional timetable changes"
                description="Other sessions changed to make the requested move possible."
              />

              <div className="saved-detail-collapsible-content">

              <div className="saved-detail-additional-list">
                {additionalChanges.map((change, index) => {
                  const {
                    before,
                    after,
                    timeChanged,
                    roomChanged,
                    lecturerChanged,
                  } = normalizeAdditionalChange(change);

                  const beforeRoom = getRoomId(before);
                  const afterRoom = getRoomId(after);
                  const beforeLecturerId = getLecturerId(before);
                  const afterLecturerId = getLecturerId(after);

                  const changeKey =
                    change.session_id ??
                    change.sessionId ??
                    change.module_id ??
                    change.module_code ??
                    String(index);

                  const changeTitle =
                    change.module_code
                      ? change.module_title
                        ? `${change.module_code} · ${change.module_title}`
                        : change.module_code
                      : change.module_id ??
                        change.session_id ??
                        change.sessionId ??
                        "Additional change";

                  return (
                    <article
                      key={`${changeKey}-${index}`}
                      className="saved-detail-additional-change"
                    >
                      <h3>{changeTitle}</h3>

                      <div className="saved-detail-additional-grid">
                        <div>
                          <span>Before</span>

                          {timeChanged && (
                            <>
                              <strong>{formatDay(before.day)}</strong>
                              <p>
                                <Clock size={16} />
                                {before.time ?? "—"}
                              </p>
                            </>
                          )}

                          {roomChanged && (
                            <p>
                              <MapPin size={16} />
                              {before.room_name ?? beforeRoom ?? "No room"}
                            </p>
                          )}

                          {lecturerChanged && (
                            <p>
                              <UserRound size={16} />
                              {before.lecturer_name ??
                                getLecturerName(beforeLecturerId)}
                            </p>
                          )}
                        </div>

                        <ArrowRight size={20} />

                        <div>
                          <span>After</span>

                          {timeChanged && (
                            <>
                              <strong>{formatDay(after.day)}</strong>
                              <p>
                                <Clock size={16} />
                                {after.time ?? "—"}
                              </p>
                            </>
                          )}

                          {roomChanged && (
                            <p>
                              <MapPin size={16} />
                              {after.room_name ?? afterRoom ?? "No room"}
                            </p>
                          )}

                          {lecturerChanged && (
                            <p>
                              <UserRound size={16} />
                              {after.lecturer_name ??
                                getLecturerName(afterLecturerId)}
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}              </div>
              </div>
            </details>
          )}

          {stakeholderImpacts.length > 0 && (
            <details
              className="saved-detail-card saved-detail-collapsible saved-detail-impact-section"
              open
            >
              <CollapsibleHeading
                icon={<AlertTriangle size={20} />}
                title="Stakeholder welfare impact"
                description={`${stakeholderImpacts.length} detected impact${
                  stakeholderImpacts.length === 1 ? "" : "s"
                } linked to inactive welfare constraints.`}
              />

              <div className="saved-detail-collapsible-content">
                <div className="saved-detail-impact-list">
                  {stakeholderImpacts.map((impact) => {
                    const historicalOccurrences =
                      getHistoricalOccurrenceCount(
                        impact.stakeholderId,
                        impact.impactType,
                      );

                    const historicalDecisions =
                      getHistoricalDecisionCount(
                        impact.stakeholderId,
                        impact.impactType,
                      );

                    const StakeholderIcon =
                      impact.stakeholderType === "lecturer"
                        ? UserRound
                        : GraduationCap;

                    return (
                      <article
                        key={`${impact.stakeholderId}-${impact.impactType}`}
                        className="saved-detail-impact-card"
                      >
                        <div className="saved-detail-impact-identity">
                          <span className="saved-detail-impact-avatar">
                            <StakeholderIcon
                              size={24}
                              aria-hidden="true"
                            />
                          </span>

                          <div className="saved-detail-impact-identity-copy">
                            <span className="saved-detail-impact-type">
                              {impact.stakeholderType}
                            </span>

                            <h3>{impact.stakeholderName}</h3>

                            <span className="saved-detail-impact-label">
                              {impact.title}
                            </span>
                          </div>
                        </div>

                        <div className="saved-detail-impact-current">
                          <span className="saved-detail-impact-column-title">
                            This solution affects
                          </span>

                          {renderCandidateImpactDetails(
                            impact.details,
                          )}
                        </div>

                        <div className="saved-detail-impact-history">
                          <span className="saved-detail-impact-column-title">
                            Historical context
                          </span>

                          <strong>
                            {historicalOccurrences} previous{" "}
                            {historicalOccurrences === 1
                              ? "occurrence"
                              : "occurrences"}
                          </strong>

                          <span>
                            across {historicalDecisions} accepted{" "}
                            {historicalDecisions === 1
                              ? "decision"
                              : "decisions"}
                          </span>

                          <Link
                            to={`/historical-impact?stakeholder=${encodeURIComponent(
                              impact.stakeholderId,
                            )}&impact=${encodeURIComponent(
                              impact.impactType,
                            )}`}
                          >
                            View full history
                            <ArrowRight size={16} />
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </details>
          )}

          <details
            className="saved-detail-card saved-detail-collapsible"
            open
          >
            <CollapsibleHeading
              icon={<CheckCircle2 size={20} />}
              title="Constraint settings"
              description="Constraint settings captured when this solution was generated."
            />

            <div className="saved-detail-collapsible-content">
              {hasRichConstraintSnapshot ? (
                <ConstraintHierarchy
                  constraints={snapshotConstraintDefinitions}
                  entitiesByConstraint={snapshotEntitiesByConstraint}
                  mode="snapshot"
                  hideEmptyConstraints
                  showStatusSummary
                  allowExceptionFilter
                  initialOpenStakeholders={["Lecturer"]}
                />
              ) : (
                <div className="saved-detail-table-wrapper">
                  <table className="saved-detail-table">
                    <thead>
                      <tr>
                        <th>Stakeholder</th>
                        <th>Constraint</th>
                        <th>Status</th>
                        <th>Relaxable</th>
                      </tr>
                    </thead>

                    <tbody>
                      {constraints.map((constraint, index) => (
                        <tr key={`${constraint.rule}-${index}`}>
                          <td>{constraint.group ?? "—"}</td>
                          <td>{constraint.rule}</td>
                          <td>
                            <span
                              className={[
                                "saved-detail-badge",
                                constraint.state === "Disabled"
                                  ? "saved-detail-badge-disabled"
                                  : constraint.state
                                        .toLowerCase()
                                        .includes("relaxed")
                                    ? "saved-detail-badge-warning"
                                    : "saved-detail-badge-success",
                              ].join(" ")}
                            >
                              {constraint.state}
                            </span>
                          </td>
                          <td>
                            {constraint.relaxable ? "Yes" : "No"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </details>

          <details
            className="saved-detail-card saved-detail-collapsible"
            open
          >
            <CollapsibleHeading
              icon={<SlidersHorizontal size={20} />}
              title="Active objectives"
              description="Objective weights used to rank candidate solutions."
            />

            <div className="saved-detail-collapsible-content">
              {objectivesApplicable ? (
                <div className="saved-detail-objectives">
                  {activeObjectives.map((objective) => (
                    <div
                      key={objective.id}
                      className="saved-detail-objective"
                    >
                      <div className="saved-detail-objective-copy">
                        <span>{objective.stakeholder}</span>
                        <strong>{objective.label}</strong>
                      </div>

                      <div className="saved-detail-objective-weight">
                        <div
                          className="saved-detail-objective-fill"
                          style={{
                            width: `${objective.weight}%`,
                          }}
                        />

                        <span>{objective.weight}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="saved-detail-objectives-not-applicable">
                  <strong>Optimization priorities not applicable</strong>
                  <p>
                    This was a feasibility-only request. The permitted outcome was
                    fully specified, so the solver did not need to rank alternative
                    solutions using objective weights.
                  </p>
                </div>
              )}
            </div>
          </details>

          <details
            className="saved-detail-card saved-detail-collapsible"
            open
          >
            <CollapsibleHeading
              icon={<CalendarDays size={20} />}
              title="Resulting timetable"
              description="Complete timetable snapshot produced by this saved solution."
            />

            <div className="saved-detail-collapsible-content">
              <TimetableView
                events={savedTimetableEvents}
                showHeader={false}
                showLegend={false}
                showFilters
                showWeekHeading
                showLecturerAvailability={false}
                readOnly
                embedded
                requestedSessionId={requestedSessionId}
                requestedModuleCode={solution.moduleCode}
                additionalChangeSessionIds={additionalChangeSessionIds}
                additionalChangeModuleCodes={additionalChangeModules}
                showSolutionLegend
              />
            </div>
          </details>
        </main>

        <aside className="saved-detail-sidebar">
          <details
            className="saved-detail-card saved-detail-collapsible saved-detail-sidebar-collapsible"
            open
          >
            <summary className="saved-detail-collapsible-summary">
              <div className="saved-detail-collapsible-summary-main">
                <div className="saved-detail-collapsible-copy">
                  <h2>Solution summary</h2>
                </div>
              </div>

              <span
                className="saved-detail-collapsible-chevron"
                aria-hidden="true"
              >
                <ChevronRight size={20} />
              </span>
            </summary>

            <div className="saved-detail-sidebar-content saved-detail-summary-card">
              <dl>
              <div>
                <dt>Request type</dt>
                <dd>
                  {solution.requestType
                    .replaceAll("-", " ")
                    .replace(/\b\w/g, (letter) =>
                      letter.toUpperCase(),
                    )}
                </dd>
              </div>

              <div>
                <dt>Primary changes</dt>
                <dd>1</dd>
              </div>

              <div>
                <dt>Additional changes</dt>
                <dd>{additionalChanges.length}</dd>
              </div>

              <div>
                <dt>Affected stakeholders</dt>
                <dd>{affectedStakeholderCount}</dd>
              </div>

              <div>
                <dt>Active constraints</dt>
                <dd>{activeConstraints.length}</dd>
              </div>

              <div className="saved-detail-summary-warning">
                <dt>Constraints disabled</dt>
                <dd>{disabledConstraintCount}</dd>
              </div>

              <div className="saved-detail-summary-warning">
                <dt>Constraints relaxed</dt>
                <dd>{relaxedConstraintCount}</dd>
              </div>

              <div className="saved-detail-summary-danger">
                <dt>Welfare impacts</dt>
                <dd>{stakeholderImpacts.length}</dd>
              </div>

              <div>
                <dt>Optimization priorities</dt>
                <dd>
                  {objectivesApplicable
                    ? `${activeObjectives.length} active`
                    : "Not applicable"}
                </dd>
              </div>
              </dl>
            </div>
          </details>

          <details
            className="saved-detail-card saved-detail-collapsible saved-detail-sidebar-collapsible"
            open
          >
            <summary className="saved-detail-collapsible-summary">
              <div className="saved-detail-collapsible-summary-main">
                <div className="saved-detail-collapsible-copy">
                  <h2>Affected stakeholders</h2>
                </div>
              </div>

              <span
                className="saved-detail-collapsible-chevron"
                aria-hidden="true"
              >
                <ChevronRight size={20} />
              </span>
            </summary>

            <div className="saved-detail-sidebar-content">
              <div className="saved-detail-stakeholders">
              {affectedStakeholders.map(
                (stakeholder) => {
                  const impactCount = stakeholderImpacts.filter(
                    (impact) => impact.stakeholderId === stakeholder.id,
                  ).length;

                  const relatedClasses =
                    getRelatedClassesForStakeholder(
                      stakeholder,
                    );

                  return (
                    <Link
                      key={`${stakeholder.type}-${stakeholder.id}`}
                      to={`/timetable-preview?${stakeholder.type}=${encodeURIComponent(
                        stakeholder.type === "room"
                          ? stakeholder.label
                          : stakeholder.id,
                      )}&solution=${encodeURIComponent(solution.id)}`}
                      className="saved-detail-stakeholder"
                    >
                      <div className="saved-detail-stakeholder-copy">
                        <span>{stakeholder.type}</span>
                        <strong>{stakeholder.label}</strong>

                        {relatedClasses.length > 0 && (
                          <div className="saved-detail-stakeholder-class-badges">
                            {relatedClasses.map(
                              (relatedClass) => (
                                <span
                                  key={relatedClass.key}
                                  className="saved-detail-stakeholder-class-badge"
                                >
                                  {relatedClass.moduleCode}
                                  {relatedClass.moduleTitle
                                    ? ` · ${relatedClass.moduleTitle}`
                                    : ""}
                                </span>
                              ),
                            )}
                          </div>
                        )}
                      </div>

                      <span className="saved-detail-stakeholder-action">
                        {impactCount > 0 && (
                          <span className="saved-detail-stakeholder-impact-count">
                            {impactCount} impact
                            {impactCount === 1 ? "" : "s"}
                          </span>
                        )}
                        <ArrowRight size={17} />
                      </span>
                    </Link>
                  );
                },
              )}
              </div>
            </div>
          </details>
        </aside>
      </div>
    </section>
  );
}
