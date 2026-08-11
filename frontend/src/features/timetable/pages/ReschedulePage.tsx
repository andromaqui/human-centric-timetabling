import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Calendar, Clock, MapPin, User, ExternalLink } from "lucide-react";
import { MiniTimetablePreview } from "../components/MiniTimetablePreview";
import { saveSolution } from "../data/savedSolutionsStore";
import type { SavedSolution } from "../data/savedSolutionsData";
import {
  sessionToSlotIds,
  lecturerUnavailableSlots,
  getBusySlots,
} from "../data/timetableData";

import { useTimetableData } from "../hooks/useTimetableData";
import { api } from "../../../shared/api/client";
import type { Cohort, Lecturer, Program, Session } from "../types";
import "./ReschedulePage.css";

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

// Read-only constraint overview used by Step 3.
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

const OVERVIEW_STAKEHOLDERS = ["Lecturer", "Cohort", "Session", "Room"] as const;

const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};

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

type WizardStep = 1 | 2 | 3 | 4 | 5;

type SelectedEvent = {
  session: Session;
  lecturer?: Lecturer;
  programs: Program[];
  cohorts: Cohort[];
};

type ObjectiveStakeholder = "Lecturer" | "Cohort" | "Room" | "General";

type Objective = {
  id: string;
  label: string;
  stakeholder: ObjectiveStakeholder;
  weight: number; // 1–100
  enabled: boolean;
};

const objectiveStakeholders: ObjectiveStakeholder[] = [
  "Lecturer",
  "Cohort",
  "Room",
  "General",
];

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
  const solutionStatus = 2;
  const [selectedConflictSlot, setSelectedConflictSlot] = useState("tue-09");
  const [step, setStep] = useState<WizardStep>(1);
  const [expandedAlternative, setExpandedAlternative] = useState<string | null>(
    null,
  );
  const [objectives, setObjectives] = useState<Objective[]>(initialObjectives);
  const [showSchedulePreview, setShowSchedulePreview] = useState(false);
  const [hiddenSchedules, setHiddenSchedules] = useState<string[]>([]);
  const [lecturerKnowledge, setLecturerKnowledge] = useState<
    "known" | "find" | null
  >(null);
  const [selectedLecturer, setSelectedLecturer] = useState<string | null>(null);

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

  const availableRooms = useMemo(
    () => data?.rooms.map((room) => room.name) ?? [],
    [data],
  );

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
      (module) => module.id === selectedEvent.session.moduleId,
    );
  }, [data, selectedEvent]);

  const [constraintDefinitions, setConstraintDefinitions] = useState<
    ConstraintDefinition[]
  >([]);

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
  // Step 3: complete READ-ONLY overview of every active constraint instance.
  // This intentionally has no modal, no edit action, and no relaxation controls.
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

  const activeOverviewConstraintCount = constraintDefinitions.filter(
    (constraint) => (overviewEntitiesByConstraint[constraint.id]?.length ?? 0) > 0,
  ).length;

  const selectedEventDayTime = useMemo(() => {
    if (!selectedEvent) return null;

    const start = new Date(selectedEvent.session.start);
    const end = new Date(selectedEvent.session.end);

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
      const duration = 2;
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

  // TODO: HARDCODED PROTOTYPE DATA
  // Replace conflicts and affected preview entities with solver/API results.
  const conflictSlots = [
    {
      id: "tue-09",
      label: "Tuesday 09:00–11:00",
      slotIds: ["tue-09", "tue-10"],
      conflicts: [
        {
          title: "Lecturer unavailable",
          detail: "Dr. Maria Chen is unavailable on Tuesday morning.",
        },
        {
          title: "Cohort workload",
          detail:
            "DS Year 1 already has 2 teaching hours on Tuesday. The maximum is 1 hour.",
        },
      ],
    },
    {
      id: "wed-10",
      label: "Wednesday 10:00–12:00",
      slotIds: ["wed-10", "wed-11"],
      affectedPreviews: {
          lecturer: false,
          cohortIds: ["ds-year-1"],
          room: false,
      },
      conflicts: [
        {
          title: "Cohort conflict",
          detail: "DS Year 1 already has DS110 at this time.",
        },
      ],
    },
  ];

  const [selectedLecturerConflict, setSelectedLecturerConflict] =
    useState("lecturer-1");

  const lecturerConflicts = [
    {
      id: "lecturer-1",
      label: "Dr. Maria Chen",
      conflicts: [
        {
          title: "Lecturer unavailable",
          detail:
            "Dr. Maria Chen is unavailable on Tuesdays and Friday mornings.",
        },
        {
          title: "Lunch break",
          detail:
            "Assigning this class would violate Dr. Maria Chen's required lunch break.",
        },
      ],
    },
    {
      id: "lecturer-2",
      label: "Prof. James O'Connor",
      conflicts: [
        {
          title: "Already teaching",
          detail: "Prof. James O'Connor already has CS204 at this time.",
        },
      ],
    },
    {
      id: "lecturer-3",
      label: "Dr. Aisha Khan",
      conflicts: [
        {
          title: "Workload limit",
          detail:
            "Dr. Aisha Khan has reached her maximum teaching hours for this day.",
        },
      ],
    },
  ];

  const activeLecturerConflict =
    lecturerConflicts.find((l) => l.id === selectedLecturerConflict) ??
    lecturerConflicts[0];

  const activeSlot =
    conflictSlots.find((slot) => slot.id === selectedConflictSlot) ??
    conflictSlots[0];

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

    // 👇 resolve requested lecturer vs current lecturer, same fallback rule as step 2
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
        unavailableSlots: lecturerUnavailableSlots(lecturer),
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

    // 👇 also resolve requested room vs current room, same idea
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
  }, [selectedEvent, selectedLecturer, selectedRoom]);

  if (!selectedEvent) {
    return (
      <section className="reschedule-page">
        <Link to="/" className="back-link">
          ← Back to timetable
        </Link>

        <div className="reschedule-card">
          <h1>Session not found</h1>
          <p>We could not find the class you want to reschedule.</p>
        </div>
      </section>
    );
  }

  const statusTwoSlotIds = ["tue-10", "tue-11"];
  const statusThreeRoom = "Room B204";
  const statusThreeSlotIds = requestedSlotIds.length
    ? requestedSlotIds
    : currentSlotIds;

  const inspectedLecturer =
    data!.lecturers.find(
      (lecturer) => lecturer.name === activeLecturerConflict.label,
    ) ?? selectedEvent.lecturer ?? data!.lecturers[0];

  const lecturerPreviewSlotIds = requestedSlotIds.length
    ? requestedSlotIds
    : currentSlotIds;



  function handleSaveSolution() {
    const selectedAlternative = expandedAlternative ?? "alternative-1";
    const solutionId = `solution-${Date.now()}`;

    const alternatives = {
      "alternative-1": {
        day: "Wednesday",
        displayDay: "Wednesday 23 September",
        startTime: "14:00",
        endTime: "16:00",
        room: "Room B302",
        additionalChanges: [],
      },
      "alternative-2": {
        day: "Thursday",
        displayDay: "Thursday 24 September",
        startTime: "10:00",
        endTime: "12:00",
        room: "Room C105",
        additionalChanges: [
          {
            moduleCode: "CS204",
            before: {
              day: "Tuesday 22 September",
              time: "13:00–15:00",
              room: "Room53",
            },
            after: {
              day: "Thursday 24 September",
              time: "10:00–12:00",
              room: "Room53",
            },
          },
        ],
      },
      "alternative-3": {
        day: "Friday",
        displayDay: "Friday 25 September",
        startTime: "09:00",
        endTime: "11:00",
        room: "Room A210",
        additionalChanges: [
          {
            moduleCode: "CS151",
            before: {
              day: "Wednesday 23 September",
              time: "10:00–12:00",
              room: "Room B204",
            },
            after: {
              day: "Friday 25 September",
              time: "09:00–11:00",
              room: "Room B204",
            },
          },
          {
            moduleCode: "DS110",
            before: {
              day: "Wednesday 23 September",
              time: "10:00–12:00",
              room: "Room B204",
            },
            after: {
              day: "Wednesday 23 September",
              time: "10:00–12:00",
              room: "Room A210",
            },
          },
        ],
      },
    } as const;

    const chosen = alternatives[selectedAlternative];

    const requestType: SavedSolution["requestType"] =
      changeType === "time"
        ? "change-time"
        : changeType === "room"
          ? "change-room"
          : changeType === "lecturer"
            ? "change-lecturer"
            : changeType === "both"
              ? "change-time-and-room"
              : "find-any-time";

    const activeConstraints: SavedSolution["constraints"] =
      relatedConstraints.map((row) => ({
        group: row.group,
        rule: row.constraintName,
        state: row.relaxation ? describeRelaxation(row.relaxation) : "Active",
        relaxable: row.relaxable,
      }));

    const savedSolution: SavedSolution = {
      id: solutionId,
      savedAt: new Date().toISOString(),
      moduleCode: selectedEvent.session.moduleCode,
      moduleTitle: `${selectedEvent.session.moduleCode} saved solution`,
      requestType,
      requestSummary:
        changeType === "room"
          ? `Change the room for ${selectedEvent.session.moduleCode}.`
          : changeType === "lecturer"
            ? `Change the lecturer for ${selectedEvent.session.moduleCode}.`
            : timeKnowledge === "find"
              ? `Find a feasible new time for ${selectedEvent.session.moduleCode}.`
              : `Move ${selectedEvent.session.moduleCode} to a new timetable slot.`,
      original: {
        day: selectedEvent.session.day,
        time: `${selectedEvent.session.startTime}–${selectedEvent.session.endTime}`,
        room: selectedEvent.session.room ?? "Room TBC",
        lecturer: selectedEvent.lecturer?.name ?? "Unassigned",
      },
      result: {
        day: chosen.displayDay,
        time: `${chosen.startTime}–${chosen.endTime}`,
        room: chosen.room,
        lecturer: selectedEvent.lecturer?.name ?? "Unassigned",
      },
      additionalChanges: [...chosen.additionalChanges],
      affectedStakeholders: [
        ...(selectedEvent.lecturer
          ? [
              {
                type: "lecturer" as const,
                id: selectedEvent.lecturer.id,
                label: selectedEvent.lecturer.name,
              },
            ]
          : []),
        ...selectedEvent.cohorts.map((cohort) => ({
          type: "cohort" as const,
          id: cohort.id,
          label: cohort.name,
        })),
        {
          type: "room" as const,
          id: chosen.room,
          label: chosen.room,
        },
      ],
      constraints: activeConstraints,
      objectives: objectives.map((objective) => ({ ...objective })),
      resultingSessions: data!.sessions.map((session) =>
        session.id === selectedEvent.session.id
          ? {
              ...session,
              day: chosen.day,
              startTime: chosen.startTime,
              endTime: chosen.endTime,
              room: chosen.room,
            }
          : session,
      ),
    };

    saveSolution(savedSolution);
    navigate(`/saved-solutions/${solutionId}`);
  }

  return (
    <section className="reschedule-page">
      <Link to="/" className="back-link">
        ← Back to timetable
      </Link>

      <div className="reschedule-header">
        <h1>
          Reschedule class - {selectedModule?.code ?? "Unknown module"}
        </h1>

        <div className="reschedule-meta">
          <div className="meta-item">
            <Calendar size={18} />
            <span>{selectedModule?.title ?? "Untitled class"}</span>
          </div>

          <div className="meta-item">
            <MapPin size={18} />
            <span>{selectedEvent.session.room ?? "Room TBC"}</span>
          </div>

          <div className="meta-item">
            <Clock size={18} />
            <span>{selectedEventDayTime ?? "Time TBC"}</span>
          </div>

          <div className="meta-item">
            <User size={18} />
            <span>{selectedEvent.lecturer?.name ?? "Unassigned"}</span>
          </div>
        </div>
      </div>

      <div className="reschedule-shell">
        <aside className="reschedule-sidebar">
          {[1, 2, 3, 4, 5].map((item) => (
            <button
              key={item}
              className={step === item ? "wizard-step active" : "wizard-step"}
              onClick={() => setStep(item as WizardStep)}
            >
              <span>{item}</span>
              {item === 1 && "Request"}
              {item === 2 && "Impact"}
              {item === 3 && "Related constraints"}
              {item === 4 && "Priorities"}
              {item === 5 && "Solution"}
            </button>
          ))}
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
                    <button
                      className={changeType === "lecturer" ? "active" : ""}
                      onClick={() => setChangeType("lecturer")}
                    >
                      Change lecturer
                    </button>
                  </div>
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

              {changeType && (
                <div className="impact-group">
                  <div className="impact-label">
                    How many other classes are allowed to be rescheduled?
                  </div>

                  <div className="request-options">
                    <button
                      className={rescheduleScope === "only" ? "active" : ""}
                      onClick={() => setRescheduleScope("only")}
                    >
                      Only this class
                    </button>
                    <button
                      className={rescheduleScope === "up-to-2" ? "active" : ""}
                      onClick={() => setRescheduleScope("up-to-2")}
                    >
                      Up to 2 other classes
                    </button>
                    <button
                      className={rescheduleScope === "up-to-3" ? "active" : ""}
                      onClick={() => setRescheduleScope("up-to-3")}
                    >
                      Up to 3 other classes
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h2>Impact</h2>

              <div className="impact-section">
                <div className="impact-group">
                  <div className="impact-label">Lecturer</div>
                  <div className="impact-chips">
                    <span className="impact-chip">
                      {selectedLecturer
                        ? data!.lecturers.find(
                            (l) => l.id === selectedLecturer,
                          )?.name
                        : (selectedEvent.lecturer?.name ?? "Unassigned")}
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
                      {selectedRoom ?? selectedEvent.session.room ?? "Room TBC"}
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
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {step === 3 && (
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

                    const stakeholderOpen = openOverviewStakeholders.has(stakeholder);

                    return (
                      <section
                        key={stakeholder}
                        className="constraint-group-block constraint-overview-group"
                      >
                        <button
                          type="button"
                          className="constraint-overview-header"
                          onClick={() => toggleOverviewStakeholder(stakeholder)}
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
                              const groups =
                                overviewEntitiesByConstraint[constraint.id] ?? [];
                              const constraintOpen = openOverviewConstraints.has(
                                constraint.id,
                              );
                              const instanceCount = groups.reduce(
                                (total, group) => total + group.leaves.length,
                                0,
                              );

                              return (
                                <div
                                  key={constraint.id}
                                  className="constraint-overview-rule"
                                >
                                  <button
                                    type="button"
                                    className="constraint-overview-rule-header"
                                    onClick={() =>
                                      toggleOverviewConstraint(constraint.id)
                                    }
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
                                      {constraint.type === "relaxable"
                                        ? "Relaxable"
                                        : "Unrelaxable"}
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
                                                {leaf.infoText && (
                                                  <small>{leaf.infoText}</small>
                                                )}
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
                                        const entityOpen =
                                          openOverviewEntities.has(entityKey);

                                        return (
                                          <div
                                            key={group.key}
                                            className="constraint-overview-entity"
                                          >
                                            <button
                                              type="button"
                                              className="constraint-overview-entity-header"
                                              onClick={() =>
                                                toggleOverviewEntity(
                                                  constraint.id,
                                                  group.key,
                                                )
                                              }
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
          )}

          {step === 4 && (
            <>
              <h2>Priorities</h2>

              <p className="step-description">
                Set how much each objective matters to the solver, from 1 (low)
                to 100 (high).
              </p>

              <div className="objective-groups">
                {objectiveStakeholders.map((stakeholder) => {
                  const stakeholderObjectives = objectives.filter(
                    (objective) => objective.stakeholder === stakeholder,
                  );

                  return (
                    <section key={stakeholder} className="objective-group">
                      <div className="objective-group-heading">
                        <h3>{stakeholder} objectives</h3>
                        <span>{stakeholderObjectives.length}</span>
                      </div>

                      <div className="objective-list">
                        {stakeholderObjectives.map((objective) => (
                          <div
                            key={objective.id}
                            className={
                              objective.enabled
                                ? "objective-row"
                                : "objective-row objective-disabled"
                            }
                          >
                            <div className="objective-details">
                              <span className="objective-label">
                                {objective.label}
                              </span>

                              <label className="objective-toggle">
                                <input
                                  type="checkbox"
                                  checked={objective.enabled}
                                  onChange={() =>
                                    handleObjectiveToggle(objective.id)
                                  }
                                />
                                <span>
                                  {objective.enabled ? "Enabled" : "Disabled"}
                                </span>
                              </label>
                            </div>

                            <input
                              type="range"
                              min={1}
                              max={100}
                              value={objective.weight}
                              disabled={!objective.enabled}
                              onChange={(event) =>
                                handleWeightChange(
                                  objective.id,
                                  Number(event.target.value),
                                )
                              }
                              className="objective-slider"
                            />

                            <span className="objective-weight">
                              {objective.enabled ? objective.weight : "Off"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}

          {step === 5 && (
            <>
              {solutionStatus === 1 && (
                <>
                  <h3 className="impact-title">Solution alternatives</h3>

                  <div className="solution-options">
                    <div className="solution-card recommended">
                      <div className="solution-card-header">
                        <h4>Alternative 1</h4>
                        <span className="solution-tag">Recommended</span>
                      </div>

                      <div className="solution-main">
                        Wed 23 Sep, 14:00 – 16:00 · Room B302
                      </div>

                      <div className="solution-score warning">
                        No changes required, low lecturer preferences score
                      </div>
                    </div>

                    <div
                      className={
                        expandedAlternative === "alternative-2"
                          ? "solution-card expanded"
                          : "solution-card"
                      }
                      onClick={() =>
                        setExpandedAlternative(
                          expandedAlternative === "alternative-2"
                            ? null
                            : "alternative-2",
                        )
                      }
                    >
                      <div className="solution-card-header">
                        <h4>Alternative 2</h4>
                        <span className="solution-chevron">
                          {expandedAlternative === "alternative-2" ? "▲" : "▼"}
                        </span>
                      </div>

                      <div className="solution-main">
                        Thu 24 Sep, 10:00 – 12:00 · Room C105
                      </div>

                      <div className="solution-score warning">
                        1 additional change required
                      </div>

                      <div className="solution-score good">
                        Low walking distance
                      </div>

                      {expandedAlternative === "alternative-2" && (
                        <div className="solution-changes">
                          <h5>Changes</h5>

                          <ul>
                            <li>
                              <strong>CS204</strong> moved from Tue 13:00–15:00
                              <br />
                              <span>→ Thu 10:00–12:00</span>
                            </li>
                          </ul>

                          {/* TODO: HARDCODED PROTOTYPE DATA
                              These affected entities are taken from session-2.
                              Replace with solver/API output for each alternative. */}
                          <div className="schedule-preview-controlsss">
                           <h5> Affected Stakeholders </h5>

                            <div className="impact-chips">
                              <Link
                                to="/timetable-preview?lecturer=lecturer-2"
                                className="preview-chip"
                              >
                                Lecturer: Prof. James O&apos;Connor ↗
                              </Link>

                              <Link
                                to="/timetable-preview?cohort=cs-y2"
                                className="preview-chip"
                              >
                                Cohort: CS Year 2 ↗
                              </Link>

                              <Link
                                to={`/timetable-preview?room=${encodeURIComponent(
                                  "Room53",
                                )}`}
                                className="preview-chip"
                              >
                                Room: Room53 ↗
                              </Link>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      className={
                        expandedAlternative === "alternative-3"
                          ? "solution-card expanded"
                          : "solution-card"
                      }
                      onClick={() =>
                        setExpandedAlternative(
                          expandedAlternative === "alternative-3"
                            ? null
                            : "alternative-3",
                        )
                      }
                    >
                      <div className="solution-card-header">
                        <h4>Alternative 3</h4>
                        <span className="solution-chevron">
                          {expandedAlternative === "alternative-3" ? "▲" : "▼"}
                        </span>
                      </div>

                      <div className="solution-main">
                        Fri 25 Sep, 09:00 – 11:00 · Room A210
                      </div>

                      <div className="solution-score bad">
                        2 additional changes required
                      </div>

                      <div className="solution-score good">
                        Low walking distance
                      </div>

                      {expandedAlternative === "alternative-3" && (
                        <div className="solution-changes">
                          <h5>Changes</h5>

                          <ul>
                            <li>
                              <strong>CS151</strong> moved from Wed 10:00–12:00
                              <br />
                              <span>→ Fri 09:00–11:00</span>
                            </li>

                            <li>
                              DS110 Room changed from B204
                              <br />
                              <span>→ A210</span>
                            </li>
                          </ul>

                          {/* TODO: HARDCODED PROTOTYPE DATA
                              DS110 stakeholder details come from session-3.
                              CS151 is not currently present in timetableData,
                              so add its lecturer/cohort links once that session exists. */}
                          <div className="schedule-preview-controlsss">
                            <h5>Affected Stakeholders</h5>

                            <div className="impact-chips">
                              <Link
                                to="/timetable-preview?lecturer=lecturer-3"
                                className="preview-chip"
                              >
                                Lecturer: Dr. Aisha Khan ↗
                              </Link>

                              <Link
                                to="/timetable-preview?cohort=ds-y1"
                                className="preview-chip"
                              >
                                Cohort: DS Year 1 ↗
                              </Link>

                              <Link
                                to={`/timetable-preview?room=${encodeURIComponent(
                                  "Room A210",
                                )}`}
                                className="preview-chip"
                              >
                                Room: Room A210 ↗
                              </Link>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {solutionStatus === 2 && (
                <div className="no-solution-card">
                  <div className="no-solution-icon">!</div>

                  <div>
                    <h4>Could not move CS101 to Tuesday 10:00–12:00</h4>

                    <p>
                      We checked the requested time, but found conflicts that
                      prevent this class from being moved there.
                    </p>

                    <div className="conflict-details">
                      <div>
                        <span>Lecturer unavailable</span>
                        <strong>
                          Dr. Maria Chen is unavailable on Tuesday morning.
                        </strong>
                      </div>

                      <div>
                        <span>Cohort workload limit</span>
                        <strong>
                          DS Year 1 already has 2 teaching hours on Tuesday. The
                          current maximum is 1 hour.
                        </strong>
                      </div>
                    </div>

                    <div className="conflict-visual-section">
                      <h5>Visual conflict evidence</h5>
                      <p>Compare the rejected time with the affected lecturer and cohort schedules.</p>
                    </div>

                    <div className="schedule-preview-block infeasibility-preview">
                      <div className="schedule-preview-strip">
                        {/* TODO: HARDCODED PROTOTYPE BEHAVIOUR
                            For solution status 2, only Dr. Maria Chen
                            and CS Year 1 are shown as visual conflict evidence. */}
                        {selectedEvent.lecturer && (
                          <div className="mini-schedule-card">
                            <MiniTimetablePreview
                              title={`Lecturer: ${selectedEvent.lecturer.name}`}
                              busySlots={getBusySlots(
                                data!.sessions,
                                (session) =>
                                  session.lecturerId ===
                                  selectedEvent.lecturer?.id,
                                selectedEvent.session.id,
                              )}
                              selectedSlots={statusTwoSlotIds}
                              unavailableSlots={lecturerUnavailableSlots(
                                selectedEvent.lecturer,
                              )}
                              fullTimetableLink={`/timetable-preview?lecturer=${selectedEvent.lecturer.id}`}
                            />
                          </div>
                        )}

                        {selectedEvent.cohorts
                          .filter((cohort) => cohort.name === "CS Year 1")
                          .map((cohort) => (
                            <div key={cohort.id} className="mini-schedule-card">
                              <MiniTimetablePreview
                                title={`Cohort: ${cohort.name}`}
                                busySlots={getBusySlots(
                                  data!.sessions,
                                  (session) =>
                                    session.cohortIds.includes(cohort.id),
                                  selectedEvent.session.id,
                                )}
                                selectedSlots={statusTwoSlotIds}
                                unavailableSlots={[]}
                                fullTimetableLink={`/timetable-preview?cohort=${cohort.id}`}
                              />
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="constraint-source">
                      <span>Responsible constraints</span>
                      <strong>
                        Lecturer availability · Cohort teaching hours
                      </strong>
                      <p>
                        These conflicts are caused by the currently active
                        constraints. If appropriate, you can{" "}
                        <Link to="/constraints">
                          review or modify the active constraints
                        </Link>{" "}
                        and then try again.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {solutionStatus === 3 && (
                <div className="no-solution-card">
                  <div className="no-solution-icon">!</div>

                  <div>
                    <h4>Could not move CS101 to Room B204</h4>

                    <p>
                      We checked possible times for this room, but could not
                      find a slot where the class can be moved without
                      conflicts.
                    </p>

                    <div className="conflict-details">
                      <div>
                        <span>Room availability</span>
                        <strong>
                          Room B204 is not available for any suitable slot for
                          this class.
                        </strong>
                      </div>

                      <div>
                        <span>Missing equipment</span>
                        <strong>
                          CS101 requires a Linux lab and projector, but Room
                          B204 does not provide all required equipment.
                        </strong>
                      </div>
                    </div>

                    <div className="conflict-visual-section">
                      <h5>Visual conflict evidence</h5>
                      <p>See where the rejected room is already occupied.</p>
                    </div>

                    <div className="schedule-preview-block infeasibility-preview">
                      <div className="schedule-preview-strip">
                        <div className="mini-schedule-card">
                          <MiniTimetablePreview
                            title={`Room: ${statusThreeRoom}`}
                            busySlots={getBusySlots(
                              data!.sessions,
                              (session) => session.room === statusThreeRoom,
                              selectedEvent.session.id,
                            )}
                            selectedSlots={statusThreeSlotIds}
                            unavailableSlots={[]}
                            fullTimetableLink={`/timetable-preview?room=${encodeURIComponent(
                              statusThreeRoom,
                            )}`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="constraint-source">
                      <span>Related constraints</span>
                      <strong>Room booking · Room equipment</strong>

                      <p>
                        These conflicts are caused by the currently active
                        constraints. If appropriate, you can{" "}
                        <Link to="/constraints">
                          review or modify the active constraints
                        </Link>{" "}
                        and then try again.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {solutionStatus === 4 && (
                <div className="no-solution-card">
                  <div className="no-solution-icon">!</div>

                  <div>
                    <h4>No feasible time found for CS101</h4>

                    <p>
                      We checked possible time slots, but every candidate slot
                      has at least one conflict with the currently active
                      constraints.
                    </p>

                    <label className="conflict-slot-picker">
                      <span>Inspect candidate slot</span>

                      <select
                        value={selectedConflictSlot}
                        onChange={(event) =>
                          setSelectedConflictSlot(event.target.value)
                        }
                      >
                        {conflictSlots.map((slot) => (
                          <option key={slot.id} value={slot.id}>
                            {slot.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="conflict-details">
                      {activeSlot.conflicts.map((conflict) => (
                        <div key={conflict.title}>
                          <span>{conflict.title}</span>
                          <strong>{conflict.detail}</strong>
                        </div>
                      ))}
                    </div>

                    <div className="conflict-visual-section">
                      <h5>Visual conflict evidence</h5>
                      <p>The previews update when you inspect another candidate slot.</p>
                    </div>

                    <div className="schedule-preview-block infeasibility-preview">
                      <div className="schedule-preview-strip">
                        {selectedConflictSlot === "wed-10" ? (
                          // TODO: HARDCODED PROTOTYPE BEHAVIOUR
                          // For Wednesday 10:00–12:00, the only conflict is DS Year 1,
                          // so only that cohort timetable is shown.
                          selectedEvent.cohorts
                            .filter((cohort) => cohort.name === "DS Year 1")
                            .map((cohort) => (
                              <div key={cohort.id} className="mini-schedule-card">
                                <MiniTimetablePreview
                                  title={`Cohort: ${cohort.name}`}
                                  busySlots={getBusySlots(
                                    data!.sessions,
                                    (session) =>
                                      session.cohortIds.includes(cohort.id),
                                    selectedEvent.session.id,
                                  )}
                                  selectedSlots={activeSlot.slotIds}
                                  unavailableSlots={[]}
                                  fullTimetableLink={`/timetable-preview?cohort=${cohort.id}`}
                                />
                              </div>
                            ))
                        ) : selectedConflictSlot === "tue-09" ? (
                          <>
                            {/* TODO: HARDCODED PROTOTYPE BEHAVIOUR
                                For Tuesday 09:00–11:00, only Dr. Maria Chen
                                and DS Year 1 are involved in the conflict. */}
                            {selectedEvent.lecturer?.name === "Dr. Maria Chen" && (
                              <div className="mini-schedule-card">
                                <MiniTimetablePreview
                                  title={`Lecturer: ${selectedEvent.lecturer.name}`}
                                  busySlots={getBusySlots(
                                    data!.sessions,
                                    (session) =>
                                      session.lecturerId ===
                                      selectedEvent.lecturer?.id,
                                    selectedEvent.session.id,
                                  )}
                                  selectedSlots={activeSlot.slotIds}
                                  unavailableSlots={lecturerUnavailableSlots(
                                    selectedEvent.lecturer,
                                  )}
                                  fullTimetableLink={`/timetable-preview?lecturer=${selectedEvent.lecturer.id}`}
                                />
                              </div>
                            )}

                            {selectedEvent.cohorts
                              .filter((cohort) => cohort.name === "DS Year 1")
                              .map((cohort) => (
                                <div key={cohort.id} className="mini-schedule-card">
                                  <MiniTimetablePreview
                                    title={`Cohort: ${cohort.name}`}
                                    busySlots={getBusySlots(
                                      data!.sessions,
                                      (session) =>
                                        session.cohortIds.includes(cohort.id),
                                      selectedEvent.session.id,
                                    )}
                                    selectedSlots={activeSlot.slotIds}
                                    unavailableSlots={[]}
                                    fullTimetableLink={`/timetable-preview?cohort=${cohort.id}`}
                                  />
                                </div>
                              ))}
                          </>
                        ) : (
                          <>
                            {selectedEvent.lecturer && (
                              <div className="mini-schedule-card">
                                <MiniTimetablePreview
                                  title={`Lecturer: ${selectedEvent.lecturer.name}`}
                                  busySlots={getBusySlots(
                                    data!.sessions,
                                    (session) =>
                                      session.lecturerId ===
                                      selectedEvent.lecturer?.id,
                                    selectedEvent.session.id,
                                  )}
                                  selectedSlots={activeSlot.slotIds}
                                  unavailableSlots={lecturerUnavailableSlots(
                                    selectedEvent.lecturer,
                                  )}
                                  fullTimetableLink={`/timetable-preview?lecturer=${selectedEvent.lecturer.id}`}
                                />
                              </div>
                            )}

                            {selectedEvent.cohorts.map((cohort) => (
                              <div key={cohort.id} className="mini-schedule-card">
                                <MiniTimetablePreview
                                  title={`Cohort: ${cohort.name}`}
                                  busySlots={getBusySlots(
                                    data!.sessions,
                                    (session) =>
                                      session.cohortIds.includes(cohort.id),
                                    selectedEvent.session.id,
                                  )}
                                  selectedSlots={activeSlot.slotIds}
                                  unavailableSlots={[]}
                                  fullTimetableLink={`/timetable-preview?cohort=${cohort.id}`}
                                />
                              </div>
                            ))}

                            <div className="mini-schedule-card">
                              <MiniTimetablePreview
                                title={`Room: ${selectedRoom ?? selectedEvent.session.room ?? "Room TBC"}`}
                                busySlots={getBusySlots(
                                  data!.sessions,
                                  (session) =>
                                    session.room ===
                                    (selectedRoom ?? selectedEvent.session.room),
                                  selectedEvent.session.id,
                                )}
                                selectedSlots={activeSlot.slotIds}
                                unavailableSlots={[]}
                                fullTimetableLink={`/timetable-preview?room=${encodeURIComponent(
                                  selectedRoom ?? selectedEvent.session.room ?? "",
                                )}`}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="constraint-source">
                      <span>Related constraints</span>
                      <strong>
                        Lecturer availability · Cohort teaching hours · Room
                        booking
                      </strong>

                      <p>
                        These conflicts are caused by the currently active
                        constraints. If appropriate, you can{" "}
                        <Link to="/constraints">
                          review or modify the active constraints
                        </Link>{" "}
                        and then try again.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {solutionStatus === 5 && (
                <div className="no-solution-card">
                  <div className="no-solution-icon">!</div>

                  <div>
                    <h4>No available lecturer found for CS101</h4>

                    <p>
                      We checked every possible lecturer, but each one has at
                      least one conflict with the currently active constraints.
                    </p>

                    <label className="conflict-slot-picker">
                      <span>Inspect candidate lecturer</span>

                      <select
                        value={selectedLecturerConflict}
                        onChange={(event) =>
                          setSelectedLecturerConflict(event.target.value)
                        }
                      >
                        {lecturerConflicts.map((lecturer) => (
                          <option key={lecturer.id} value={lecturer.id}>
                            {lecturer.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="conflict-details">
                      {activeLecturerConflict.conflicts.map((conflict) => (
                        <div key={conflict.title}>
                          <span>{conflict.title}</span>
                          <strong>{conflict.detail}</strong>
                        </div>
                      ))}
                    </div>

                    <div className="conflict-visual-section">
                      <h5>Visual conflict evidence</h5>
                      <p>
                        The highlighted slots show the requested or current class
                        time against this lecturer&apos;s timetable and unavailable periods.
                      </p>
                    </div>

                    {inspectedLecturer && (
                      <div className="schedule-preview-block infeasibility-preview">
                        <div className="schedule-preview-strip">
                          <div className="mini-schedule-card">
                            <MiniTimetablePreview
                              title={`Lecturer: ${inspectedLecturer.name}`}
                              busySlots={getBusySlots(
                                data!.sessions,
                                (session) =>
                                  session.lecturerId === inspectedLecturer.id,
                                selectedEvent.session.id,
                              )}
                              selectedSlots={lecturerPreviewSlotIds}
                              unavailableSlots={lecturerUnavailableSlots(
                                inspectedLecturer,
                              )}
                              fullTimetableLink={`/timetable-preview?lecturer=${inspectedLecturer.id}`}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="constraint-source">
                      <span>Related constraints</span>
                      <strong>
                        Lecturer availability · Lunch break · Workload limits
                      </strong>

                      <p>
                        These conflicts are caused by the currently active
                        constraints. If appropriate, you can{" "}
                        <Link to="/constraints">
                          review or modify the active constraints
                        </Link>{" "}
                        and then try again.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="reschedule-actions">
            {step > 1 && (
              <button onClick={() => setStep((step - 1) as WizardStep)}>
                Back
              </button>
            )}

            {step < 5 && (
              <button
                className="primary-button"
                onClick={() => setStep((step + 1) as WizardStep)}
              >
                Continue
              </button>
            )}

            {step === 5 && (
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
    </section>
  );
}
