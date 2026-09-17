import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Clock, MapPin, User, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { MiniTimetablePreview } from "../components/MiniTimetablePreview";
import { InteractiveRepair } from "../components/InteractiveRepair.tsx";
import { ObjectivesPanel } from "../components/objectives/ObjectivesPanel";
import { ConstraintsOverviewPanel } from "../components/constraints/ConstraintsOverviewPanel";
import { Step4Solution, type TemporaryConstraintDeactivation, } from "../components/solution/Step4Solution.tsx";
import { sessionToSlotIds, getBusySlots, } from "../data/timetableData";
import { useTimetableData } from "../hooks/useTimetableData";
import { api } from "../../../shared/api/client";
import type {Cohort, Lecturer, Program, Session, Objective, ObjectiveStakeholder,} from "../types";
import "./ReschedulePage.css";
import { RoomSuitability } from "../components/RoomSuitability";

function formatViolation(v: Violation): string {
  switch (v.type) {
    case "lecturer_overlap":
      return `Lecturer is already teaching another class (${v.blocking_session_id})`;
    case "room_overlap":
      return `Room is already occupied by another class (${v.blocking_session_id})`;
    case "lecturer_unavailable":
      return `Lecturer is unavailable on ${v.day} at ${v.hour}:00`;
    case "class_capacity":
      return `Room capacity too small (needs ${v.required_capacity}, has ${v.room_capacity})`;
    case "class_equipment":
      return `Room missing equipment: ${(v.missing_equipment || []).join(", ")}`;
    case "lecturer_daily_hours":
      return `Lecturer would exceed daily hours limit (${v.total_hours}h > ${v.limit}h)`;
    case "cohort_daily_hours":
      return `Cohort would exceed daily hours limit (${v.total_hours}h > ${v.limit}h)`;
    case "lecturer_lunch_break":
      return `Lecturer would have no lunch break on ${v.day}`;
    default:
      return v.type;
  }
}

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

type RelatedConstraintRow = {
  key: string;
  group: "Lecturer" | "Cohorts" | "Rooms / class";
  entityLabel: string;
  constraintId: string;
  constraintName: string;
  relaxable: boolean;
  isActivated: boolean;
  relaxation: RelaxationOut | null;
};

// Read-only constraint overview used by Step 2.
// Unlike relatedConstraints above, this represents every ACTIVE constraint
// instance in the system, grouped in the same hierarchy as ConstraintsPage.
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

const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};

function buildTimetableLocalStart(
  referenceStart: string | Date,
  day: string,
  time: string,
): string | null {
  const dayIndex: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  const requestedDayIndex = dayIndex[day];
  if (requestedDayIndex === undefined) return null;

  const currentStart = new Date(referenceStart);
  const requestedDate = new Date(currentStart);

  requestedDate.setDate(
    currentStart.getDate() + (requestedDayIndex - currentStart.getDay()),
  );

  const [hours, minutes = 0] = time.split(":").map(Number);
  requestedDate.setHours(hours, minutes, 0, 0);

  const year = requestedDate.getFullYear();
  const month = String(requestedDate.getMonth() + 1).padStart(2, "0");
  const date = String(requestedDate.getDate()).padStart(2, "0");
  const hour = String(requestedDate.getHours()).padStart(2, "0");
  const minute = String(requestedDate.getMinutes()).padStart(2, "0");

  // Important: the solver expects timetable wall-clock time.
  // Do NOT use toISOString() here, because that converts the selected
  // local time to UTC and can shift (for example) 12:00 to 10:00.
  return `${year}-${month}-${date}T${hour}:${minute}:00`;
}

function formatTimetableDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}:00`;
}

async function fetchRelaxation(
  instanceType: "session" | "lecturer" | "cohort" | "room",
  instanceId: string,
): Promise<RelaxationOut | null> {
  const relaxations = await api.get<RelaxationOut[]>(
    `/relaxations/?instance_type=${instanceType}&instance_id=${instanceId}`,
  );
  return relaxations[0] ?? null;
}

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

type WizardStep = 1 | 2 | 3 | 4;

type SelectedEvent = {
  session: Session;
  lecturer?: Lecturer;
  programs: Program[];
  cohorts: Cohort[];
};

type ApiLecturerUnavailability = {
  id: number;
  lecturer_id?: string;
  day: string;
  hour: number;
};

type RescheduleRequest = {
  session_id: string;
  time_mode: "keep" | "specific" | "find";
  requested_start: string | null;
  room_mode: "keep" | "specific" | "find";
  requested_room_id: string | null;
  lecturer_mode: "keep" | "specific" | "find";
  requested_lecturer_id: string | null;
  temporarily_deactivated_constraints?: TemporaryConstraintDeactivation[];
  max_additional_changes?: number | null;
};

type RescheduleSolution = {
  start_slot: number;
  day: string;
  time: string;
  room_id: string;
  lecturer_id: string;
};

type Violation = {
  type: string;
  [key: string]: any; // allows lecturer_id, room_id, blocking_session_id, etc.
};

type Diagnostics = {
  violations: Violation[];
  overlapping_sessions: string[];
};

type AdditionalChange = {
  session_id: string;

  time_changed: boolean;
  old_start_slot: number;
  new_start_slot: number;
  old_day: string;
  old_time: string;
  new_day: string;
  new_time: string;

  room_changed: boolean;
  old_room_id: string;
  new_room_id: string;
};

type RecoveryOptions = {
  can_perturb: boolean;
  minimum_perturbations: number | null;
};

type RescheduleResponse =
  | {
      status: "feasible";
      reason: null;
      session_id: string;
      solution?: RescheduleSolution;
      start_slot?: number;
      day?: string;
      time?: string;
      room_id?: string;
      lecturer_id?: string;
      additional_changes?: AdditionalChange[];
    }
  | {
      status: "infeasible" | "invalid" | "success";
      reason: string | null;
      session_id?: string;
      diagnostics?: Diagnostics | null;
      recovery_options?: RecoveryOptions;
    };

const initialObjectives: Objective[] = [
  {
    id: "lecturer-pref",
    label: "Minimize lecturer preference violations",
    stakeholder: "Lecturer",
    weight: 50,
    enabled: true,
  },
  {
    id: "lecturer-idle",
    label: "Minimize lecturer idle time",
    stakeholder: "Lecturer",
    weight: 50,
    enabled: true,
  },
  {
    id: "lecturer-balance",
    label: "Balance lecturer workload",
    stakeholder: "Lecturer",
    weight: 50,
    enabled: true,
  },
  {
    id: "cohort-gaps",
    label: "Minimize cohort timetable gaps",
    stakeholder: "Cohort",
    weight: 50,
    enabled: true,
  },
  {
    id: "cohort-balance",
    label: "Balance cohort daily workload",
    stakeholder: "Cohort",
    weight: 50,
    enabled: true,
  },
  {
    id: "room-changes",
    label: "Minimize back-to-back room changes",
    stakeholder: "Room",
    weight: 50,
    enabled: true,
  },
  {
    id: "room-util",
    label: "Maximize room utilization",
    stakeholder: "Room",
    weight: 50,
    enabled: true,
  },
  {
    id: "room-waste",
    label: "Minimize room capacity waste",
    stakeholder: "Room",
    weight: 50,
    enabled: true,
  },
  {
    id: "num-changes",
    label: "Minimize the number of timetable changes",
    stakeholder: "General",
    weight: 50,
    enabled: true,
  },
  {
    id: "soft-violations",
    label: "Minimize soft constraint violations",
    stakeholder: "General",
    weight: 50,
    enabled: true,
  },
];

export function ReschedulePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { data } = useTimetableData();
  const [step, setStep] = useState<WizardStep>(1);
  const [furthestStep, setFurthestStep] = useState<WizardStep>(1);

  // Use for any *forward* navigation (Continue, skip-to-4). Going back
  // (the Back button) should not affect how far the sidebar unlocks.
  function goToStep(nextStep: WizardStep) {
    setStep(nextStep);
    setFurthestStep((current) => (nextStep > current ? nextStep : current));
  }

  const [objectives, setObjectives] = useState<Objective[]>(initialObjectives);
  const [showSchedulePreview, setShowSchedulePreview] = useState(true);
  const [hiddenSchedules, setHiddenSchedules] = useState<string[]>([]);
  const [lecturerKnowledge, setLecturerKnowledge] = useState<
    "known" | "find" | null
  >(null);
  const [selectedLecturer, setSelectedLecturer] = useState<string | null>(null);

  const [lecturerUnavailableSlotMap, setLecturerUnavailableSlotMap] =
    useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!data) {
      setLecturerUnavailableSlotMap({});
      return;
    }

    let cancelled = false;

    async function loadLecturerUnavailability() {
      const entries = await Promise.all(
        data!.lecturers.map(async (lecturer) => {
          try {
            const rows = await api.get<ApiLecturerUnavailability[]>(
              `/lecturers/${encodeURIComponent(lecturer.id)}/unavailability`,
            );

            const slotIds = rows.map((row) => {
              const day = row.day.trim().slice(0, 3).toLowerCase();
              const hour = String(row.hour).padStart(2, "0");

              return `${day}-${hour}`;
            });

            return [lecturer.id, slotIds] as const;
          } catch (error) {
            console.error(
              `Failed to load unavailability for ${lecturer.name}:`,
              error,
            );

            return [lecturer.id, []] as const;
          }
        }),
      );

      if (!cancelled) {
        setLecturerUnavailableSlotMap(Object.fromEntries(entries));
      }
    }

    loadLecturerUnavailability();

    return () => {
      cancelled = true;
    };
  }, [data]);

  function getLecturerUnavailableSlots(lecturerId?: string) {
    if (!lecturerId) return [];
    return lecturerUnavailableSlotMap[lecturerId] ?? [];
  }

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const timeSlots = [
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
  ];

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  type ChangeType = "time" | "room" | "lecturer" | "both" | null;
  type TimeKnowledge = "known" | "find" | null;
  type RescheduleScope = "only" | "up-to-2" | "up-to-3" | null;

  const [changeType, setChangeType] = useState<ChangeType>(null);
  const [timeKnowledge, setTimeKnowledge] = useState<TimeKnowledge>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [rescheduleScope, setRescheduleScope] = useState<RescheduleScope>(null);
  const [solverResult, setSolverResult] = useState<RescheduleResponse | null>(null);
  const [perturbationPreview, setPerturbationPreview] = useState<RescheduleResponse | null>(null);
  const [solverLoading, setSolverLoading] = useState(false);
  const [solverError, setSolverError] = useState<string | null>(null);

  const [
    showAnalyticalExploration,
    setShowAnalyticalExploration,
  ] = useState(false);
  const [
    analyticalExplorationOpen,
    setAnalyticalExplorationOpen,
  ] = useState(true);
  const [
    appliedTemporaryDeactivations,
    setAppliedTemporaryDeactivations,
  ] = useState<TemporaryConstraintDeactivation[]>([]);

  const [originalModes, setOriginalModes] = useState<{
    time: "keep" | "specific" | "find";
    room: "keep" | "specific" | "find";
    lecturer: "keep" | "specific" | "find";
  } | null>(null);

  const [diagLecturer, setDiagLecturer] = useState<string | null>(null);
  const [diagDay, setDiagDay] = useState<string | null>(null);
  const [diagTime, setDiagTime] = useState<string | null>(null);
  const [diagRoom, setDiagRoom] = useState<string | null>(null);

  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState<Diagnostics | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);

  const stepOneInvalid =
    !changeType ||
    (
      (changeType === "time" || changeType === "both") &&
      !timeKnowledge
    ) ||
    (
      (changeType === "time" || changeType === "both") &&
      timeKnowledge === "known" &&
      (!selectedDay || !selectedTime)
    ) ||
    (
      (changeType === "room" || changeType === "both") &&
      !selectedRoom
    ) ||
    (
      changeType === "lecturer" &&
      !lecturerKnowledge
    ) ||
    (
      changeType === "lecturer" &&
      lecturerKnowledge === "known" &&
      !selectedLecturer
    );

  const availableRooms = useMemo(
    () => data?.rooms.map((room) => room.name) ?? [],
    [data],
  );

  // The three change modes as they currently stand from Step 1's selections.
  // Extracted here (rather than only inline in buildRescheduleRequest) so the
  // Priorities step can decide, before submission, whether anything is
  // actually free for the solver to optimise over.
  const currentModes = useMemo(() => {
    let time: RescheduleRequest["time_mode"] = "keep";
    let room: RescheduleRequest["room_mode"] = "keep";
    let lecturer: RescheduleRequest["lecturer_mode"] = "keep";

    if (changeType === "time" || changeType === "both") {
      time = timeKnowledge === "known" ? "specific" : timeKnowledge === "find" ? "find" : "keep";
    }

    if (changeType === "room" || changeType === "both") {
      room = selectedRoom ? "specific" : "find";
    }

    if (changeType === "lecturer") {
      lecturer =
        lecturerKnowledge === "known" ? "specific" : lecturerKnowledge === "find" ? "find" : "keep";
    }

    return { time, room, lecturer };
  }, [changeType, timeKnowledge, selectedRoom, lecturerKnowledge]);

  // Objectives matter whenever the solver has alternatives to compare:
  // either a requested dimension is left as FIND, or the user allows
  // collateral timetable changes. If everything is KEEP/SPECIFIC and the
  // scope is "only", this is a pure yes/no feasibility check.
  const objectivesApplicable =
    currentModes.time === "find" ||
    currentModes.room === "find" ||
    currentModes.lecturer === "find" ||
    rescheduleScope !== "only";

  const selectedEvent = useMemo<SelectedEvent | null>(() => {
    if (!data) return null;

    const session = data.sessions.find(
      (item) => item.id === sessionId,
    );
    if (!session) return null;

    return {
      session,
      lecturer: data.lecturers.find(
        (lecturer) => lecturer.id === session.lecturerId,
      ),
      programs: data.programs.filter((program) =>
        session.programIds.includes(program.id),
      ),
      cohorts: data.cohorts.filter((cohort) =>
        session.cohortIds.includes(cohort.id),
      ),
    };
  }, [sessionId, data]);

  const selectedModule = useMemo(() => {
    if (!data || !selectedEvent) return undefined;
    return data.modules.find(
      (module) => module.id === selectedEvent!.session.moduleId,
    );
  }, [data, selectedEvent]);

  const selectedRoomData = useMemo(() => {
  if (!data || !selectedEvent) return undefined;

  const roomName =
    selectedRoom ?? selectedEvent.session.room;

  return data.rooms.find(
    (room) => room.name === roomName,
  );
  }, [data, selectedEvent, selectedRoom]);

  function getSessionLabel(sessionId: string): string {
    if (!data) return sessionId;
    const session = data.sessions.find((s) => s.id === sessionId);
    if (!session) return sessionId;
    const mod = data.modules.find((m) => m.id === session.moduleId);
    return mod ? `${mod.code} · ${mod.title}` : sessionId;
  }

  function getLecturerName(lecturerId: string): string {
    return data?.lecturers.find((l) => l.id === lecturerId)?.name ?? lecturerId;
  }

  function getRoomName(roomId: string): string {
    return data?.rooms.find((r) => r.id === roomId)?.name ?? roomId;
  }

  function getCohortName(cohortId: string): string {
    return data?.cohorts.find((c) => c.id === cohortId)?.name ?? cohortId;
  }

  function formatDay(day: string): string {
    return day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
  }

  function isRelaxableViolation(type: string): boolean {
    const relaxable = new Set([
      "class_capacity",
      "class_equipment",
      "lecturer_daily_hours",
      "cohort_daily_hours",
      "lecturer_lunch_break",
    ]);
    return relaxable.has(type);
  }

  function formatViolationNice(v: Violation): string {
    switch (v.type) {
      case "lecturer_overlap":
        return `Lecturer ${getLecturerName(v.lecturer_id)} is already teaching ${getSessionLabel(v.blocking_session_id)}`;
      case "room_overlap":
        return `Room ${getRoomName(v.room_id)} is already used by ${getSessionLabel(v.blocking_session_id)}`;
      case "lecturer_unavailable":
        return `${getLecturerName(v.lecturer_id)} is unavailable on ${formatDay(v.day)} at ${v.hour}:00`;
      case "class_capacity":
        return `Room ${getRoomName(v.room_id)} is too small (needs ${v.required_capacity}, has ${v.room_capacity})`;
      case "class_equipment":
        return `Room ${getRoomName(v.room_id)} is missing: ${(v.missing_equipment || []).join(", ")}`;
      case "lecturer_daily_hours":
        return `${getLecturerName(v.lecturer_id)} would exceed daily limit on ${formatDay(v.day)} (${v.total_hours}h > ${v.limit}h)`;
      case "cohort_daily_hours":
        return `${getCohortName(v.cohort_id)} would exceed daily limit on ${formatDay(v.day)} (${v.total_hours}h > ${v.limit}h)`;
      case "lecturer_lunch_break":
        return `${getLecturerName(v.lecturer_id)} would have no lunch break on ${formatDay(v.day)}`;
      default:
        return v.type;
    }
  }

  const [constraintDefinitions, setConstraintDefinitions] = useState<ConstraintDefinition[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ConstraintDefinition[]>("/constraints/")
      .then((defs) => {
        if (!cancelled) setConstraintDefinitions(defs);
      })
      .catch(() => {
        if (!cancelled) setConstraintDefinitions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [relatedConstraints, setRelatedConstraints] = useState<
    RelatedConstraintRow[]
  >([]);
  const [relatedConstraintsLoading, setRelatedConstraintsLoading] =
    useState(false);

  useEffect(() => {
    if (!selectedEvent || constraintDefinitions.length === 0) {
      setRelatedConstraints([]);
      return;
    }

    let cancelled = false;
    setRelatedConstraintsLoading(true);

    async function loadRelatedConstraints() {
      const rows: RelatedConstraintRow[] = [];

      // session-level (equipment, capacity)
      const sessionInstances = await api.get<
        { id: string; constraint_id: string; is_activated: boolean }[]
      >(`/sessions/${selectedEvent.session.id}/constraints`);
      for (const instance of sessionInstances) {
        if (!instance.is_activated) continue;
        const definition = constraintDefinitions.find(
          (c) => c.id === instance.constraint_id,
        );
        if (!definition) continue;
        rows.push({
          key: instance.id,
          group: "Rooms / class",
          entityLabel: `${selectedModule?.code ?? "This class"}`,
          constraintId: definition.id,
          constraintName: definition.name,
          relaxable: definition.type === "relaxable",
          isActivated: true,
          relaxation: await fetchRelaxation("session", instance.id),
        });
      }

      // lecturer-level
      if (selectedEvent.lecturer) {
        const lecturerInstances = await api.get<
          { id: string; constraint_id: string; is_activated: boolean }[]
        >(`/lecturers/${selectedEvent.lecturer.id}/constraints`);
        for (const instance of lecturerInstances) {
          if (!instance.is_activated) continue;
          const definition = constraintDefinitions.find(
            (c) => c.id === instance.constraint_id,
          );
          if (!definition) continue;
          rows.push({
            key: instance.id,
            group: "Lecturer",
            entityLabel: selectedEvent.lecturer!.name,
            constraintId: definition.id,
            constraintName: definition.name,
            relaxable: definition.type === "relaxable",
            isActivated: true,
            relaxation: await fetchRelaxation("lecturer", instance.id),
          });
        }
      }

      // cohort-level
      for (const cohort of selectedEvent.cohorts) {
        const cohortInstances = await api.get<
          { id: string; constraint_id: string; is_activated: boolean }[]
        >(`/cohorts/${cohort.id}/constraints`);
        for (const instance of cohortInstances) {
          if (!instance.is_activated) continue;
          const definition = constraintDefinitions.find(
            (c) => c.id === instance.constraint_id,
          );
          if (!definition) continue;
          rows.push({
            key: instance.id,
            group: "Cohorts",
            entityLabel: cohort.name,
            constraintId: definition.id,
            constraintName: definition.name,
            relaxable: definition.type === "relaxable",
            isActivated: true,
            relaxation: await fetchRelaxation("cohort", instance.id),
          });
        }
      }

      if (!cancelled) {
        setRelatedConstraints(rows);
        setRelatedConstraintsLoading(false);
      }
    }

    loadRelatedConstraints().catch(() => {
      if (!cancelled) setRelatedConstraintsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedEvent, selectedModule, constraintDefinitions]);

  // ---------------------------------------------------------------------------
  // Step 2: complete READ-ONLY overview of every active constraint instance.
  // This intentionally has no modal, no edit action, and no relaxation controls.
  // Rendered by <ConstraintsOverviewPanel />.
  // ---------------------------------------------------------------------------
  const [overviewEntitiesByConstraint, setOverviewEntitiesByConstraint] = useState<
    Record<string, OverviewEntityGroup[]>
  >({});
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [openOverviewStakeholders, setOpenOverviewStakeholders] = useState<Set<string>>(
    new Set(["Lecturer", "Cohort", "Session", "Room"]),
  );
  const [openOverviewConstraints, setOpenOverviewConstraints] = useState<Set<string>>(
    new Set(),
  );
  const [openOverviewEntities, setOpenOverviewEntities] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (!data || constraintDefinitions.length === 0) {
      setOverviewEntitiesByConstraint({});
      return;
    }

    let cancelled = false;
    setOverviewLoading(true);

    async function loadOverview() {
      const next: Record<string, OverviewEntityGroup[]> = {};

      for (const constraint of constraintDefinitions) {
        const groups: OverviewEntityGroup[] = [];

        if (constraint.stakeholder === "Lecturer") {
          const lecturers = await api.get<{ id: string; name: string }[]>("/lecturers/");

          for (const lecturer of lecturers) {
            const instances = await api.get<
              { id: string; constraint_id: string; day: string | null; is_activated: boolean }[]
            >(`/lecturers/${lecturer.id}/constraints`);

            const matches = instances.filter(
              (instance) =>
                instance.constraint_id === constraint.id && instance.is_activated,
            );
            if (matches.length === 0) continue;

            const isDayScoped = matches.some((instance) => instance.day !== null);
            const leaves = await Promise.all(
              matches.map(async (instance) => ({
                key: instance.id,
                label: isDayScoped
                  ? DAY_LABELS[instance.day ?? ""] ?? instance.day ?? "Day"
                  : lecturer.name,
                infoText: "",
                instanceType: "lecturer" as const,
                instanceId: instance.id,
                relaxation: await fetchRelaxation("lecturer", instance.id),
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
          const cohorts = await api.get<{ id: string; name: string }[]>("/cohorts/");

          for (const cohort of cohorts) {
            const instances = await api.get<
              { id: string; constraint_id: string; day: string | null; is_activated: boolean }[]
            >(`/cohorts/${cohort.id}/constraints`);

            const matches = instances.filter(
              (instance) =>
                instance.constraint_id === constraint.id && instance.is_activated,
            );
            if (matches.length === 0) continue;

            const isDayScoped = matches.some((instance) => instance.day !== null);
            const leaves = await Promise.all(
              matches.map(async (instance) => ({
                key: instance.id,
                label: isDayScoped
                  ? DAY_LABELS[instance.day ?? ""] ?? instance.day ?? "Day"
                  : cohort.name,
                infoText: "",
                instanceType: "cohort" as const,
                instanceId: instance.id,
                relaxation: await fetchRelaxation("cohort", instance.id),
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

        if (constraint.stakeholder === "Session") {
          const sessions = await api.get<{ id: string; module_id: string }[]>("/sessions/");

          for (const session of sessions) {
            const instances = await api.get<
              { id: string; constraint_id: string; is_activated: boolean }[]
            >(`/sessions/${session.id}/constraints`);

            const instance = instances.find(
              (item) => item.constraint_id === constraint.id && item.is_activated,
            );
            if (!instance) continue;

            const module = data.modules.find((item) => item.id === session.module_id);
            const moduleLabel = module
              ? `${module.code} · ${module.title}`
              : session.module_id;

            const infoText =
              constraint.id === "class-equipment"
                ? `Needs: ${(module?.requiredEquipment ?? []).join(", ") || "None"}`
                : constraint.id === "class-capacity"
                  ? `Requires at least ${module?.requiredCapacity ?? "?"} seats`
                  : "";

            groups.push({
              key: session.id,
              label: moduleLabel,
              isDayScoped: false,
              leaves: [
                {
                  key: instance.id,
                  label: moduleLabel,
                  infoText,
                  instanceType: "session",
                  instanceId: instance.id,
                  relaxation: await fetchRelaxation("session", instance.id),
                },
              ],
            });
          }
        }

        if (constraint.stakeholder === "Room") {
          const rooms = await api.get<{ id: string; name: string }[]>("/rooms/");

          for (const room of rooms) {
            const instances = await api.get<
              { id: string; constraint_id: string; is_activated: boolean }[]
            >(`/rooms/${room.id}/constraints`);

            const instance = instances.find(
              (item) => item.constraint_id === constraint.id && item.is_activated,
            );
            if (!instance) continue;

            groups.push({
              key: room.id,
              label: room.name,
              isDayScoped: false,
              leaves: [
                {
                  key: instance.id,
                  label: room.name,
                  infoText: "",
                  instanceType: "room",
                  instanceId: instance.id,
                  relaxation: await fetchRelaxation("room", instance.id),
                },
              ],
            });
          }
        }

        if (groups.length > 0) next[constraint.id] = groups;
      }

      if (!cancelled) {
        setOverviewEntitiesByConstraint(next);
        setOverviewLoading(false);
      }
    }

    loadOverview().catch(() => {
      if (!cancelled) {
        setOverviewEntitiesByConstraint({});
        setOverviewLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [data, constraintDefinitions]);

  function toggleOverviewStakeholder(stakeholder: string) {
    setOpenOverviewStakeholders((current) => {
      const next = new Set(current);
      next.has(stakeholder) ? next.delete(stakeholder) : next.add(stakeholder);
      return next;
    });
  }

  function toggleOverviewConstraint(constraintId: string) {
    setOpenOverviewConstraints((current) => {
      const next = new Set(current);
      next.has(constraintId) ? next.delete(constraintId) : next.add(constraintId);
      return next;
    });
  }

  function toggleOverviewEntity(constraintId: string, entityKey: string) {
    const key = `${constraintId}:${entityKey}`;
    setOpenOverviewEntities((current) => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const selectedEventDayTime = useMemo(() => {
    if (!selectedEvent) return null;

    const start = new Date(selectedEvent!.session.start);
    const end = new Date(selectedEvent!.session.end);

    const day = start.toLocaleDateString("en-US", { weekday: "long" });
    const startTime = start.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const endTime = end.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    return `${day} ${startTime}–${endTime}`;
  }, [selectedEvent]);

  const requestedSlotIds = useMemo(() => {
    if (selectedDay && selectedTime) {
      const dayCode = selectedDay.slice(0, 3).toLowerCase();
      const hour = parseInt(selectedTime.split(":")[0], 10);
      const start = new Date(selectedEvent.session.start);
      const end = new Date(selectedEvent.session.end);
      const duration =
  (end.getTime() - start.getTime()) / (1000 * 60 * 60);

      return Array.from(
        { length: duration },
        (_, i) => `${dayCode}-${String(hour + i).padStart(2, "0")}`,
      );
    }
    return [];
  }, [selectedDay, selectedTime]);


  const currentSlotIds = useMemo(() => {
    if (!selectedEvent) return [];
    return sessionToSlotIds(selectedEvent.session);
  }, [selectedEvent]);

  const repairSessions = useMemo(() => {
  if (!selectedEvent) {
    return data?.sessions ?? [];
  }

  // We need a concrete requested day/time.
  if (!selectedDay || !selectedTime) {
    return data?.sessions ?? [];
  }

  const originalSession = selectedEvent.session;

  const originalStart = new Date(originalSession.start);
  const originalEnd = new Date(originalSession.end);

  const durationMs =
    originalEnd.getTime() - originalStart.getTime();

  const dayIndex: Record<string, number> = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
  };

  const targetDayIndex = dayIndex[selectedDay];

  if (targetDayIndex == null) {
    return data?.sessions ?? [];
  }

  /*
   * Find Monday of the same week as the
   * original session.
   */
  const targetStart = new Date(originalStart);

  const currentDay = originalStart.getDay();

  targetStart.setDate(
    originalStart.getDate() +
      (targetDayIndex - currentDay),
  );

  const [hours, minutes] = selectedTime
    .split(":")
    .map(Number);

  targetStart.setHours(
    hours,
    minutes,
    0,
    0,
  );

  const targetEnd = new Date(
    targetStart.getTime() + durationMs,
  );

  return (data?.sessions ?? []).map((session) => {
    if (session.id !== originalSession.id) {
      return session;
    }

    return {
      ...session,

      start: formatTimetableDateTime(targetStart),
      end: formatTimetableDateTime(targetEnd),

      // For now we're keeping the existing room.
      // Later this can use the requested room.
      room: selectedRoom
        ? getRoomName(selectedRoom)
        : session.room,
    };
  });
}, [
  data?.sessions,
  selectedEvent,
  selectedDay,
  selectedTime,
  selectedRoom,
  getRoomName,
]);

  // The slot every violation in Step 4's diagnostics is checked against.
  // Case A: the concrete request's target time (falls back to the session's
  // current time when only room/lecturer are changing).
  const caseAProposedSlots = useMemo(
    () => (requestedSlotIds.length ? requestedSlotIds : currentSlotIds),
    [requestedSlotIds, currentSlotIds],
  );

  // Case B: whatever day/time the user is currently testing in the
  // interactive "find" diagnosis dropdowns, falling back to Case A's slot
  // until both day and time have been picked.
  const caseBProposedSlots = useMemo(() => {
    if (diagDay && diagTime) {
      const dayCode = diagDay.slice(0, 3).toLowerCase();
      const hour = parseInt(diagTime.split(":")[0], 10);
      const duration = 2;
      return Array.from(
        { length: duration },
        (_, i) => `${dayCode}-${String(hour + i).padStart(2, "0")}`,
      );
    }
    return caseAProposedSlots;
  }, [diagDay, diagTime, caseAProposedSlots]);

  function handleWeightChange(id: string, weight: number) {
    setObjectives((items) =>
      items.map((item) => (item.id === id ? { ...item, weight } : item)),
    );
  }

  function handleObjectiveToggle(id: string) {
    setObjectives((items) =>
      items.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item,
      ),
    );
  }

  const schedulePreviewItems = useMemo(() => {
    if (!selectedEvent) return [];
    const { session, programs, cohorts } = selectedEvent;

    // resolve requested lecturer vs current lecturer, same fallback rule as step 2
    const lecturer = selectedLecturer
      ? data!.lecturers.find((l) => l.id === selectedLecturer)
      : selectedEvent.lecturer;

    const items = [];

    if (lecturer) {
      items.push({
        id: `lecturer-${lecturer.id}`,
        type: "lecturer" as const,
        label: `Lecturer: ${lecturer.name}`,
        sessions: getBusySlots(
          data!.sessions,
          (s) => s.lecturerId === lecturer.id,
          session.id,
        ),
        unavailableSlots: getLecturerUnavailableSlots(lecturer.id),
        fullTimetableLink: `/timetable-preview?lecturer=${lecturer.id}`,
      });
    }

    cohorts.forEach((cohort) => {
      items.push({
        id: `cohort-${cohort.id}`,
        type: "cohort" as const,
        label: `Cohort: ${cohort.name}`,
        sessions: getBusySlots(
          data!.sessions,
          (s) => s.cohortIds.includes(cohort.id),
          session.id,
        ),
        unavailableSlots: [],
        fullTimetableLink: `/timetable-preview?cohort=${cohort.id}`,
      });
    });

    programs.forEach((program) => {
      items.push({
        id: `program-${program.id}`,
        type: "program" as const,
        label: `Program: ${program.name}`,
        sessions: getBusySlots(
          data!.sessions,
          (s) => s.programIds.includes(program.id),
          session.id,
        ),
        unavailableSlots: [],
        fullTimetableLink: `/timetable-preview?program=${program.id}`,
      });
    });

    // resolve requested room vs current room, same idea
    const room = selectedRoom ?? session.room;

    if (room) {
      items.push({
        id: `room-${room}`,
        type: "room" as const,
        label: `Room: ${room}`,
        sessions: getBusySlots(
          data!.sessions,
          (s) => s.room === room,
          session.id,
        ),
        unavailableSlots: [],
        fullTimetableLink: `/timetable-preview?room=${encodeURIComponent(room)}`,
      });
    }

    return items;
  }, [
    selectedEvent,
    selectedLecturer,
    selectedRoom,
    lecturerUnavailableSlotMap,
  ]);

  // ---- Interactive diagnosis helpers (must stay above any early return) ----
  const needsInteractiveDiagnosis =
    solverResult?.status === "infeasible" &&
    originalModes !== null &&
    (originalModes.time === "find" ||
      originalModes.room === "find" ||
      originalModes.lecturer === "find");

  async function runInteractiveDiagnosis() {
    if (!selectedEvent || !originalModes) return;

    const lecturerId =
      originalModes.lecturer === "find"
        ? diagLecturer
        : selectedLecturer ?? selectedEvent.lecturer?.id ?? null;

    let roomId: string | null = null;
    if (originalModes.room === "find") {
      roomId = diagRoom;
    } else if (selectedRoom) {
      roomId = data?.rooms.find((r) => r.name === selectedRoom)?.id ?? null;
    } else {
      roomId =
        data?.rooms.find((r) => r.name === selectedEvent.session.room)?.id ?? null;
    }

    const day =
      originalModes.time === "find"
        ? diagDay
        : selectedDay ??
          new Date(selectedEvent.session.start).toLocaleDateString("en-US", {
            weekday: "long",
          });

    const time =
      originalModes.time === "find"
        ? diagTime
        : selectedTime ??
          new Date(selectedEvent.session.start).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });

    if (!lecturerId || !roomId || !day || !time) return;

    setDiagLoading(true);
    setDiagError(null);
    setDiagResult(null);

    try {
      const requestedStart = buildTimetableLocalStart(
        selectedEvent.session.start,
        day,
        time,
      );

      if (!requestedStart) {
        setDiagError("Could not build a valid start time");
        return;
      }

      const request = {
        session_id: selectedEvent.session.id,
        time_mode: "specific" as const,
        requested_start: requestedStart,
        room_mode: "specific" as const,
        requested_room_id: roomId,
        lecturer_mode: "specific" as const,
        requested_lecturer_id: lecturerId,
      };

      const result = await api.post<{ diagnostics: Diagnostics }>(
        "/solver/diagnose",
        request,
      );
      setDiagResult(result.diagnostics);
    } catch (err) {
      setDiagError(err instanceof Error ? err.message : "Diagnosis failed");
    } finally {
      setDiagLoading(false);
    }
  }

  useEffect(() => {
    if (!needsInteractiveDiagnosis || !originalModes) return;

    const lecturerReady =
      originalModes.lecturer !== "find" || diagLecturer !== null;
    const timeReady =
      originalModes.time !== "find" || (diagDay !== null && diagTime !== null);
    const roomReady = originalModes.room !== "find" || diagRoom !== null;

    if (lecturerReady && timeReady && roomReady) {
      runInteractiveDiagnosis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagLecturer, diagDay, diagTime, diagRoom, needsInteractiveDiagnosis]);
  // ---- end interactive diagnosis helpers ----

  if (!selectedEvent) {
    return (
      <section className="reschedule-page">
        <div className="reschedule-card">
          <h1>Session not found</h1>
          <p>We could not find the class you want to reschedule.</p>
        </div>
      </section>
    );
  }

  function buildRequestedStart(): string | null {
    if (!selectedDay || !selectedTime) return null;

    return buildTimetableLocalStart(
      selectedEvent!.session.start,
      selectedDay,
      selectedTime,
    );
  }

  function buildRescheduleRequest(): RescheduleRequest {
    const timeMode = currentModes.time;
    const roomMode = currentModes.room;
    const lecturerMode = currentModes.lecturer;

    const requestedStart = timeMode === "specific" ? buildRequestedStart() : null;

    let requestedRoomId: string | null = null;
    if (roomMode === "specific" && selectedRoom) {
      const room = data!.rooms.find((item) => item.name === selectedRoom);
      requestedRoomId = room?.id ?? null;
    }

    let requestedLecturerId: string | null = null;
    if (lecturerMode === "specific" && selectedLecturer) {
      requestedLecturerId = selectedLecturer;
    }

    return {
      session_id: selectedEvent!.session.id,
      time_mode: timeMode,
      requested_start: requestedStart,
      room_mode: roomMode,
      requested_room_id: requestedRoomId,
      lecturer_mode: lecturerMode,
      requested_lecturer_id: requestedLecturerId,
      max_additional_changes:
        rescheduleScope === "up-to-2"
          ? 2
          : rescheduleScope === "up-to-3"
            ? 3
            : null,
    };
  }

  async function runReschedule() {
    setSolverLoading(true);
    setSolverError(null);
    setAppliedTemporaryDeactivations([]);
    setSolverResult(null);
    setDiagResult(null);
    setDiagError(null);

    try {
      const request = buildRescheduleRequest();

      // Remember which modes were used so we know whether interactive diagnosis is needed
      setOriginalModes({
        time: request.time_mode,
        room: request.room_mode,
        lecturer: request.lecturer_mode,
      });

      const result = await api.post<RescheduleResponse>(
        "/solver/reschedule",
        request,
      );
      setSolverResult(result);
    } catch (error) {
      console.error("Failed to reschedule session:", error);
      setSolverError(
        error instanceof Error ? error.message : "Failed to run the solver",
      );
    } finally {
      setSolverLoading(false);
    }
  }

  async function runRescheduleWithRelaxations(temporarilyDeactivatedConstraints: TemporaryConstraintDeactivation[],) {
    if (!selectedEvent) return;

    setSolverLoading(true);
    setSolverError(null);

    try {
      let request: RescheduleRequest;

      if (needsInteractiveDiagnosis && originalModes) {
        const lecturerId =
          originalModes.lecturer === "find"
            ? diagLecturer
            : selectedLecturer ?? selectedEvent.lecturer?.id ?? null;

        let roomId: string | null = null;

        if (originalModes.room === "find") {
          roomId = diagRoom;
        } else if (selectedRoom) {
          roomId =
            data?.rooms.find((room) => room.name === selectedRoom)?.id ?? null;
        } else {
          roomId =
            data?.rooms.find(
              (room) => room.name === selectedEvent.session.room,
            )?.id ?? null;
        }

        const day =
          originalModes.time === "find"
            ? diagDay
            : selectedDay ??
              new Date(selectedEvent.session.start).toLocaleDateString("en-US", {
                weekday: "long",
              });

        const time =
          originalModes.time === "find"
            ? diagTime
            : selectedTime ??
              new Date(selectedEvent.session.start).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              });

        if (!lecturerId || !roomId || !day || !time) {
          setSolverError("Could not build the concrete retry request.");
          return;
        }

        const requestedStart = buildTimetableLocalStart(
          selectedEvent.session.start,
          day,
          time,
        );

        if (!requestedStart) {
          setSolverError("Could not build the retry date.");
          return;
        }

        request = {
          session_id: selectedEvent.session.id,
          time_mode: "specific",
          requested_start: requestedStart,
          room_mode: "specific",
          requested_room_id: roomId,
          lecturer_mode: "specific",
          requested_lecturer_id: lecturerId,
          temporarily_deactivated_constraints:
            temporarilyDeactivatedConstraints,
        };
      } else {
        request = {
          ...buildRescheduleRequest(),
          temporarily_deactivated_constraints:
            temporarilyDeactivatedConstraints,
        };
      }

      console.log(
        "Retrying with temporary constraint deactivations:",
        request,
      );

      setOriginalModes({
        time: request.time_mode,
        room: request.room_mode,
        lecturer: request.lecturer_mode,
      });

      const result = await api.post<RescheduleResponse>(
        "/solver/reschedule",
        request,
      );

      setSolverResult(result);

      if (result.status === "feasible") {
        setAppliedTemporaryDeactivations(
          temporarilyDeactivatedConstraints,
        );
      }

      setDiagResult(null);
      setDiagError(null);
    } catch (error) {
      console.error(
        "Failed to retry with relaxed constraints:",
        error,
      );

      setSolverError(
        error instanceof Error
          ? error.message
          : "Failed to retry the solver",
      );
    } finally {
      setSolverLoading(false);
    }
  }

async function runRescheduleWithAdditionalChanges() {
  if (!selectedEvent) return;

  setSolverLoading(true);
  setSolverError(null);
  setAppliedTemporaryDeactivations([]);

  try {
    let request: RescheduleRequest;

    /*
     * If the original request used FIND, use the concrete
     * combination currently selected in Step 4.
     */
    if (needsInteractiveDiagnosis && originalModes) {
      const lecturerId =
        originalModes.lecturer === "find"
          ? diagLecturer
          : selectedLecturer ?? selectedEvent.lecturer?.id ?? null;

      let roomId: string | null = null;

      if (originalModes.room === "find") {
        roomId = diagRoom;
      } else if (selectedRoom) {
        roomId =
          data?.rooms.find(
            (room) => room.name === selectedRoom,
          )?.id ?? null;
      } else {
        roomId =
          data?.rooms.find(
            (room) =>
              room.name === selectedEvent.session.room,
          )?.id ?? null;
      }

      const day =
        originalModes.time === "find"
          ? diagDay
          : selectedDay ??
            new Date(
              selectedEvent.session.start,
            ).toLocaleDateString("en-US", {
              weekday: "long",
            });

      const time =
        originalModes.time === "find"
          ? diagTime
          : selectedTime ??
            new Date(
              selectedEvent.session.start,
            ).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });

      if (!lecturerId || !roomId || !day || !time) {
        setSolverError(
          "Could not build the concrete perturbation request.",
        );
        return;
      }

      const requestedStart = buildTimetableLocalStart(
        selectedEvent.session.start,
        day,
        time,
      );

      if (!requestedStart) {
        setSolverError(
          "Could not build the perturbation date.",
        );
        return;
      }

      request = {
        session_id: selectedEvent.session.id,
        time_mode: "specific",
        requested_start: requestedStart,
        room_mode: "specific",
        requested_room_id: roomId,
        lecturer_mode: "specific",
        requested_lecturer_id: lecturerId,
        max_additional_changes: null,
      };
    } else {
      request = {
        ...buildRescheduleRequest(),

        // The minimum-perturbation solver decides the
        // minimum number itself. There is no user-supplied N.
        max_additional_changes: null,
      };
    }

    console.log(
      "Running minimum-perturbation recovery:",
      request,
    );

    const result = await api.post<RescheduleResponse>(
      "/solver/reschedule/min-perturbation",
      request,
    );

    console.log(
      "Minimum-perturbation result:",
      result,
    );

    if (result.status === "feasible") {
      setPerturbationPreview(result);
    } else {
      setSolverResult(result);
    }
    setDiagResult(null);
    setDiagError(null);
  } catch (error) {
    console.error(
      "Failed to run minimum-perturbation recovery:",
      error,
    );

    setSolverError(
      error instanceof Error
        ? error.message
        : "Failed to find a minimum-perturbation recovery",
    );
  } finally {
    setSolverLoading(false);
  }
}

  async function handleContinue() {
    if (step === 1 && stepOneInvalid) {
      return;
    }

    // Nothing free to optimise over — skip straight past the Priorities
    // step, there's only one possible outcome for the solver to find.
    if (step === 2 && !objectivesApplicable) {
      await runReschedule();
      goToStep(4);
      return;
    }

    if (step === 3) {
      await runReschedule();
      goToStep(4);
      return;
    }

    goToStep((step + 1) as WizardStep);
  }

  function buildConstraintSnapshot() {
    const normalizeDay = (value: string | null | undefined) =>
      value?.trim().slice(0, 3).toLowerCase() ?? null;

    return constraintDefinitions.flatMap((definition) => {
      const groups =
        overviewEntitiesByConstraint[definition.id] ?? [];

      return groups.flatMap((group) =>
        group.leaves.map((leaf) => {
          const temporarilyDeactivated =
            appliedTemporaryDeactivations.some(
              (item) =>
                item.constraint_id === definition.id &&
                item.instance_type === leaf.instanceType &&
                (
                  item.instance_id === group.key ||
                  item.instance_id === leaf.instanceId
                ) &&
                (
                  !item.day ||
                  normalizeDay(item.day) ===
                    normalizeDay(
                      group.isDayScoped ? leaf.label : null,
                    )
                ),
            );

          return {
            // Keep the old fields so existing backend/detail code remains compatible.
            group:
              definition.stakeholder === "Cohort"
                ? "Cohorts"
                : definition.stakeholder === "Session" ||
                    definition.stakeholder === "Room"
                  ? "Rooms / class"
                  : definition.stakeholder,
            rule: definition.name,
            state: temporarilyDeactivated
              ? "Temporarily deactivated"
              : leaf.relaxation
                ? describeRelaxation(leaf.relaxation)
                : "Active",
            relaxable:
              definition.type === "relaxable",

            // Rich snapshot fields used by the reusable hierarchy on the
            // saved-solution page.
            constraint_id: definition.id,
            constraint_name: definition.name,
            constraint_description: definition.description,
            stakeholder: definition.stakeholder,
            constraint_type: definition.type,

            entity_id: group.key,
            entity_label: group.label,

            instance_id: leaf.instanceId,
            instance_type: leaf.instanceType,

            day: group.isDayScoped ? leaf.label : null,
            info_text: leaf.infoText,
            is_activated: !temporarilyDeactivated,
          };
        }),
      );
    });
  }

  async function handleSaveSolution() {
    if (solverResult?.status !== "feasible") return;
    if (!data || !selectedEvent) return;

    setSolverError(null);

    try {
      const now = new Date();
      const timestamp = now.getTime();

      const solutionId = `solution-${timestamp}`;
      const requestId = `reschedule-${selectedEvent.session.id}-${timestamp}`;
      const solved = solverResult;

      const dayIndex: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };

      function buildSolvedDates(
        session: Session,
        day: string,
        time: string,
      ) {
        const currentStart = new Date(session.start);
        const currentEnd = new Date(session.end);
        const durationMs = currentEnd.getTime() - currentStart.getTime();

        const nextStart = new Date(currentStart);
        const targetDayIndex = dayIndex[day.toLowerCase()];

        if (targetDayIndex !== undefined) {
          nextStart.setDate(
            currentStart.getDate() +
              (targetDayIndex - currentStart.getDay()),
          );
        }

        const [hours, minutes] = time.split(":").map(Number);
        nextStart.setHours(hours, minutes ?? 0, 0, 0);

        return {
          start: nextStart,
          end: new Date(nextStart.getTime() + durationMs),
        };
      }

      function roomIdForSession(session: Session): string | null {
        if (!session.room) return null;

        return (
          data.rooms.find((room) => room.name === session.room)?.id ??
          session.room
        );
      }

      function dayAndTimeForSession(session: Session) {
        const start = new Date(session.start);

        return {
          day: start
            .toLocaleDateString("en-US", { weekday: "long" })
            .toLowerCase(),
          time: start.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
        };
      }

      // Convert the solver's current flat additional-change output to the
      // canonical format stored in candidate_solutions.
      const additionalChanges = (solved.additional_changes ?? []).map(
        (change) => {
          const changedSession = data.sessions.find(
            (session) => session.id === change.session_id,
          );

          const lecturerId =
            changedSession?.lecturerId ?? null;

          return {
            session_id: change.session_id,
            module_id: changedSession?.moduleId ?? null,

            time_changed: change.time_changed,
            room_changed: change.room_changed,
            lecturer_changed: false,

            before: {
              day: change.old_day,
              time: change.old_time,
              room_id: change.old_room_id,
              lecturer_id: lecturerId,
            },

            after: {
              day: change.new_day,
              time: change.new_time,
              room_id: change.new_room_id,
              lecturer_id: lecturerId,
            },
          };
        },
      );

      // Build a full snapshot of the timetable after the requested move and
      // every cascading change.
      const resultingTimetable = data.sessions.map((session) => ({
        ...session,
      }));

      const mainSolvedDates = buildSolvedDates(
        selectedEvent.session,
        solved.day,
        solved.time,
      );

      const solvedRoom = data.rooms.find(
        (room) => room.id === solved.room_id,
      );

      const mainSessionIndex = resultingTimetable.findIndex(
        (session) => session.id === selectedEvent.session.id,
      );

      if (mainSessionIndex !== -1) {
        resultingTimetable[mainSessionIndex] = {
          ...resultingTimetable[mainSessionIndex],
          start: mainSolvedDates.start.toISOString(),
          end: mainSolvedDates.end.toISOString(),
          room: solvedRoom?.name ?? solved.room_id,
          lecturerId: solved.lecturer_id,
        };
      }

      for (const change of additionalChanges) {
        const originalSession = data.sessions.find(
          (session) => session.id === change.session_id,
        );

        if (!originalSession) continue;

        const sessionIndex = resultingTimetable.findIndex(
          (session) => session.id === change.session_id,
        );

        if (sessionIndex === -1) continue;

        const changedDates = buildSolvedDates(
          originalSession,
          change.after.day,
          change.after.time,
        );

        const changedRoom = data.rooms.find(
          (room) => room.id === change.after.room_id,
        );

        resultingTimetable[sessionIndex] = {
          ...resultingTimetable[sessionIndex],
          start: changedDates.start.toISOString(),
          end: changedDates.end.toISOString(),
          room: changedRoom?.name ?? change.after.room_id,
          lecturerId:
            change.after.lecturer_id ??
            originalSession.lecturerId,
        };
      }

      const originalPlacement = dayAndTimeForSession(
        selectedEvent.session,
      );

      const request = {
        before: {
          day: originalPlacement.day,
          time: originalPlacement.time,
          room_id: roomIdForSession(selectedEvent.session),
          lecturer_id: selectedEvent.session.lecturerId ?? null,
        },

        after: {
          day: solved.day,
          time: solved.time,
          room_id: solved.room_id,
          lecturer_id: solved.lecturer_id,
        },
      };

      const requestType =
        changeType === "room"
          ? "change-room"
          : changeType === "lecturer"
            ? "change-lecturer"
            : "reschedule-class";

      // ---------------------------------------------------------------------
      // Affected stakeholders
      //
      // Include:
      // - lecturers, cohorts and rooms for every moved class
      // - both old and new lecturer/room when either changes
      // - lecturers, cohorts and rooms involved in relaxed constraints
      //
      // The Map deduplicates stakeholders by type + id.
      // ---------------------------------------------------------------------

      type AffectedStakeholder = {
        type: "lecturer" | "cohort" | "room";
        id: string;
        label: string;
      };

      const affectedStakeholders = new Map<
        string,
        AffectedStakeholder
      >();

      function addAffectedStakeholder(
        type: AffectedStakeholder["type"],
        id: string | null | undefined,
        label: string | null | undefined,
      ) {
        if (!id) return;

        affectedStakeholders.set(
          `${type}:${id}`,
          {
            type,
            id,
            label: label ?? id,
          },
        );
      }

      function addLecturerById(
        lecturerId: string | null | undefined,
      ) {
        if (!lecturerId) return;

        const lecturer = data.lecturers.find(
          (item) => item.id === lecturerId,
        );

        addAffectedStakeholder(
          "lecturer",
          lecturerId,
          lecturer?.name ?? lecturerId,
        );
      }

      function addCohortById(
        cohortId: string | null | undefined,
      ) {
        if (!cohortId) return;

        const cohort = data.cohorts.find(
          (item) => item.id === cohortId,
        );

        addAffectedStakeholder(
          "cohort",
          cohortId,
          cohort?.name ?? cohortId,
        );
      }

      function addRoomById(
        roomId: string | null | undefined,
      ) {
        if (!roomId) return;

        const room = data.rooms.find(
          (item) => item.id === roomId,
        );

        addAffectedStakeholder(
          "room",
          roomId,
          room?.name ?? roomId,
        );
      }

      function addSessionStakeholders(
        session: Session,
      ) {
        addLecturerById(session.lecturerId);

        for (const cohortId of session.cohortIds) {
          addCohortById(cohortId);
        }

        addRoomById(
          roomIdForSession(session),
        );
      }

      // Requested class: original stakeholders.
      addSessionStakeholders(
        selectedEvent.session,
      );

      // Requested class: solved lecturer and room may be different.
      addLecturerById(
        solved.lecturer_id,
      );
      addRoomById(
        solved.room_id,
      );

      // Every additional moved class.
      for (const change of additionalChanges) {
        const movedSession = data.sessions.find(
          (session) => session.id === change.session_id,
        );

        if (movedSession) {
          // Cohorts and the original lecturer/room.
          addSessionStakeholders(movedSession);
        }

        // Also capture new lecturer/room if those values changed.
        addLecturerById(
          change.before.lecturer_id,
        );
        addLecturerById(
          change.after.lecturer_id,
        );

        addRoomById(
          change.before.room_id,
        );
        addRoomById(
          change.after.room_id,
        );
      }

      // Stakeholders involved in temporarily relaxed constraints.
      for (const relaxed of appliedTemporaryDeactivations) {
        if (relaxed.instance_type === "lecturer") {
          addLecturerById(relaxed.instance_id);
          continue;
        }

        if (relaxed.instance_type === "cohort") {
          addCohortById(relaxed.instance_id);
          continue;
        }

        if (relaxed.instance_type === "room") {
          addRoomById(relaxed.instance_id);
          continue;
        }

        // Session-level constraints such as class capacity/equipment:
        // include the lecturer, cohorts and room of that class.
        if (relaxed.instance_type === "session") {
          const relaxedSession = data.sessions.find(
            (session) => session.id === relaxed.instance_id,
          );

          if (relaxedSession) {
            addSessionStakeholders(relaxedSession);

            // If this is the requested class, include its solved room/lecturer too.
            if (
              relaxedSession.id === selectedEvent.session.id
            ) {
              addLecturerById(solved.lecturer_id);
              addRoomById(solved.room_id);
            }

            const additionalChange = additionalChanges.find(
              (change) =>
                change.session_id === relaxedSession.id,
            );

            if (additionalChange) {
              addLecturerById(
                additionalChange.after.lecturer_id,
              );
              addRoomById(
                additionalChange.after.room_id,
              );
            }
          }
        }
      }

      const affectedStakeholderList =
        Array.from(affectedStakeholders.values());

      const payload = {
        id: solutionId,
        name: null,
        status: "saved",

        request_id: requestId,
        request_created_at: now.toISOString(),

        requested_session_id: selectedEvent.session.id,
        requested_module_id: selectedEvent.session.moduleId,
        request_type: requestType,

        request,

        additional_changes: additionalChanges,
        resulting_timetable: resultingTimetable,

        affected_stakeholders: affectedStakeholderList,
        stakeholder_impacts: [],

        objectives: objectivesApplicable
          ? objectives.map((objective) => ({
              ...objective,
            }))
          : [],

        constraints: buildConstraintSnapshot(),

        solve_settings: {
          time_mode: originalModes?.time ?? null,
          room_mode: originalModes?.room ?? null,
          lecturer_mode: originalModes?.lecturer ?? null,
          reschedule_scope: rescheduleScope,
          objectives_applicable: objectivesApplicable,
        },

        solver_metadata: {
          additional_change_count: additionalChanges.length,
        },
      };

      await api.post(
        "/candidate-solutions/",
        payload,
      );

      navigate(`/saved-solutions/${solutionId}`);
    } catch (error) {
      console.error(
        "Failed to save candidate solution:",
        error,
      );

      setSolverError(
        error instanceof Error
          ? error.message
          : "Failed to save solution",
      );
    }
  }

  return (
    <section className="reschedule-page">
      <div className="reschedule-shell">
        <aside className="reschedule-sidebar">
          <div className="reschedule-sidebar-context">
            <div className="reschedule-sidebar-eyebrow">Rescheduling</div>

            <div className="reschedule-sidebar-code">
              {selectedModule?.code ?? "Unknown module"}
            </div>

            <div className="reschedule-sidebar-title">
              {selectedModule?.title ?? "Untitled class"}
            </div>

            <div className="reschedule-sidebar-details">
              <div>
                <Clock size={14} />
                <span>{selectedEventDayTime ?? "Time TBC"}</span>
              </div>

              <div>
                <MapPin size={14} />
                <span>{selectedEvent!.session.room ?? "Room TBC"}</span>
              </div>

              <div>
                <User size={14} />
                <span>{selectedEvent!.lecturer?.name ?? "Unassigned"}</span>
              </div>
            </div>
          </div>

          <div className="reschedule-sidebar-divider" />

          {[1, 2, 3, 4].map((item) => {
            const isPrioritiesStep = item === 3;
            const notApplicable = isPrioritiesStep && !objectivesApplicable;
            const notYetReached = item > furthestStep;
            const disabled = notApplicable || notYetReached;

            return (
              <button
                key={item}
                className={
                  step === item
                    ? "wizard-step active"
                    : disabled
                      ? "wizard-step wizard-step-disabled"
                      : "wizard-step"
                }
                onClick={() => {
                  if (disabled) return;
                  setStep(item as WizardStep);
                }}
                disabled={disabled}
                title={
                  notApplicable
                    ? "Not applicable — nothing is free for this request to optimise over"
                    : notYetReached
                      ? "Complete the current step to unlock this one"
                      : undefined
                }
              >
                <span>{item}</span>
                {item === 1 && "Request"}
                {item === 2 && "Related constraints"}
                {item === 3 && "Priorities"}
                {item === 4 && "Solution"}
              </button>
            );
          })}
        </aside>

        <main className="reschedule-card">
          {step === 1 && (
            <>
              <h2>Request</h2>

              <div className="impact-section">
                <div className="impact-group change-section">
                  <div className="impact-label">
                    What do you want to change?
                  </div>

                  <div className="request-options">
                    <button
                      className={changeType === "time" ? "active" : ""}
                      onClick={() => setChangeType("time")}
                    >
                      Change time
                    </button>
                    <button
                      className={changeType === "room" ? "active" : ""}
                      onClick={() => setChangeType("room")}
                    >
                      Change room
                    </button>
                    <button
                      className={changeType === "both" ? "active" : ""}
                      onClick={() => setChangeType("both")}
                    >
                      Change time and room
                    </button>
                  </div>
                </div>

              {(changeType === "time" || changeType === "both") && (
                <div className="impact-group change-section">
                  <div className="impact-label">Do you know the new time?</div>

                  <div className="request-options">
                    <button
                      className={timeKnowledge === "known" ? "active" : ""}
                      onClick={() => setTimeKnowledge("known")}
                    >
                      I know the time
                    </button>
                    <button
                      className={timeKnowledge === "find" ? "active" : ""}
                      onClick={() => setTimeKnowledge("find")}
                    >
                      Find a new time
                    </button>
                  </div>

                  {timeKnowledge === "known" && (
                    <div className="datetime-picker">
                      <div className="impact-label">Day</div>
                      <div className="request-options">
                        {days.map((day) => (
                          <button
                            key={day}
                            className={selectedDay === day ? "active" : ""}
                            onClick={() => setSelectedDay(day)}
                          >
                            {day}
                          </button>
                        ))}
                      </div>

                      <div className="impact-label">Time</div>
                      <div className="request-options">
                        {timeSlots.map((time) => (
                          <button
                            key={time}
                            className={selectedTime === time ? "active" : ""}
                            onClick={() => setSelectedTime(time)}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {changeType === "lecturer" && (
                <div className="impact-group change-section">
                  <div className="impact-label">Do you know the lecturer?</div>

                  <div className="request-options">
                    <button
                      className={lecturerKnowledge === "known" ? "active" : ""}
                      onClick={() => setLecturerKnowledge("known")}
                    >
                      I know the lecturer
                    </button>
                    <button
                      className={lecturerKnowledge === "find" ? "active" : ""}
                      onClick={() => setLecturerKnowledge("find")}
                    >
                      Find a lecturer
                    </button>
                  </div>

                  {lecturerKnowledge === "known" && (
                    <div className="datetime-picker">
                      <div className="impact-label">Lecturer</div>

                      <select
                        className="lecturer-select"
                        value={selectedLecturer ?? ""}
                        onChange={(event) =>
                          setSelectedLecturer(event.target.value)
                        }
                      >
                        <option value="" disabled>
                          Select a lecturer
                        </option>
                        {data!.lecturers.map((lecturer) => (
                          <option key={lecturer.id} value={lecturer.id}>
                            {lecturer.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {(changeType === "room" || changeType === "both") && (
                <div className="impact-group change-section">
                  <div className="impact-label">Which room?</div>

                  <div className="request-options">
                    {availableRooms.map((room) => (
                      <button
                        key={room}
                        className={selectedRoom === room ? "active" : ""}
                        onClick={() => setSelectedRoom(room)}
                      >
                        {room}
                      </button>
                    ))}
                  </div>
                </div>
              )}


              </div>

              {!stepOneInvalid && (
                <>
                  <h2 className="impacted-stakeholders-heading">Impacted Stakeholders</h2>


                  <div className="impact-stakeholders">
                    <div className="impact-group">
                      <div className="impact-label">Lecturer</div>
                      <div className="impact-chips">
                        <span className="impact-chip">
                          {selectedLecturer
                            ? data!.lecturers.find(
                                (l) => l.id === selectedLecturer,
                              )?.name
                            : (selectedEvent!.lecturer?.name ?? "Unassigned")}
                        </span>
                      </div>
                    </div>

                    <div className="impact-group">
                      <div className="impact-label">Programs</div>
                      <div className="impact-chips">
                        {selectedEvent.programs.map((program) => (
                          <span key={program.id} className="impact-chip">
                            {program.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="impact-group">
                      <div className="impact-label">Cohorts</div>
                      <div className="impact-chips">
                        {selectedEvent.cohorts.map((cohort) => (
                          <span key={cohort.id} className="impact-chip">
                            {cohort.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="impact-group">
                          <div className="impact-label">Rooms</div>

                          <div className="impact-chips">
                            <span className="impact-chip">
                              {selectedRoom ??
                                selectedEvent!.session.room ??
                                "Room TBC"}
                            </span>
                          </div>
                        </div>

                    <div className="schedule-preview-block">
                      <button
                        type="button"
                        className="schedule-preview-toggle"
                        onClick={() => setShowSchedulePreview((value) => !value)}
                      >
                        {showSchedulePreview
                          ? "Hide schedule preview ↑"
                          : "Preview affected schedules ↓"}
                      </button>

                      {showSchedulePreview && (
                        <div className="schedule-preview-panel">
                          <div className="schedule-preview-controls">
                            <span className="impact-label">Showing</span>

                            <div className="impact-chips">
                              {schedulePreviewItems.map((item) => {
                                const isHidden = hiddenSchedules.includes(item.id);

                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    className={
                                      isHidden
                                        ? "preview-chip muted"
                                        : "preview-chip"
                                    }
                                    onClick={() =>
                                      setHiddenSchedules((current) =>
                                        current.includes(item.id)
                                          ? current.filter(
                                              (value) => value !== item.id,
                                            )
                                          : [...current, item.id],
                                      )
                                    }
                                  >
                                    {isHidden ? "○" : "✓"} {item.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="schedule-preview-strip">
                            {schedulePreviewItems
                              .filter((item) => !hiddenSchedules.includes(item.id))
                              .map((item) => {
                                const wasChanged =
                                  (item.type === "lecturer" &&
                                    !!selectedLecturer &&
                                    selectedLecturer !==
                                      selectedEvent.lecturer?.id) ||
                                  (item.type === "room" &&
                                    !!selectedRoom &&
                                    selectedRoom !== selectedEvent.session.room);

                                const slotsToShow = wasChanged
                                  ? requestedSlotIds
                                  : requestedSlotIds.length
                                    ? requestedSlotIds
                                    : currentSlotIds;

                                return (
                                  <div key={item.id} className="mini-schedule-card">
                                    <MiniTimetablePreview
                                      title={item.label}
                                      busySlots={item.sessions}
                                      selectedSlots={slotsToShow}
                                      unavailableSlots={item.unavailableSlots ?? []}
                                      fullTimetableLink={item.fullTimetableLink}
                                    />
                                  </div>
                                );
                              })}

                            {(changeType === "room" || changeType === "both") &&
                                    selectedRoomData &&
                                    selectedModule && (
                                      <div className="mini-schedule-card">
                                        <RoomSuitability
                                          roomName={selectedRoomData.name}
                                          roomCapacity={selectedRoomData.capacity}
                                          roomEquipment={selectedRoomData.equipment ?? []}
                                          studentCount={selectedModule.requiredCapacity}
                                          requiredEquipment={selectedModule.requiredEquipment ?? []}
                                        />
                                      </div>
                                    )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
                </>
          )}

          {step === 2 && (
            <ConstraintsOverviewPanel
              constraintDefinitions={constraintDefinitions}
              overviewEntitiesByConstraint={overviewEntitiesByConstraint}
              overviewLoading={overviewLoading}
              openStakeholders={openOverviewStakeholders}
              openConstraints={openOverviewConstraints}
              openEntities={openOverviewEntities}
              onToggleStakeholder={toggleOverviewStakeholder}
              onToggleConstraint={toggleOverviewConstraint}
              onToggleEntity={toggleOverviewEntity}
            />
          )}

          {step === 3 && objectivesApplicable && (
            <ObjectivesPanel
              objectives={objectives}
              onWeightChange={handleWeightChange}
              onToggle={handleObjectiveToggle}
            />
          )}

          {step === 3 && !objectivesApplicable && (
            <>
              <h2>Priorities</h2>
              <p className="step-description">
                This request fully specifies the permitted outcome and allows no
                additional timetable changes. The solver only needs to check whether
                that exact request is feasible, so optimization priorities do not apply.
              </p>
            </>
          )}

          {step === 4 && (
              <>
            <Step4Solution
              solverLoading={solverLoading}
              solverError={solverError}
              solverResult={solverResult}
              selectedModuleLabel={
                selectedModule ? `${selectedModule.code} · ${selectedModule.title}` : null
              }
              selectedEventFallbackId={selectedEvent?.session.id}
              selectedEventDayTime={selectedEventDayTime}
              selectedEventRoom={selectedEvent?.session.room}
              selectedEventLecturerName={selectedEvent?.lecturer?.name}
              originalModes={originalModes}
              perturbationPreview={perturbationPreview}
              mixedRecoveryRequest={buildRescheduleRequest()}
              requestedTimeLabel={
                          originalModes?.time === "find"
                            ? "Any suitable time"
                            : selectedDay && selectedTime
                              ? `${selectedDay} ${selectedTime}`
                              : "Keep current time"
                        }

                        requestedRoomLabel={
                          originalModes?.room === "find"
                            ? "Any suitable room"
                            : selectedRoom ?? "Keep current room"
                        }

                        requestedLecturerLabel={
                          originalModes?.lecturer === "find"
                            ? "Any suitable lecturer"
                            : selectedLecturer
                              ? getLecturerName(selectedLecturer)
                              : "Keep current lecturer"
                        }

                        rescheduleScopeLabel={
                          rescheduleScope === "up-to-2"
                            ? "Up to 2 other classes may be moved"
                            : rescheduleScope === "up-to-3"
                              ? "Up to 3 other classes may be moved"
                              : "No other classes may be moved"
                        }
              getRoomName={getRoomName}
              getLecturerName={getLecturerName}
              formatViolationNice={formatViolationNice}
              isRelaxableViolation={isRelaxableViolation}
              needsInteractiveDiagnosis={needsInteractiveDiagnosis}
              days={days}
              timeSlots={timeSlots}
              lecturers={data!.lecturers}
              modules={data?.modules ?? []}
              rooms={data!.rooms}
              cohorts={data!.cohorts}
              sessions={data!.sessions}
              lecturerUnavailableSlotMap={lecturerUnavailableSlotMap}
              excludeSessionId={selectedEvent.session.id}
              caseAProposedSlots={caseAProposedSlots}
              caseBProposedSlots={caseBProposedSlots}
              diagLecturer={diagLecturer}
              onDiagLecturerChange={setDiagLecturer}
              diagDay={diagDay}
              onDiagDayChange={setDiagDay}
              diagTime={diagTime}
              onDiagTimeChange={setDiagTime}
              diagRoom={diagRoom}
              onDiagRoomChange={setDiagRoom}
              diagLoading={diagLoading}
              diagError={diagError}
              diagResult={diagResult}
              onBackToRequest={() => setStep(1)}
              onRetryWithRelaxations={runRescheduleWithRelaxations}
              onFindRearrangements={runRescheduleWithAdditionalChanges}
              appliedTemporaryDeactivations={appliedTemporaryDeactivations}
            />

            {solverResult?.status === "infeasible" && (
              <section
                aria-labelledby="analytical-exploration-heading"
                style={{
                  marginTop: "20px",
                  border: "1px solid #dbe3ef",
                  borderRadius: "12px",
                  background: "#f8fafc",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setAnalyticalExplorationOpen((open) => !open)
                  }
                  aria-expanded={analyticalExplorationOpen}
                  aria-controls="analytical-exploration-content"
                  style={{
                    width: "100%",
                    padding: "18px 20px",
                    border: 0,
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "20px",
                  }}
                >
                  <div style={{ maxWidth: "720px" }}>
                    <div
                      style={{
                        marginBottom: "5px",
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#475569",
                      }}
                    >
                      Analytical exploration
                    </div>

                    <h3
                      id="analytical-exploration-heading"
                      style={{
                        margin: 0,
                        fontSize: "18px",
                      }}
                    >
                      Investigate the repair path
                    </h3>
                  </div>

                  {analyticalExplorationOpen ? (
                    <ChevronUp size={20} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={20} aria-hidden="true" />
                  )}
                </button>

                {analyticalExplorationOpen && (
                  <div
                    id="analytical-exploration-content"
                    style={{
                      padding: "0 20px 18px",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                      gap: "20px",
                      flexWrap: "wrap",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        maxWidth: "720px",
                        color: "#64748b",
                        lineHeight: 1.55,
                      }}
                    >
                      Explore why this request remains infeasible. Move
                      contributing classes or relax constraints and observe
                      which conflicts each decision resolves or introduces.
                    </p>

                    <button
                      type="button"
                      className="primary-button"
                      onClick={() =>
                        setShowAnalyticalExploration(true)
                      }
                    >
                      Open analytical exploration
                    </button>
                  </div>
                )}
              </section>
            )}
             </>
          )}

          <div className="reschedule-actions">
            {step > 1 && (
              <button
                onClick={() =>
                  setStep((step === 4 && !objectivesApplicable ? 2 : step - 1) as WizardStep)
                }
              >
                Back
              </button>
            )}

            {step < 4 && (
              <button
                className="primary-button"
                onClick={handleContinue}
                disabled={step === 1 && stepOneInvalid}
              >
                Continue
              </button>
            )}

            {step === 4 && solverResult?.status === "feasible" && (
              <button
                type="button"
                className="primary-button"
                onClick={handleSaveSolution}
              >
                Save solution
              </button>
            )}
          </div>
        </main>
      </div>

      {showAnalyticalExploration &&
        solverResult?.status === "infeasible" && (
          <div
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setShowAnalyticalExploration(false);
              }
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              background: "rgba(15, 23, 42, 0.58)",
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="analytical-exploration-modal-title"
              style={{
                width: "min(95vw, 1600px)",
                height: "92vh",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderRadius: "16px",
                background: "#ffffff",
                boxShadow:
                  "0 24px 80px rgba(15, 23, 42, 0.28)",
              }}
            >
              <header
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "20px",
                  padding: "18px 22px",
                  borderBottom: "1px solid #e2e8f0",
                  background: "#ffffff",
                }}
              >
                <div>
                  <div
                    style={{
                      marginBottom: "4px",
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#475569",
                    }}
                  >
                    Analytical exploration
                  </div>

                  <h2
                    id="analytical-exploration-modal-title"
                    style={{
                      margin: "0 0 5px",
                      fontSize: "21px",
                    }}
                  >
                    Explore repair paths
                  </h2>

                  <p
                    style={{
                      margin: 0,
                      color: "#64748b",
                    }}
                  >
                    Investigate how repair decisions resolve existing
                    conflicts or introduce new ones.
                  </p>
                </div>

                <button
                  type="button"
                  aria-label="Close analytical exploration"
                  onClick={() =>
                    setShowAnalyticalExploration(false)
                  }
                  style={{
                    width: "38px",
                    height: "38px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "9px",
                    background: "#ffffff",
                    fontSize: "24px",
                    lineHeight: 1,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </header>

              <div
                style={{
                  flex: 1,
                  overflow: "auto",
                  padding: "22px",
                  background: "#f8fafc",
                }}
              >
                <InteractiveRepair
                  originalSessions={data!.sessions}
                  workingSessions={repairSessions}
                  modules={data!.modules}
                  lecturers={data!.lecturers}
                  programs={data!.programs}
                  cohorts={data!.cohorts}
                  requestedSessionId={selectedEvent.session.id}
                  shuffleCredit={
                    rescheduleScope === "up-to-2"
                      ? 2
                      : rescheduleScope === "up-to-3"
                        ? 3
                        : 0
                  }
                />
              </div>
            </section>
          </div>
        )}
    </section>
  );
}