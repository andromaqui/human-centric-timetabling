import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import { mapSessionsToCalendarEvents } from "../utils/calendarMappers";
import { TimetableView } from "../components/TimetableView";
import { MiniTimetablePreview } from "../components/MiniTimetablePreview";
import { getBusySlots, sessionToSlotIds } from "../data/timetableData";
import { api } from "../../../shared/api/client";

import {
  diagnoseWorkingDay,
  type WorkingDayViolation,
} from "./interactiveRepair";

import {
  fetchHistoricalImpacts,
  type HistoricalImpact,
  type HistoricalImpactType,
  type HistoricalStakeholderType,
} from "./solution/historicalImpacts";

import type {
  Session,
  Module,
  Lecturer,
  Program,
  Cohort,
} from "../types";

import "./TimetableCalendar.css";
import "./InteractiveRepair.css";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type InteractiveRepairProps = {
  originalSessions: Session[];
  workingSessions: Session[];

  modules: Module[];
  lecturers: Lecturer[];
  programs: Program[];
  cohorts: Cohort[];

  requestedSessionId: string;
  shuffleCredit: number;

  /** Called when the user leaves a feasible repair without committing it. */
  onCloseWithoutSaving?: () => void;

  /** Called when the user chooses to commit the currently feasible repair. */
  onSaveRepair?: (sessions: Session[]) => void;
};

type WorkingSessionMove = {
  session_id: string;
  new_start: string;
  new_end: string;
};

type RepairAttempt = {
  sessionId: string;
  day: string;
  time: string;
};

type RelaxationRecord = {
  repairStateId: string;
  violation: WorkingDayViolation;
};

type RepairColumn = {
  id: string;

  parentStateId: string | null;
  archived?: boolean;

  workingSessions: Session[];
  violations: WorkingDayViolation[];
  relaxedViolations: WorkingDayViolation[];

  actionLabel?: string;

  movedSessionId?: string;
  attemptedDay?: string;
  attemptedTime?: string;

  retryingCurrentPlacement?: boolean;

  editingMoveSessionId?: string;
  selectedDay?: string;
  selectedTime?: string;
};

type HistoricalImpactConfig = {
  stakeholderType: HistoricalStakeholderType;
  impactType: HistoricalImpactType;
  stakeholderId: string;
};

type HistoricalImpactRowLike =
  HistoricalImpact & {
    stakeholder_id?: string;
    stakeholderId?: string;
    impact_type?: string;
    impactType?: string;
    magnitude_minutes?: number;
    magnitudeMinutes?: number;
    occurred_on?: string;
    occurredOn?: string;
  };

type ClassContextSelection = {
  columnId: string;
  sessionId: string;
};

type ClassContextTab =
  | { type: "lecturer"; id: string }
  | { type: "cohort"; id: string }
  | { type: "room"; id: string };

type ApiLecturerUnavailability = {
  id: number;
  lecturer_id?: string;
  day: string;
  hour: number;
};

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

function formatMoveDate(value: string) {
  const date = new Date(value);

  const day = date.toLocaleDateString("en-GB", {
    weekday: "long",
  });

  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${day} ${time}`;
}

function getSessionDay(value: string) {
  return new Date(value)
    .toLocaleDateString("en-US", {
      weekday: "long",
    })
    .toLowerCase();
}

function getSessionTime(value: string) {
  return new Date(value).toLocaleTimeString(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  );
}

function formatTimetableDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:00`;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export function InteractiveRepair({
  originalSessions,
  workingSessions,
  modules,
  lecturers,
  programs,
  cohorts,
  requestedSessionId,
  shuffleCredit,
  onCloseWithoutSaving,
  onSaveRepair,
}: InteractiveRepairProps) {
  /* ------------------------------------------------------------------------ */
  /* Repair path                                                              */
  /* ------------------------------------------------------------------------ */

  const [
    repairColumns,
    setRepairColumns,
  ] = useState<RepairColumn[]>([]);

  const [
    repairAttempts,
    setRepairAttempts,
  ] = useState<RepairAttempt[]>([]);

  const [
    relaxationRecords,
    setRelaxationRecords,
  ] = useState<RelaxationRecord[]>([]);

  /*
   * Previous repair states are collapsed by default once a later state
   * becomes active. Users can expand any previous state without changing
   * the active repair branch.
   */
  const [
    expandedStateIds,
    setExpandedStateIds,
  ] = useState<Set<string>>(
    () => new Set<string>(),
  );

  function toggleStateDetails(
    columnId: string,
  ) {
    setExpandedStateIds(
      (current) => {
        const next =
          new Set(current);

        if (next.has(columnId)) {
          next.delete(columnId);
        } else {
          next.add(columnId);
        }

        return next;
      },
    );
  }

  const [
    historicalImpactsByKey,
    setHistoricalImpactsByKey,
  ] = useState<
    Record<string, HistoricalImpact[]>
  >({});

  const [
    openHistoricalImpactKey,
    setOpenHistoricalImpactKey,
  ] = useState<string | null>(null);

  /*
   * Popovers are rendered through a portal under document.body so they are
   * not clipped by the repair-state/modal overflow containers. Each trigger
   * button is kept here so the floating panel can anchor itself to the
   * button's viewport position.
   */
  const historicalImpactButtonRefs =
    useRef<
      Map<string, HTMLButtonElement>
    >(new Map());

  /*
   * Give the pointer a short grace period to travel from the trigger into the
   * portal-rendered popover. Entering either surface cancels the pending close.
   */
  const historicalImpactCloseTimer =
    useRef<number | null>(null);

  function cancelHistoricalImpactClose() {
    if (
      historicalImpactCloseTimer.current !==
      null
    ) {
      window.clearTimeout(
        historicalImpactCloseTimer.current,
      );

      historicalImpactCloseTimer.current =
        null;
    }
  }

  function openHistoricalImpactPopover(
    key: string,
  ) {
    cancelHistoricalImpactClose();
    setOpenHistoricalImpactKey(key);
  }

  function scheduleHistoricalImpactClose() {
    cancelHistoricalImpactClose();

    historicalImpactCloseTimer.current =
      window.setTimeout(() => {
        setOpenHistoricalImpactKey(null);
        historicalImpactCloseTimer.current =
          null;
      }, 250);
  }

  const [conflictsLoading, setConflictsLoading] =
    useState(false);

  const [conflictsError, setConflictsError] =
    useState<string | null>(null);

  /*
   * Historical impact is shown only for the four welfare-related constraint
   * families used by Interactive Repair:
   *
   * - lecturer lunch break
   * - cohort lunch break
   * - lecturer long/consecutive teaching
   * - cohort long/consecutive teaching
   *
   * Load the four small datasets once so popovers can open immediately.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadHistoricalImpacts() {
      const configs: Array<{
        stakeholderType: HistoricalStakeholderType;
        impactType: HistoricalImpactType;
      }> = [
        {
          stakeholderType: "lecturer",
          impactType: "lunch-break-reduced",
        },
        {
          stakeholderType: "cohort",
          impactType: "lunch-break-reduced",
        },
        {
          stakeholderType: "lecturer",
          impactType: "consecutive-teaching",
        },
        {
          stakeholderType: "cohort",
          impactType: "consecutive-teaching",
        },
      ];

      try {
        const entries =
          await Promise.all(
            configs.map(
              async (config) => {
                const key =
                  `${config.stakeholderType}:${config.impactType}`;

                const impacts =
                  await fetchHistoricalImpacts(
                    config.stakeholderType,
                    config.impactType,
                  );

                return [
                  key,
                  impacts,
                ] as const;
              },
            ),
          );

        if (!cancelled) {
          setHistoricalImpactsByKey(
            Object.fromEntries(
              entries,
            ),
          );
        }
      } catch (error) {
        console.error(
          "Failed to load historical impacts for interactive repair:",
          error,
        );

        if (!cancelled) {
          setHistoricalImpactsByKey(
            {},
          );
        }
      }
    }

    loadHistoricalImpacts();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Helpers for timetable snapshots                                          */
  /* ------------------------------------------------------------------------ */

  function deriveMoves(
    sessions: Session[],
  ): WorkingSessionMove[] {
    return sessions.flatMap(
      (workingSession) => {
        const originalSession =
          originalSessions.find(
            (session) =>
              session.id ===
              workingSession.id,
          );

        if (!originalSession) {
          return [];
        }

        const changed =
          originalSession.start !==
            workingSession.start ||
          originalSession.end !==
            workingSession.end;

        if (!changed) {
          return [];
        }

        return [
          {
            session_id:
              workingSession.id,
            new_start:
              workingSession.start,
            new_end:
              workingSession.end,
          },
        ];
      },
    );
  }

  function getSessionFromSnapshot(
    sessions: Session[],
    sessionId: string,
  ) {
    return (
      sessions.find(
        (item) =>
          item.id === sessionId,
      ) ??
      originalSessions.find(
        (item) =>
          item.id === sessionId,
      )
    );
  }

  const [activeColumnId, setActiveColumnId] =
    useState<string | null>(null);

  const activeColumn =
    repairColumns.find(
      (column) =>
        column.id === activeColumnId,
    ) ??
    (
      repairColumns.length > 0
        ? repairColumns[
            repairColumns.length - 1
          ]
        : undefined
    );

  /*
   * The timetable under the cards displays the ACTIVE state's snapshot.
   *
   * Returning to an earlier state changes only this pointer. It does not
   * delete or rewrite any later diagnosed cards.
   */
  const latestWorkingSessions =
    activeColumn?.workingSessions ??
    workingSessions;

  /* ------------------------------------------------------------------------ */
  /* Class context preview                                                    */
  /* ------------------------------------------------------------------------ */

  const [
    classContextSelection,
    setClassContextSelection,
  ] = useState<ClassContextSelection | null>(null);

  const [
    classContextTab,
    setClassContextTab,
  ] = useState<ClassContextTab | null>(null);

  const [
    lecturerUnavailableSlotMap,
    setLecturerUnavailableSlotMap,
  ] = useState<Record<string, string[]>>({});

  const classContextColumn = useMemo(
    () =>
      classContextSelection
        ? repairColumns.find(
            (column) =>
              column.id === classContextSelection.columnId,
          )
        : undefined,
    [classContextSelection, repairColumns],
  );

  const classContextSessions =
    classContextColumn?.workingSessions ??
    latestWorkingSessions;

  const classContextSession = useMemo(
    () =>
      classContextSelection
        ? classContextSessions.find(
            (session) =>
              session.id === classContextSelection.sessionId,
          ) ??
          originalSessions.find(
            (session) =>
              session.id === classContextSelection.sessionId,
          )
        : undefined,
    [
      classContextSelection,
      classContextSessions,
      originalSessions,
    ],
  );

  const classContextModule = useMemo(
    () =>
      classContextSession
        ? modules.find(
            (module) =>
              module.id === classContextSession.moduleId,
          )
        : undefined,
    [classContextSession, modules],
  );

  const classContextLecturer = useMemo(
    () =>
      classContextSession
        ? lecturers.find(
            (lecturer) =>
              lecturer.id === classContextSession.lecturerId,
          )
        : undefined,
    [classContextSession, lecturers],
  );

  const classContextCohorts = useMemo(
    () =>
      classContextSession
        ? cohorts.filter((cohort) =>
            classContextSession.cohortIds.includes(cohort.id),
          )
        : [],
    [classContextSession, cohorts],
  );

  const classContextTabs = useMemo<ClassContextTab[]>(() => {
    if (!classContextSession) return [];

    const tabs: ClassContextTab[] = [];

    if (classContextSession.lecturerId) {
      tabs.push({
        type: "lecturer",
        id: classContextSession.lecturerId,
      });
    }

    classContextSession.cohortIds.forEach((cohortId) => {
      tabs.push({
        type: "cohort",
        id: cohortId,
      });
    });

    if (classContextSession.room) {
      tabs.push({
        type: "room",
        id: classContextSession.room,
      });
    }

    return tabs;
  }, [classContextSession]);

  useEffect(() => {
    if (!classContextSelection) {
      setClassContextTab(null);
      return;
    }

    setClassContextTab((current) => {
      if (
        current &&
        classContextTabs.some(
          (tab) =>
            tab.type === current.type &&
            tab.id === current.id,
        )
      ) {
        return current;
      }

      return classContextTabs[0] ?? null;
    });
  }, [classContextSelection, classContextTabs]);

  useEffect(() => {
    const lecturerId = classContextSession?.lecturerId;

    if (
      !classContextSelection ||
      !lecturerId ||
      lecturerUnavailableSlotMap[lecturerId]
    ) {
      return;
    }

    let cancelled = false;

    api
      .get<ApiLecturerUnavailability[]>(
        `/lecturers/${encodeURIComponent(lecturerId)}/unavailability`,
      )
      .then((rows) => {
        if (cancelled) return;

        const slotIds = rows.map((row) => {
          const day = row.day
            .trim()
            .slice(0, 3)
            .toLowerCase();

          const hour = String(
            row.hour,
          ).padStart(2, "0");

          return `${day}-${hour}`;
        });

        setLecturerUnavailableSlotMap(
          (current) => ({
            ...current,
            [lecturerId]: slotIds,
          }),
        );
      })
      .catch((error) => {
        console.error(
          "Failed to load lecturer unavailability:",
          error,
        );

        if (!cancelled) {
          setLecturerUnavailableSlotMap(
            (current) => ({
              ...current,
              [lecturerId]: [],
            }),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    classContextSelection,
    classContextSession?.lecturerId,
    lecturerUnavailableSlotMap,
  ]);

  function openClassContext(
    columnId: string,
    sessionId: string,
  ) {
    setClassContextSelection({
      columnId,
      sessionId,
    });
  }

  function closeClassContext() {
    setClassContextSelection(null);
    setClassContextTab(null);
  }

  /*
   * IDs on the currently selected branch, from the active state back to State 1.
   *
   * This is important for relaxation history: a relaxation made on a branch
   * that the user later abandons must remain in historical data, but it must
   * not affect or appear as active on a different branch.
   */
  const activeBranchStateIds =
    useMemo(() => {
      const ids = new Set<string>();

      let current =
        activeColumn;

      while (current) {
        ids.add(current.id);

        if (!current.parentStateId) {
          break;
        }

        current =
          repairColumns.find(
            (column) =>
              column.id ===
              current!.parentStateId,
          );
      }

      return ids;
    }, [
      activeColumn,
      repairColumns,
    ]);

  const activeRelaxationRecords =
    useMemo(
      () =>
        relaxationRecords.filter(
          (record) =>
            activeBranchStateIds.has(
              record.repairStateId,
            ),
        ),
      [
        relaxationRecords,
        activeBranchStateIds,
      ],
    );

  /* ------------------------------------------------------------------------ */
  /* Timetable events                                                         */
  /* ------------------------------------------------------------------------ */

  const events = useMemo(
    () =>
      mapSessionsToCalendarEvents(
        latestWorkingSessions,
        modules,
        lecturers,
        programs,
        cohorts,
      ),
    [
      latestWorkingSessions,
      modules,
      lecturers,
      programs,
      cohorts,
    ],
  );

  /* ------------------------------------------------------------------------ */
  /* Cumulative repair steps for display                                      */
  /* ------------------------------------------------------------------------ */

  const moves = useMemo(
    () =>
      deriveMoves(
        latestWorkingSessions,
      ),
    [
      latestWorkingSessions,
      originalSessions,
    ],
  );

  const additionalMovedSessionIds = useMemo(
    () =>
      moves
        .map((move) => move.session_id)
        .filter(
          (sessionId) =>
            sessionId !== requestedSessionId,
        ),
    [moves, requestedSessionId],
  );

  const repairMoves = useMemo(() => {
    return moves.map((move) => {
      const originalSession =
        originalSessions.find(
          (session) =>
            session.id ===
            move.session_id,
        );

      const currentSession =
        latestWorkingSessions.find(
          (session) =>
            session.id ===
            move.session_id,
        );

      const module = modules.find(
        (item) =>
          item.id ===
          currentSession?.moduleId,
      );

      return {
        sessionId:
          move.session_id,

        moduleName:
          module?.title ??
          module?.code ??
          move.session_id,

        originalStart:
          originalSession?.start ??
          move.new_start,

        newStart:
          move.new_start,
      };
    });
  }, [
    moves,
    originalSessions,
    latestWorkingSessions,
    modules,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Feasible-repair summary                                                  */
  /* ------------------------------------------------------------------------ */

  const isFeasibleRepair =
    !!activeColumn &&
    !activeColumn.editingMoveSessionId &&
    activeColumn.violations.length === 0;

  const requiredShuffleCount = additionalMovedSessionIds.length;

  /*
   * Historical welfare is intentionally calculated only for the four
   * welfare-related constraint families supported by the repair UI.
   */
  const feasibleWelfareChanges = useMemo(() => {
    const changes = new Map<
      string,
      {
        stakeholderName: string;
        impactType: HistoricalImpactType;
        beforeMinutes: number;
        addedMinutes: number;
      }
    >();

    activeRelaxationRecords.forEach((record) => {
      const config = getHistoricalImpactConfig(record.violation);

      if (!config) return;

      const datasetKey = getHistoricalImpactDatasetKey(config);
      const rows = (historicalImpactsByKey[datasetKey] ?? []) as HistoricalImpactRowLike[];

      const beforeMinutes = rows
        .filter(
          (impact) =>
            getHistoricalImpactRowStakeholderId(impact) === config.stakeholderId &&
            (!getHistoricalImpactRowType(impact) ||
              getHistoricalImpactRowType(impact) === config.impactType),
        )
        .reduce(
          (total, impact) =>
            total + getHistoricalImpactMagnitudeMinutes(impact),
          0,
        );

      const addedMinutes =
        config.impactType === "lunch-break-reduced"
          ? 60
          : record.violation.total_hours !== undefined &&
              record.violation.limit !== undefined
            ? Math.max(0, record.violation.total_hours - record.violation.limit) * 60
            : 0;

      const stakeholderName =
        config.stakeholderType === "lecturer"
          ? getLecturerName(config.stakeholderId)
          : getCohortName(config.stakeholderId);

      const key = `${config.stakeholderType}:${config.stakeholderId}:${config.impactType}`;
      const existing = changes.get(key);

      if (existing) {
        existing.addedMinutes += addedMinutes;
      } else {
        changes.set(key, {
          stakeholderName,
          impactType: config.impactType,
          beforeMinutes,
          addedMinutes,
        });
      }
    });

    return Array.from(changes.values()).map((change) => ({
      ...change,
      afterMinutes: change.beforeMinutes + change.addedMinutes,
    }));
  }, [
    activeRelaxationRecords,
    historicalImpactsByKey,
    lecturers,
    cohorts,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Initial requested-move state                                              */
  /* ------------------------------------------------------------------------ */

  const requestedInputSession =
    useMemo(
      () =>
        workingSessions.find(
          (session) =>
            session.id ===
            requestedSessionId,
        ),
      [
        workingSessions,
        requestedSessionId,
      ],
    );

  /*
   * This key changes when the parent supplies a genuinely different requested
   * placement. It is used to start a NEW repair path.
   *
   * It does NOT change when the user performs collateral moves inside this
   * component.
   */
  const requestedPlacementKey =
    requestedInputSession
      ? [
          requestedSessionId,
          requestedInputSession.start,
          requestedInputSession.end,
        ].join(":")
      : requestedSessionId;

  useEffect(() => {
    if (!requestedInputSession) {
      setRepairColumns([]);
      setRepairAttempts([]);
      setRelaxationRecords([]);
      setExpandedStateIds(
        new Set<string>(),
      );
      setActiveColumnId(null);
      return;
    }

    setRepairAttempts([]);
    setRelaxationRecords([]);
    setExpandedStateIds(
      new Set<string>(),
    );
    setActiveColumnId(null);

    let cancelled = false;

    async function createInitialState() {
      setConflictsLoading(true);
      setConflictsError(null);

      const initialMoves =
        deriveMoves(workingSessions);

      const requestedDay =
        getSessionDay(
          requestedInputSession!.start,
        );

      try {
        const result =
          await diagnoseWorkingDay({
            day: requestedDay,
            moves: initialMoves,
          });

        if (cancelled) {
          return;
        }

        /*
         * State 1 is created once as a snapshot.
         *
         * Later repair actions never rewrite this card.
         */
        const initialColumn: RepairColumn = {
          id: "initial",
          parentStateId: null,
          archived: false,
          workingSessions:
            workingSessions.map(
              (session) => ({
                ...session,
              }),
            ),
          violations:
            result.violations ?? [],
          relaxedViolations: [],
          actionLabel:
            "Requested move",
        };

        setRepairColumns([
          initialColumn,
        ]);

        setActiveColumnId(
          initialColumn.id,
        );
      } catch (error) {
        console.error(
          "Failed to diagnose requested move:",
          error,
        );

        if (!cancelled) {
          setRepairColumns([]);

          setConflictsError(
            error instanceof Error
              ? error.message
              : "Could not check conflicts",
          );
        }
      } finally {
        if (!cancelled) {
          setConflictsLoading(false);
        }
      }
    }

    createInitialState();

    return () => {
      cancelled = true;
    };
    /*
     * Deliberately reset only for a new requested placement.
     *
     * Do NOT depend on repairColumns or any later repair snapshot here.
     */
  }, [
    requestedPlacementKey,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Session helpers                                                          */
  /* ------------------------------------------------------------------------ */

  function getSession(
    sessionId: string,
  ) {
    return getSessionFromSnapshot(
      latestWorkingSessions,
      sessionId,
    );
  }

  function getSessionLabel(
    sessionId: string,
  ) {
    const session =
      getSession(sessionId);

    if (!session) {
      return sessionId;
    }

    const module =
      modules.find(
        (item) =>
          item.id ===
          session.moduleId,
      );

    if (!module) {
      return sessionId;
    }

    return module.title
      ? `${module.code} · ${module.title}`
      : module.code;
  }

  function getSessionLabelFromSnapshot(
    sessions: Session[],
    sessionId: string,
  ) {
    const session =
      sessions.find(
        (item) =>
          item.id === sessionId,
      ) ??
      originalSessions.find(
        (item) =>
          item.id === sessionId,
      );

    if (!session) {
      return sessionId;
    }

    const module =
      modules.find(
        (item) =>
          item.id === session.moduleId,
      );

    if (!module) {
      return sessionId;
    }

    return module.title
      ? `${module.code} · ${module.title}`
      : module.code;
  }

  function getSessionDurationLabel(
    sessions: Session[],
    sessionId: string,
  ) {
    const session =
      sessions.find(
        (item) =>
          item.id === sessionId,
      ) ??
      originalSessions.find(
        (item) =>
          item.id === sessionId,
      );

    if (!session) {
      return null;
    }

    const start = new Date(session.start);
    const end = new Date(session.end);
    const hours =
      (end.getTime() - start.getTime()) /
      (1000 * 60 * 60);

    if (!Number.isFinite(hours) || hours <= 0) {
      return null;
    }

    return Number.isInteger(hours)
      ? `${hours}h`
      : `${hours.toFixed(1)}h`;
  }

  function formatClassContextDateTime(
    session: Session,
  ) {
    const start = new Date(session.start);
    const end = new Date(session.end);

    const day = start.toLocaleDateString(
      "en-GB",
      {
        weekday: "long",
      },
    );

    const startTime = start.toLocaleTimeString(
      "en-GB",
      {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      },
    );

    const endTime = end.toLocaleTimeString(
      "en-GB",
      {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      },
    );

    return `${day} ${startTime}–${endTime}`;
  }

  function getLecturerName(
    lecturerId?: string,
  ) {
    if (!lecturerId) {
      return "Lecturer";
    }

    return (
      lecturers.find(
        (lecturer) =>
          lecturer.id ===
          lecturerId,
      )?.name ?? lecturerId
    );
  }

  function getCohortName(
    cohortId?: string,
  ) {
    if (!cohortId) {
      return "Cohort";
    }

    const cohort = cohorts.find(
      (item) =>
        item.id === cohortId,
    );

    if (!cohort) {
      return cohortId;
    }

    const displayCohort =
      cohort as Cohort & {
        name?: string;
        label?: string;
        code?: string;
      };

    return (
      displayCohort.name ??
      displayCohort.label ??
      displayCohort.code ??
      cohortId
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Violation formatting                                                     */
  /* ------------------------------------------------------------------------ */

  function formatViolationDay(
    day?: string,
  ) {
    if (!day) {
      return null;
    }

    const dayNames: Record<string, string> = {
      mon: "Monday",
      monday: "Monday",
      tue: "Tuesday",
      tuesday: "Tuesday",
      wed: "Wednesday",
      wednesday: "Wednesday",
      thu: "Thursday",
      thursday: "Thursday",
      fri: "Friday",
      friday: "Friday",
    };

    return (
      dayNames[
        day.toLowerCase()
      ] ?? day
    );
  }

  function formatViolation(
    violation: WorkingDayViolation,
  ) {
    const day =
      formatViolationDay(
        violation.day,
      );

    const daySuffix =
      day
        ? ` (${day})`
        : "";

    switch (violation.type) {
      case "lecturer_overlap":
        return `${getLecturerName(
          violation.lecturer_id,
        )} has overlapping classes`;

      case "room_overlap":
        return "Two classes use the same room at the same time";

      case "lecturer_unavailable": {
        const timeSuffix =
          day &&
          violation.hour !== undefined
            ? ` (${day} ${String(
                violation.hour,
              ).padStart(
                2,
                "0",
              )}:00)`
            : daySuffix;

        return `${getLecturerName(
          violation.lecturer_id,
        )} is unavailable${timeSuffix}`;
      }

      case "lecturer_daily_hours":
        return `${getLecturerName(
          violation.lecturer_id,
        )} exceeds the daily teaching limit${daySuffix}`;

      case "cohort_daily_hours":
        return `${getCohortName(
          violation.cohort_id,
        )} exceeds the daily teaching limit${daySuffix}`;

      case "lecturer_lunch_break":
        return `${getLecturerName(
          violation.lecturer_id,
        )} has no valid lunch break${daySuffix}`;

      case "cohort_lunch_break":
        return `${getCohortName(
          violation.cohort_id,
        )} has no valid lunch break${daySuffix}`;

      default:
        return violation.type;
    }
  }

  function getViolationDetail(
    violation: WorkingDayViolation,
  ) {
    if (
      violation.type ===
        "lecturer_daily_hours" ||
      violation.type ===
        "cohort_daily_hours"
    ) {
      if (
        violation.total_hours !==
          undefined &&
        violation.limit !==
          undefined
      ) {
        return (
          `${violation.total_hours} hours scheduled` +
          ` · maximum ${violation.limit} hours`
        );
      }
    }

    return null;
  }

  /* ------------------------------------------------------------------------ */
  /* Historical stakeholder impact                                            */
  /* ------------------------------------------------------------------------ */

  function getHistoricalImpactConfig(
    violation: WorkingDayViolation,
  ): HistoricalImpactConfig | null {
    switch (violation.type) {
      case "lecturer_lunch_break":
        if (!violation.lecturer_id) {
          return null;
        }

        return {
          stakeholderType: "lecturer",
          impactType: "lunch-break-reduced",
          stakeholderId:
            violation.lecturer_id,
        };

      case "cohort_lunch_break":
        if (!violation.cohort_id) {
          return null;
        }

        return {
          stakeholderType: "cohort",
          impactType: "lunch-break-reduced",
          stakeholderId:
            violation.cohort_id,
        };

      case "lecturer_daily_hours":
        if (!violation.lecturer_id) {
          return null;
        }

        return {
          stakeholderType: "lecturer",
          impactType: "consecutive-teaching",
          stakeholderId:
            violation.lecturer_id,
        };

      case "cohort_daily_hours":
        if (!violation.cohort_id) {
          return null;
        }

        return {
          stakeholderType: "cohort",
          impactType: "consecutive-teaching",
          stakeholderId:
            violation.cohort_id,
        };

      default:
        return null;
    }
  }

  function getHistoricalImpactDatasetKey(
    config: HistoricalImpactConfig,
  ) {
    return `${config.stakeholderType}:${config.impactType}`;
  }

  function getHistoricalImpactRowStakeholderId(
    impact: HistoricalImpactRowLike,
  ) {
    return (
      impact.stakeholder_id ??
      impact.stakeholderId
    );
  }

  function getHistoricalImpactRowType(
    impact: HistoricalImpactRowLike,
  ) {
    return (
      impact.impact_type ??
      impact.impactType
    );
  }

  function getHistoricalImpactMagnitudeMinutes(
    impact: HistoricalImpactRowLike,
  ) {
    return (
      impact.magnitude_minutes ??
      impact.magnitudeMinutes ??
      0
    );
  }

  function getHistoricalImpactDate(
    impact: HistoricalImpactRowLike,
  ) {
    return (
      impact.occurred_on ??
      impact.occurredOn
    );
  }

  function formatAccumulatedImpact(
    minutes: number,
    impactType: HistoricalImpactType,
  ) {
    if (
      impactType ===
      "lunch-break-reduced"
    ) {
      return `${minutes} min`;
    }

    const hours = minutes / 60;

    if (Number.isInteger(hours)) {
      return `${hours} h`;
    }

    return `${hours.toFixed(1)} h`;
  }

  /* ------------------------------------------------------------------------ */
  /* Repair-option rules                                                      */
  /* ------------------------------------------------------------------------ */

  function canResolveByMoving(
    violation: WorkingDayViolation,
  ) {
    return [
      "room_overlap",
      "lecturer_overlap",
      "lecturer_daily_hours",
      "cohort_daily_hours",
      "lecturer_lunch_break",
      "cohort_lunch_break",
    ].includes(
      violation.type,
    );
  }

  function canResolveByRelaxing(
    violation: WorkingDayViolation,
  ) {
    return [
      "lecturer_daily_hours",
      "cohort_daily_hours",
      "lecturer_lunch_break",
      "cohort_lunch_break",
      "class_capacity",
      "class_equipment",
    ].includes(
      violation.type,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Violation identity                                                       */
  /* ------------------------------------------------------------------------ */

  function getViolationKey(
    violation: WorkingDayViolation,
  ) {
    switch (violation.type) {
      case "lecturer_daily_hours":
        return [
          violation.type,
          violation.lecturer_id,
          violation.day,
        ].join(":");

      case "cohort_daily_hours":
        return [
          violation.type,
          violation.cohort_id,
          violation.day,
        ].join(":");

      case "lecturer_lunch_break":
        return [
          violation.type,
          violation.lecturer_id,
          violation.day,
        ].join(":");

      case "cohort_lunch_break":
        return [
          violation.type,
          violation.cohort_id,
          violation.day,
        ].join(":");

      case "lecturer_unavailable":
        return [
          violation.type,
          violation.lecturer_id,
          violation.day,
          violation.hour,
          ...(
            violation.session_ids ??
            []
          ),
        ].join(":");

      default:
        return [
          violation.type,
          violation.day,
          ...(
            violation.session_ids ??
            []
          ),
        ].join(":");
    }
  }

  function getColumnAncestry(
    column: RepairColumn,
  ) {
    const ancestry: RepairColumn[] = [];
    let current: RepairColumn | undefined =
      column;

    while (current) {
      ancestry.push(current);

      if (!current.parentStateId) {
        break;
      }

      current = repairColumns.find(
        (item) =>
          item.id ===
          current!.parentStateId,
      );
    }

    return ancestry.reverse();
  }

  function getViolationOriginColumn(
    column: RepairColumn,
    violation: WorkingDayViolation,
  ) {
    const violationKey =
      getViolationKey(violation);

    const ancestry =
      getColumnAncestry(column);

    return (
      ancestry.find((ancestor) =>
        [
          ...ancestor.violations,
          ...ancestor.relaxedViolations,
        ].some(
          (item) =>
            getViolationKey(item) ===
            violationKey,
        ),
      ) ?? column
    );
  }

  function getRepairStateNumber(
    column: RepairColumn,
  ) {
    return (
      repairColumns.findIndex(
        (item) =>
          item.id === column.id,
      ) + 1
    );
  }

  function getConflictGroups(
    column: RepairColumn,
    violationsToGroup: WorkingDayViolation[] =
      column.violations,
  ) {
    const groups = new Map<
      string,
      {
        originColumn: RepairColumn;
        violations: WorkingDayViolation[];
      }
    >();

    violationsToGroup.forEach(
      (violation) => {
        const originColumn =
          getViolationOriginColumn(
            column,
            violation,
          );

        const existing =
          groups.get(originColumn.id);

        if (existing) {
          existing.violations.push(
            violation,
          );
        } else {
          groups.set(
            originColumn.id,
            {
              originColumn,
              violations: [violation],
            },
          );
        }
      },
    );

    return Array.from(groups.values());
  }

  /* ------------------------------------------------------------------------ */
  /* Resolved conflicts compared with the parent state                        */
  /* ------------------------------------------------------------------------ */

  function getResolvedViolations(
    column: RepairColumn,
  ) {
    if (!column.parentStateId) {
      return [];
    }

    const parentColumn =
      repairColumns.find(
        (item) =>
          item.id ===
          column.parentStateId,
      );

    if (!parentColumn) {
      return [];
    }

    const currentViolationKeys =
      new Set(
        column.violations.map(
          getViolationKey,
        ),
      );

    const relaxedViolationKeys =
      new Set(
        column.relaxedViolations.map(
          getViolationKey,
        ),
      );

    /*
     * A violation counts as resolved only when it existed in the parent state,
     * is no longer present in this state, and was not simply removed because
     * the user relaxed the constraint.
     */
    return parentColumn.violations.filter(
      (violation) => {
        const key =
          getViolationKey(
            violation,
          );

        return (
          !currentViolationKeys.has(
            key,
          ) &&
          !relaxedViolationKeys.has(
            key,
          )
        );
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Repair exploration / dead-end logic                                      */
  /* ------------------------------------------------------------------------ */

  function getCandidatePlacements(
    session: Session,
  ) {
    const durationHours =
      (
        new Date(
          session.end,
        ).getTime() -
        new Date(
          session.start,
        ).getTime()
      ) /
      (
        1000 *
        60 *
        60
      );

    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
    ];

    const placements: {
      day: string;
      time: string;
    }[] = [];

    for (const day of days) {
      for (
        let hour = 8;
        hour + durationHours <= 17;
        hour += 1
      ) {
        placements.push({
          day,
          time:
            `${String(hour).padStart(
              2,
              "0",
            )}:00`,
        });
      }
    }

    return placements;
  }

  function hasUntriedPlacement(
    column: RepairColumn,
  ) {
    if (!column.movedSessionId) {
      return false;
    }

    const session =
      getSessionFromSnapshot(
        column.workingSessions,
        column.movedSessionId,
      );

    if (!session) {
      return false;
    }

    const candidates =
      getCandidatePlacements(
        session,
      );

    return candidates.some(
      (candidate) =>
        !repairAttempts.some(
          (attempt) =>
            attempt.sessionId ===
              column.movedSessionId &&
            attempt.day ===
              candidate.day &&
            attempt.time ===
              candidate.time,
        ),
    );
  }

  function columnHasAvailableRepairAction(
    column: RepairColumn,
  ) {
    /*
     * A state can continue only if one of its CURRENT conflicts exposes
     * an actual repair action from this state:
     *
     * - move a collateral/contributing class, or
     * - relax the violated constraint.
     *
     * Trying the class that produced this state somewhere else is
     * BACKTRACKING. It does not make this state itself non-dead.
     */
    return column.violations.some(
      (violation) => {
        const movableSessionIds =
          (
            violation.session_ids ??
            []
          ).filter(
            (sessionId) =>
              sessionId !==
              requestedSessionId,
          );

        const hasCollateralMove =
          canResolveByMoving(
            violation,
          ) &&
          movableSessionIds.length >
            0;

        const hasRelaxation =
          canResolveByRelaxing(
            violation,
          );

        return (
          hasCollateralMove ||
          hasRelaxation
        );
      },
    );
  }

  function isDeadEndColumn(
    column: RepairColumn,
  ) {
    if (
      column.editingMoveSessionId
    ) {
      return false;
    }

    if (
      column.violations.length === 0
    ) {
      return false;
    }

    /*
     * A repair state is a dead end as soon as AT LEAST ONE remaining
     * conflict has no forward repair action.
     *
     * Even if other conflicts could still be moved or relaxed, the branch
     * cannot reach a feasible timetable while an unrepairable conflict
     * remains. The user must backtrack / retry the move that created it.
     */
    return column.violations.some(
      (violation) => {
        const movableSessionIds =
          (
            violation.session_ids ??
            []
          ).filter(
            (sessionId) =>
              sessionId !==
              requestedSessionId,
          );

        const hasCollateralMove =
          canResolveByMoving(
            violation,
          ) &&
          movableSessionIds.length >
            0;

        const hasRelaxation =
          canResolveByRelaxing(
            violation,
          );

        return !(
          hasCollateralMove ||
          hasRelaxation
        );
      },
    );
  }

  function getDeadEndViolations(
    column: RepairColumn,
  ) {
    return column.violations.filter(
      (violation) => {
        const movableSessionIds =
          (
            violation.session_ids ??
            []
          ).filter(
            (sessionId) =>
              sessionId !==
              requestedSessionId,
          );

        const hasCollateralMove =
          canResolveByMoving(
            violation,
          ) &&
          movableSessionIds.length > 0;

        const hasRelaxation =
          canResolveByRelaxing(
            violation,
          );

        return !(
          hasCollateralMove ||
          hasRelaxation
        );
      },
    );
  }


  /* ------------------------------------------------------------------------ */
  /* Relax constraint in ONLY the current card                                */
  /* ------------------------------------------------------------------------ */

  function relaxViolation(
    columnId: string,
    violation: WorkingDayViolation,
  ) {
    const violationKey =
      getViolationKey(
        violation,
      );

    /*
     * Record WHEN the relaxation happened.
     *
     * The violation may have existed since an earlier state, but it is relaxed
     * only in the state where the user actually clicks the button. Previous
     * states therefore remain truthful historical snapshots.
     */
    setRelaxationRecords(
      (current) => {
        const alreadyRecorded =
          current.some(
            (record) =>
              record.repairStateId ===
                columnId &&
              getViolationKey(
                record.violation,
              ) === violationKey,
          );

        return alreadyRecorded
          ? current
          : [
              ...current,
              {
                repairStateId:
                  columnId,
                violation,
              },
            ];
      },
    );

    setRepairColumns(
      (current) =>
        current.map(
          (column) => {
            if (
              column.id !==
              columnId
            ) {
              /*
               * Previous state cards are immutable.
               */
              return column;
            }

            const alreadyRelaxed =
              column.relaxedViolations.some(
                (item) =>
                  getViolationKey(
                    item,
                  ) ===
                  violationKey,
              );

            return {
              ...column,

              /*
               * Relaxing something changes only the active state from which
               * the user made that decision. Earlier states remain untouched.
               */
              violations:
                column.violations.filter(
                  (item) =>
                    getViolationKey(
                      item,
                    ) !==
                    violationKey,
                ),

              relaxedViolations:
                alreadyRelaxed
                  ? column.relaxedViolations
                  : [
                      ...column.relaxedViolations,
                      violation,
                    ],
            };
          },
        ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Open move editor as a NEW state card                                     */
  /* ------------------------------------------------------------------------ */

  function openMoveColumn(
    sessionId: string,
  ) {
    const sourceColumn =
      repairColumns.find(
        (column) =>
          column.id === activeColumnId,
      ) ??
      (
        repairColumns.length > 0
          ? repairColumns[
              repairColumns.length - 1
            ]
          : undefined
      );

    if (!sourceColumn) {
      return;
    }

    const session =
      getSessionFromSnapshot(
        sourceColumn.workingSessions,
        sessionId,
      );

    if (!session) {
      return;
    }

    const selectedDay =
      getSessionDay(
        session.start,
      );

    const selectedTime =
      getSessionTime(
        session.start,
      );

    const newColumnId =
      `move-${sessionId}-${Date.now()}`;

    setRepairColumns(
      (current) => {
        /*
         * Preserve every diagnosed card, including dead ends.
         * Only remove an unfinished editor if one exists.
         */
        const withoutExistingEditor =
          current.filter(
            (column) =>
              !column.editingMoveSessionId,
          );

        return [
          ...withoutExistingEditor,
          {
            id:
              newColumnId,

            parentStateId:
              sourceColumn.id,

            archived: false,

            /*
             * New branch starts from the ACTIVE state's immutable snapshot.
             */
            workingSessions:
              sourceColumn.workingSessions.map(
                (item) => ({
                  ...item,
                }),
              ),

            violations: [],

            relaxedViolations:
              [
                ...sourceColumn
                  .relaxedViolations,
              ],

            actionLabel:
              `Move ${getSessionLabel(
                sessionId,
              )}`,

            movedSessionId:
              sessionId,

            editingMoveSessionId:
              sessionId,

            selectedDay,

            selectedTime,
          },
        ];
      },
    );

    setActiveColumnId(
      newColumnId,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Re-open the CURRENT state for another placement                          */
  /* ------------------------------------------------------------------------ */

  function reopenCurrentMoveEditor(
    columnId: string,
    sessionId: string,
  ) {
    setRepairColumns(
      (current) =>
        current.map(
          (column) => {
            if (
              column.id !==
              columnId
            ) {
              return column;
            }

            const session =
              getSessionFromSnapshot(
                column.workingSessions,
                sessionId,
              );

            if (!session) {
              return column;
            }

            return {
              ...column,

              retryingCurrentPlacement:
                true,

              editingMoveSessionId:
                sessionId,

              selectedDay:
                getSessionDay(
                  session.start,
                ),

              selectedTime:
                getSessionTime(
                  session.start,
                ),
            };
          },
        ),
    );

    setActiveColumnId(
      columnId,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Update ONLY the current move editor                                      */
  /* ------------------------------------------------------------------------ */

  function updateMoveColumn(
    columnId: string,
    changes: Partial<RepairColumn>,
  ) {
    setRepairColumns(
      (current) =>
        current.map(
          (column) =>
            column.id ===
            columnId
              ? {
                  ...column,
                  ...changes,
                }
              : column,
        ),
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Cancel ONLY the unfinished editor                                        */
  /* ------------------------------------------------------------------------ */

  function cancelMoveColumn(
    columnId: string,
  ) {
    const column =
      repairColumns.find(
        (item) =>
          item.id ===
          columnId,
      );

    if (
      column?.retryingCurrentPlacement
    ) {
      setRepairColumns(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              columnId
                ? {
                    ...item,
                    retryingCurrentPlacement:
                      false,
                    editingMoveSessionId:
                      undefined,
                    selectedDay:
                      undefined,
                    selectedTime:
                      undefined,
                  }
                : item,
          ),
      );

      return;
    }

    setRepairColumns(
      (current) => {
        const currentColumn =
          current.find(
            (item) =>
              item.id ===
              columnId,
          );

        const parentColumn =
          currentColumn?.parentStateId
            ? current.find(
                (item) =>
                  item.id ===
                  currentColumn.parentStateId,
              )
            : undefined;

        if (
          activeColumnId ===
          columnId
        ) {
          setActiveColumnId(
            parentColumn?.id ??
              null,
          );
        }

        return current.filter(
          (item) =>
            item.id !==
            columnId,
        );
      },
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Try hypothetical collateral move                                         */
  /* ------------------------------------------------------------------------ */

  async function tryMove(
    column: RepairColumn,
  ) {
    if (
      !column.editingMoveSessionId ||
      !column.selectedDay ||
      !column.selectedTime
    ) {
      return;
    }

    /*
     * Brand-new state:
     * work from this card's snapshot.
     *
     * Retry of the SAME state:
     * start again from the parent state's snapshot so the old attempted
     * placement is replaced rather than compounded.
     */
    const parentColumn =
      column.parentStateId
        ? repairColumns.find(
            (item) =>
              item.id ===
              column.parentStateId,
          )
        : undefined;

    const sourceSessions =
      column.retryingCurrentPlacement &&
      parentColumn
        ? parentColumn.workingSessions
        : column.workingSessions;

    const session =
      getSessionFromSnapshot(
        sourceSessions,
        column.editingMoveSessionId,
      );

    if (!session) {
      return;
    }

    const currentStart =
      new Date(session.start);

    const currentEnd =
      new Date(session.end);

    const durationMs =
      currentEnd.getTime() -
      currentStart.getTime();

    const dayIndexes: Record<string, number> = {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
    };

    const targetDayIndex =
      dayIndexes[
        column.selectedDay
      ];

    if (
      targetDayIndex ===
      undefined
    ) {
      return;
    }

    const targetStart =
      new Date(currentStart);

    targetStart.setDate(
      currentStart.getDate() +
        (
          targetDayIndex -
          currentStart.getDay()
        ),
    );

    const [hour, minute] =
      column.selectedTime
        .split(":")
        .map(Number);

    targetStart.setHours(
      hour,
      minute,
      0,
      0,
    );

    const targetEnd =
      new Date(
        targetStart.getTime() +
          durationMs,
      );

    const newStart =
      formatTimetableDateTime(
        targetStart,
      );

    const newEnd =
      formatTimetableDateTime(
        targetEnd,
      );

    /*
     * Create a NEW snapshot for State N.
     *
     * No previous card is modified.
     */
    const updatedSessions =
      sourceSessions.map(
        (item) =>
          item.id ===
          session.id
            ? {
                ...item,
                start: newStart,
                end: newEnd,
              }
            : {
                ...item,
              },
      );

    const updatedMoves =
      deriveMoves(
        updatedSessions,
      );

    /*
     * Diagnose every day touched by the complete accumulated move set.
     */
    const affectedDays =
      Array.from(
        new Set(
          updatedMoves.flatMap(
            (move) => {
              const originalSession =
                originalSessions.find(
                  (item) =>
                    item.id ===
                    move.session_id,
                );

              const days: string[] = [
                getSessionDay(
                  move.new_start,
                ),
              ];

              if (originalSession) {
                days.push(
                  getSessionDay(
                    originalSession.start,
                  ),
                );
              }

              return days;
            },
          ),
        ),
      );

    setConflictsLoading(true);
    setConflictsError(null);

    try {
      const results =
        await Promise.all(
          affectedDays.map(
            (day) =>
              diagnoseWorkingDay({
                day,
                moves:
                  updatedMoves,
              }),
          ),
        );

      const combinedViolations =
        results.flatMap(
          (result) =>
            result.violations ?? [],
        );

      const uniqueViolations =
        Array.from(
          new Map(
            combinedViolations.map(
              (violation) => [
                getViolationKey(
                  violation,
                ),
                violation,
              ],
            ),
          ).values(),
        );

      const relaxedKeys =
        new Set(
          column.relaxedViolations.map(
            getViolationKey,
          ),
        );

      const unresolvedViolations =
        uniqueViolations.filter(
          (violation) =>
            !relaxedKeys.has(
              getViolationKey(
                violation,
              ),
            ),
        );

      setRepairAttempts(
        (current) => {
          const attempted: RepairAttempt = {
            sessionId:
              session.id,
            day:
              column.selectedDay!,
            time:
              column.selectedTime!,
          };

          const alreadyRecorded =
            current.some(
              (item) =>
                item.sessionId ===
                  attempted.sessionId &&
                item.day ===
                  attempted.day &&
                item.time ===
                  attempted.time,
            );

          return alreadyRecorded
            ? current
            : [
                ...current,
                attempted,
              ];
        },
      );

      setRepairColumns(
        (columns) =>
          columns.map(
            (item) => {
              if (
                item.id !==
                column.id
              ) {
                /*
                 * This is the key rule:
                 * ALL previous cards are returned exactly as they were.
                 */
                return item;
              }

              /*
               * Only the editor card becomes the diagnosed result.
               */
              return {
                ...item,

                workingSessions:
                  updatedSessions,

                movedSessionId:
                  session.id,

                attemptedDay:
                  column.selectedDay,

                attemptedTime:
                  column.selectedTime,

                editingMoveSessionId:
                  undefined,

                selectedDay:
                  undefined,

                selectedTime:
                  undefined,

                retryingCurrentPlacement:
                  false,

                actionLabel:
                  `Moved ${getSessionLabel(
                    session.id,
                  )}: ${formatMoveDate(
                    session.start,
                  )} → ${formatMoveDate(
                    newStart,
                  )}`,

                violations:
                  unresolvedViolations,
              };
            },
          ),
      );

      setActiveColumnId(
        column.id,
      );
    } catch (error) {
      console.error(
        "Failed to diagnose repair move:",
        error,
      );

      setConflictsError(
        error instanceof Error
          ? error.message
          : "Could not check repair move",
      );
    } finally {
      setConflictsLoading(false);
    }
  }

  const activePathColumns =
    repairColumns.filter(
      (column) =>
        !column.archived,
    );

  const failedPathColumns =
    repairColumns.filter(
      (column) =>
        column.archived &&
        isDeadEndColumn(column),
    );

  function archiveStateAndReturn(
    column: RepairColumn,
  ) {
    if (!column.parentStateId) {
      return;
    }

    const parentColumn =
      repairColumns.find(
        (item) =>
          item.id ===
          column.parentStateId,
      );

    if (!parentColumn) {
      return;
    }

    setRepairColumns(
      (current) => {
        const archivedStateIds =
          new Set<string>([column.id]);

        let foundDescendant = true;

        while (foundDescendant) {
          foundDescendant = false;

          current.forEach((item) => {
            if (
              item.parentStateId &&
              archivedStateIds.has(item.parentStateId) &&
              !archivedStateIds.has(item.id)
            ) {
              archivedStateIds.add(item.id);
              foundDescendant = true;
            }
          });
        }

        return current.map((item) =>
          archivedStateIds.has(item.id)
            ? { ...item, archived: true }
            : item,
        );
      },
    );

    setActiveColumnId(parentColumn.id);
  }

  /* ------------------------------------------------------------------------ */
  /* Active timetable repair highlighting                                    */
  /* ------------------------------------------------------------------------ */

  /*
   * Opening a move editor is only a proposal step. Until "Try this move"
   * is submitted and diagnosed, keep timetable highlighting based on the
   * parent diagnosed state so unresolved conflicts do not appear solved.
   */
  const highlightingColumn =
    activeColumn?.editingMoveSessionId &&
    activeColumn.parentStateId
      ? repairColumns.find(
          (column) =>
            column.id ===
            activeColumn.parentStateId,
        ) ?? activeColumn
      : activeColumn;

  /*
   * Timetable colour semantics:
   *
   * - blue     = not currently involved in an unresolved conflict
   * - green    = moved and no longer involved in any unresolved conflict
   * - red      = involved in at least one CURRENT unresolved conflict
   * - dark red = the move that produced a dead-end state
   *
   * The red set is derived from every session_id referenced by the current
   * unresolved violations. This means a previously moved class stays red
   * while it is still contributing to an unresolved conflict.
   */
  const unresolvedConflictSessionIds =
    useMemo(() => {
      const ids = new Set<string>();

      (
        highlightingColumn?.violations ??
        []
      ).forEach(
        (violation) => {
          (
            violation.session_ids ??
            []
          ).forEach(
            (sessionId) => {
              ids.add(sessionId);
            },
          );
        },
      );

      return ids;
    }, [
      highlightingColumn,
    ]);

  const repairDeadEndSessionId =
    highlightingColumn &&
    isDeadEndColumn(highlightingColumn)
      ? highlightingColumn.movedSessionId ??
        requestedSessionId
      : null;

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="interactive-repair">
      {/* Header */}

      <div className="interactive-repair-header">
        <div>
          <h2>
            Interactive repair
          </h2>

          <p>
            Resolve the remaining
            conflicts one decision at
            a time.
          </p>
        </div>
      </div>

      {/* Repair steps */}

      {!isFeasibleRepair &&
        repairMoves.length >
        0 && (
        <div className="interactive-repair-moves">
          <div className="interactive-repair-moves-title">
            Repair steps
          </div>

          {repairMoves.map(
            (
              move,
              index,
            ) => (
              <div
                key={
                  move.sessionId
                }
                className="interactive-repair-move"
              >
                <div className="interactive-repair-move-number">
                  {index + 1}
                </div>

                <div>
                  <div className="interactive-repair-move-title">
                    {
                      move.moduleName
                    }
                  </div>

                  <div className="interactive-repair-move-details">
                    {formatMoveDate(
                      move.originalStart,
                    )}

                    {" → "}

                    {formatMoveDate(
                      move.newStart,
                    )}
                  </div>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {/* Relaxation history on the active repair branch */}

      {!isFeasibleRepair &&
        activeRelaxationRecords.length >
        0 && (
        <div
          className="interactive-repair-relaxation-history"
          style={{
            marginTop: "10px",
            marginBottom: "18px",
            padding: "12px",
            border:
              "1px solid #fed7aa",
            borderRadius: "8px",
            background:
              "#fff7ed",
          }}
        >
          <div
            className="interactive-repair-moves-title"
            style={{
              marginBottom: "8px",
            }}
          >
            Relaxed constraints
          </div>

          {activeRelaxationRecords.map(
            (
              record,
              index,
            ) => {
              const repairStateNumber =
                repairColumns.findIndex(
                  (column) =>
                    column.id ===
                    record.repairStateId,
                ) + 1;

              return (
                <div
                  key={`${record.repairStateId}-${getViolationKey(
                    record.violation,
                  )}`}
                  className="interactive-repair-move"
                  style={{
                    marginTop:
                      index === 0
                        ? 0
                        : "8px",
                  }}
                >
                  <div className="interactive-repair-move-number">
                    {index + 1}
                  </div>

                  <div>
                    <div className="interactive-repair-move-title">
                      {formatViolation(
                        record.violation,
                      )}
                    </div>

                    <div className="interactive-repair-move-details">
                      Relaxed in Repair
                      state{" "}
                      {repairStateNumber}
                    </div>
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}

      {/* Loading / error */}

      {conflictsLoading && (
        <div className="interactive-repair-conflicts-loading">
          Checking timetable…
        </div>
      )}

      {!conflictsLoading &&
        conflictsError && (
          <div className="interactive-repair-conflicts-error">
            {conflictsError}
          </div>
        )}

      {/* Repair path */}

      {!conflictsLoading &&
        !conflictsError && (
          <div
            className="interactive-repair-path"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              width: "100%",
            }}
          >
            {activePathColumns.map(
              (
                column,
              ) => {
                const columnIndex =
                  repairColumns.findIndex(
                    (item) =>
                      item.id ===
                      column.id,
                  );
                const isActive =
                  column.id ===
                  activeColumn?.id;

                /*
                 * The active repair state is always open.
                 * Earlier states are folded unless the user explicitly
                 * opens them for reference.
                 */
                const isExpanded =
                  isActive ||
                  expandedStateIds.has(
                    column.id,
                  );

                const movingSession =
                  column.editingMoveSessionId
                    ? getSessionFromSnapshot(
                        column.workingSessions,
                        column.editingMoveSessionId,
                      )
                    : undefined;

                const isDeadEnd =
                  isDeadEndColumn(
                    column,
                  );

                const displayedViolations =
                  isDeadEnd
                    ? getDeadEndViolations(
                        column,
                      )
                    : column.violations;

                const canRetryMovedClass =
                  !column.editingMoveSessionId &&
                  column.violations.length >
                    0 &&
                  !!column.movedSessionId &&
                  hasUntriedPlacement(
                    column,
                  );

                const resolvedViolations =
                  getResolvedViolations(
                    column,
                  );

                const conflictGroups =
                  getConflictGroups(
                    column,
                    displayedViolations,
                  );

                const parentColumn =
                  column.parentStateId
                    ? repairColumns.find(
                        (item) =>
                          item.id ===
                          column.parentStateId,
                      )
                    : undefined;

                const parentViolationKeys =
                  new Set(
                    parentColumn?.violations.map(
                      getViolationKey,
                    ) ?? [],
                  );

                const createdViolations =
                  column.parentStateId
                    ? column.violations.filter(
                        (violation) =>
                          !parentViolationKeys.has(
                            getViolationKey(
                              violation,
                            ),
                          ),
                      )
                    : [];

                return (
                  <div
                    key={
                      column.id
                    }
                    className={`interactive-repair-column ${
                      isDeadEnd
                        ? "interactive-repair-column--dead-end"
                        : !isActive
                          ? "interactive-repair-column--inactive"
                          : ""
                    }`}
                    style={{
                      width: "100%",
                      maxWidth: "none",
                      minWidth: 0,
                      boxSizing: "border-box",

                      /*
                       * The CSS for repair columns gives cards room for their
                       * normal expanded content. When a previous state is
                       * folded, explicitly remove that sizing so only the
                       * compact header remains.
                       */
                      minHeight: isExpanded
                        ? undefined
                        : 0,
                      height: isExpanded
                        ? undefined
                        : "auto",
                      flex: isExpanded
                        ? undefined
                        : "0 0 auto",

                      ...(isDeadEnd
                        ? {
                            border:
                              "2px solid #dc2626",
                            background:
                              "#fff1f2",
                            boxShadow:
                              "0 0 0 1px rgba(220, 38, 38, 0.08)",
                          }
                        : {}),
                    }}
                  >
                    {/* Column header */}

                    <div
                      className="interactive-repair-column-header"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "16px",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="interactive-repair-column-step">
                          Repair state{" "}
                          {columnIndex +
                            1}
                        </div>

                        {column.actionLabel && (
                          <div className="interactive-repair-column-action">
                            {
                              column.actionLabel
                            }
                          </div>
                        )}

                        {!column.editingMoveSessionId && (
                          <div className="interactive-repair-column-count">
                            {isDeadEnd ? (
                              <>
                                {displayedViolations.length}{" "}
                                blocking{" "}
                                {displayedViolations.length === 1
                                  ? "conflict"
                                  : "conflicts"}
                              </>
                            ) : (
                              <>
                                {column.violations.length}{" "}
                                {column.violations.length === 1
                                  ? "conflict"
                                  : "conflicts"}{" "}
                                remaining
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          flexShrink: 0,
                        }}
                      >
                        {!isActive &&
                          !column.editingMoveSessionId && (
                            <button
                              type="button"
                              onClick={() =>
                                toggleStateDetails(
                                  column.id,
                                )
                              }
                              aria-expanded={
                                isExpanded
                              }
                              style={{
                                padding: "2px 0",
                                border: "none",
                                background:
                                  "transparent",
                                color: "#64748b",
                                fontWeight: 600,
                                fontSize: "13px",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {isExpanded
                                ? "Hide details ▲"
                                : "Show details ▼"}
                            </button>
                          )}

                        {isActive &&
                          column.parentStateId &&
                          !column.editingMoveSessionId && (
                            <button
                              type="button"
                              onClick={() =>
                                archiveStateAndReturn(
                                  column,
                                )
                              }
                              style={{
                                padding: "2px 0",
                                border: "none",
                                background:
                                  "transparent",
                                color: "#475569",
                                fontWeight: 600,
                                fontSize: "13px",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              ← Back to State{" "}
                              {repairColumns.findIndex(
                                (item) =>
                                  item.id ===
                                  column.parentStateId,
                              ) + 1}
                            </button>
                          )}
                      </div>
                    </div>

                    {isExpanded && (
                      <>
                        {isDeadEnd && (
                      <div
                        style={{
                          marginTop: "12px",
                          marginBottom: "12px",
                          padding: "10px 12px",
                          border: "1px solid #fecaca",
                          borderRadius: "8px",
                          background: "#fef2f2",
                        }}
                      >
                        <strong>
                          Dead end
                        </strong>

                        <div>
                          At least one remaining conflict has no repair action from
                          this state, so this branch cannot reach a feasible timetable.
                          Try a different earlier decision.
                        </div>
                      </div>
                    )}

                    {/* ---------------------------------------------------- */}
                    {/* Move editor                                          */}
                    {/* ---------------------------------------------------- */}

                    {column.editingMoveSessionId &&
                      movingSession && (
                        <div className="interactive-repair-move-editor">
                          <div className="interactive-repair-column-section-title">
                            Choose new placement
                          </div>

                          <div className="interactive-repair-move-editor-session">
                            {getSessionLabel(
                              column.editingMoveSessionId,
                            )}
                          </div>

                          <div className="interactive-repair-move-editor-current">
                            <strong>
                              Current placement
                            </strong>

                            <div>
                              {formatMoveDate(
                                movingSession.start,
                              )}
                            </div>
                          </div>

                          <label className="interactive-repair-move-editor-field">
                            <span>
                              Day
                            </span>

                            <select
                              value={
                                column.selectedDay ??
                                "monday"
                              }
                              onChange={(
                                event,
                              ) =>
                                updateMoveColumn(
                                  column.id,
                                  {
                                    selectedDay:
                                      event
                                        .target
                                        .value,
                                  },
                                )
                              }
                            >
                              <option value="monday">
                                Monday
                              </option>

                              <option value="tuesday">
                                Tuesday
                              </option>

                              <option value="wednesday">
                                Wednesday
                              </option>

                              <option value="thursday">
                                Thursday
                              </option>

                              <option value="friday">
                                Friday
                              </option>
                            </select>
                          </label>

                          <label className="interactive-repair-move-editor-field">
                            <span>
                              Start time
                            </span>

                            <select
                              value={
                                column.selectedTime ??
                                "09:00"
                              }
                              onChange={(
                                event,
                              ) =>
                                updateMoveColumn(
                                  column.id,
                                  {
                                    selectedTime:
                                      event
                                        .target
                                        .value,
                                  },
                                )
                              }
                            >
                              <option value="08:00">
                                08:00
                              </option>

                              <option value="09:00">
                                09:00
                              </option>

                              <option value="10:00">
                                10:00
                              </option>

                              <option value="11:00">
                                11:00
                              </option>

                              <option value="12:00">
                                12:00
                              </option>

                              <option value="13:00">
                                13:00
                              </option>

                              <option value="14:00">
                                14:00
                              </option>

                              <option value="15:00">
                                15:00
                              </option>

                              <option value="16:00">
                                16:00
                              </option>
                            </select>
                          </label>

                          <div className="interactive-repair-move-editor-proposed">
                            <strong>
                              Proposed placement
                            </strong>

                            <div>
                              {column.selectedDay
                                ? column.selectedDay
                                    .charAt(
                                      0,
                                    )
                                    .toUpperCase() +
                                  column.selectedDay.slice(
                                    1,
                                  )
                                : "Monday"}{" "}
                              {column.selectedTime ??
                                "09:00"}
                            </div>
                          </div>

                          <div className="interactive-repair-move-editor-actions">
                            <button
                              type="button"
                              className="interactive-repair-action"
                              onClick={() =>
                                cancelMoveColumn(
                                  column.id,
                                )
                              }
                            >
                              Cancel
                            </button>

                            <button
                              type="button"
                              className="primary-button"
                              onClick={() =>
                                tryMove(column)
                              }
                            >
                              Try this move
                            </button>
                          </div>
                        </div>
                      )}

                    {/* ---------------------------------------------------- */}
                    {/* Diagnosed repair state                               */}
                    {/* ---------------------------------------------------- */}

                    {!column.editingMoveSessionId && (
                      <>
                        {/* Action impact */}

                        {column.parentStateId && (
                          <div
                            className="interactive-repair-move-impact"
                            style={{
                              marginBottom: "16px",
                              padding: "12px",
                              border: "1px solid #dbe3ef",
                              borderRadius: "8px",
                              background: "#f8fafc",
                            }}
                          >
                            <div className="interactive-repair-column-section-title">
                              This action
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gap: "10px",
                                marginTop: "9px",
                                fontSize: "12px",
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    color: "#166534",
                                    fontWeight: 600,
                                  }}
                                >
                                  ✓ Resolved{" "}
                                  <strong>
                                    {resolvedViolations.length}
                                  </strong>
                                </div>

                                {resolvedViolations.length === 0 ? (
                                  <div
                                    style={{
                                      marginTop: "4px",
                                      marginLeft: "18px",
                                      color: "#64748b",
                                    }}
                                  >
                                    No previous conflicts resolved.
                                  </div>
                                ) : (
                                  resolvedViolations.map(
                                    (violation) => (
                                      <div
                                        key={`impact-resolved-${column.id}-${getViolationKey(
                                          violation,
                                        )}`}
                                        style={{
                                          marginTop: "4px",
                                          marginLeft: "18px",
                                          color: "#166534",
                                        }}
                                      >
                                        {formatViolation(
                                          violation,
                                        )}
                                      </div>
                                    ),
                                  )
                                )}
                              </div>

                              <div>
                                <div
                                  style={{
                                    color: "#b91c1c",
                                    fontWeight: 600,
                                  }}
                                >
                                  ✕ Created{" "}
                                  <strong>
                                    {createdViolations.length}
                                  </strong>
                                </div>

                                {createdViolations.length === 0 ? (
                                  <div
                                    style={{
                                      marginTop: "4px",
                                      marginLeft: "18px",
                                      color: "#64748b",
                                    }}
                                  >
                                    No new conflicts created.
                                  </div>
                                ) : (
                                  createdViolations.map(
                                    (violation) => (
                                      <div
                                        key={`impact-created-${column.id}-${getViolationKey(
                                          violation,
                                        )}`}
                                        style={{
                                          marginTop: "4px",
                                          marginLeft: "18px",
                                          color: "#b91c1c",
                                        }}
                                      >
                                        {formatViolation(
                                          violation,
                                        )}
                                      </div>
                                    ),
                                  )
                                )}
                              </div>

                              {isActive &&
                                canRetryMovedClass &&
                                column.movedSessionId && (
                                <div
                                  style={{
                                    paddingTop: "8px",
                                    borderTop: "1px solid #e2e8f0",
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="interactive-repair-action"
                                    onClick={() =>
                                      reopenCurrentMoveEditor(
                                        column.id,
                                        column.movedSessionId!,
                                      )
                                    }
                                  >
                                    Try a different placement for{" "}
                                    {getSessionLabel(
                                      column.movedSessionId,
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Relaxed constraints */}

                        {!(isActive && isFeasibleRepair) &&
                          column
                            .relaxedViolations
                            .length >
                            0 && (
                          <div className="interactive-repair-column-relaxed">
                            <div className="interactive-repair-column-section-title">
                              Relaxed
                              constraints
                            </div>

                            {column.relaxedViolations.map(
                              (
                                violation,
                              ) => (
                                <div
                                  key={getViolationKey(
                                    violation,
                                  )}
                                  className="interactive-repair-column-relaxed-item"
                                >
                                  <span>
                                    ✓
                                  </span>

                                  <span>
                                    {formatViolation(
                                      violation,
                                    )}
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                        )}

                        {/* Terminal feasible summary / remaining conflicts */}

                        {isActive && isFeasibleRepair ? (
                          <div
                            style={{
                              marginTop: "4px",
                              padding: "14px",
                              border: "1px solid #bbf7d0",
                              borderRadius: "8px",
                              background: "#f0fdf4",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: "16px",
                                marginBottom: "12px",
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 800,
                                    letterSpacing: "0.06em",
                                    textTransform: "uppercase",
                                    color: "#166534",
                                  }}
                                >
                                  Feasible repair found
                                </div>
                                <div
                                  style={{
                                    marginTop: "2px",
                                    fontSize: "12px",
                                    color: "#475569",
                                  }}
                                >
                                  All conflicts are resolved. Review the repair before saving.
                                </div>
                              </div>

                              <div
                                style={{
                                  flexShrink: 0,
                                  padding: "6px 9px",
                                  border: "1px solid #bbf7d0",
                                  borderRadius: "6px",
                                  background: "#ffffff",
                                  fontSize: "11px",
                                  color: "#166534",
                                  fontWeight: 700,
                                }}
                              >
                                ✓ Feasible
                              </div>
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                                gap: "8px",
                              }}
                            >
                              <div style={{ padding: "10px", border: "1px solid #dcfce7", borderRadius: "7px", background: "#ffffff" }}>
                                <div className="interactive-repair-column-section-title">Classes moved ({repairMoves.length})</div>
                                <div style={{ marginTop: "6px", display: "grid", gap: "5px" }}>
                                  {repairMoves.map((move) => (
                                    <div key={`summary-move-${move.sessionId}`} style={{ fontSize: "11px", lineHeight: 1.35 }}>
                                      <strong>{move.moduleName}</strong>
                                      <div style={{ color: "#64748b" }}>
                                        {formatMoveDate(move.originalStart)} → {formatMoveDate(move.newStart)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div style={{ padding: "10px", border: "1px solid #dcfce7", borderRadius: "7px", background: "#ffffff" }}>
                                <div className="interactive-repair-column-section-title">Shuffle requirement</div>
                                <div style={{ marginTop: "6px", fontSize: "11px", lineHeight: 1.45 }}>
                                  <div>Originally allowed <strong>{shuffleCredit}</strong></div>
                                  <div>Required <strong>{requiredShuffleCount}</strong></div>
                                  <div style={{ marginTop: "3px", color: requiredShuffleCount > shuffleCredit ? "#b45309" : "#166534", fontWeight: 700 }}>
                                    {requiredShuffleCount > shuffleCredit
                                      ? `${requiredShuffleCount - shuffleCredit} more shuffle${requiredShuffleCount - shuffleCredit === 1 ? "" : "s"} needed`
                                      : "Within the original shuffle allowance"}
                                  </div>
                                </div>
                              </div>

                              <div style={{ padding: "10px", border: "1px solid #dcfce7", borderRadius: "7px", background: "#ffffff" }}>
                                <div className="interactive-repair-column-section-title">Relaxed constraints ({activeRelaxationRecords.length})</div>
                                <div style={{ marginTop: "6px", display: "grid", gap: "4px", fontSize: "11px" }}>
                                  {activeRelaxationRecords.length > 0 ?
                                    activeRelaxationRecords.map((record) => (
                                      <div key={`summary-relax-${record.repairStateId}-${getViolationKey(record.violation)}`}>
                                        • {formatViolation(record.violation)}
                                      </div>
                                    )) :
                                    <div style={{ color: "#64748b" }}>None</div>}
                                </div>
                              </div>

                              <div style={{ padding: "10px", border: "1px solid #dcfce7", borderRadius: "7px", background: "#ffffff" }}>
                                <div className="interactive-repair-column-section-title">Welfare impact ({feasibleWelfareChanges.length})</div>
                                <div style={{ marginTop: "6px", display: "grid", gap: "5px", fontSize: "11px" }}>
                                  {feasibleWelfareChanges.length > 0 ?
                                    feasibleWelfareChanges.map((change) => (
                                      <div key={`summary-welfare-${change.stakeholderName}-${change.impactType}`}>
                                        <strong>{change.stakeholderName}</strong>
                                        <div style={{ color: "#64748b" }}>
                                          {change.impactType === "lunch-break-reduced" ? "Lunch-break loss" : "Excess teaching"}: {formatAccumulatedImpact(change.beforeMinutes, change.impactType)} → <strong style={{ color: "#334155" }}>{formatAccumulatedImpact(change.afterMinutes, change.impactType)}</strong>
                                        </div>
                                      </div>
                                    )) :
                                    <div style={{ color: "#64748b" }}>No recorded welfare change</div>}
                                </div>
                              </div>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "10px",
                                marginTop: "12px",
                                paddingTop: "10px",
                                borderTop: "1px solid #dcfce7",
                              }}
                            >
                              <button
                                type="button"
                                className="interactive-repair-action"
                                onClick={onCloseWithoutSaving}
                                disabled={!onCloseWithoutSaving}
                                title={!onCloseWithoutSaving ? "Connect onCloseWithoutSaving to the modal close action" : undefined}
                              >
                                Close without saving
                              </button>

                              <button
                                type="button"
                                className="interactive-repair-action"
                                onClick={() => onSaveRepair?.(latestWorkingSessions)}
                                disabled={!onSaveRepair}
                                title={!onSaveRepair ? "Connect onSaveRepair to persist this timetable" : undefined}
                                style={{
                                  background: onSaveRepair ? "#166534" : undefined,
                                  borderColor: onSaveRepair ? "#166534" : undefined,
                                  color: onSaveRepair ? "#ffffff" : undefined,
                                }}
                              >
                                Save this repair
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="interactive-repair-column-section-title">
                              {isDeadEnd
                                ? "Blocking conflicts"
                                : "Still to resolve"}{" "}
                              {displayedViolations.length > 0 && (
                                <span>({displayedViolations.length})</span>
                              )}
                            </div>

                            {displayedViolations.length === 0 ? (
                              <div className="interactive-repair-no-conflicts">
                                No conflicts detected.
                              </div>
                            ) : (
                          <div
                            className="interactive-repair-conflict-list"
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "14px",
                            }}
                          >
                            {conflictGroups.map(
                              ({
                                originColumn,
                                violations,
                              }) => (
                                <div
                                  key={`origin-${originColumn.id}`}
                                  style={{
                                    width: "100%",
                                    minWidth: 0,
                                  }}
                                >
                                  <div
                                    className="interactive-repair-conflict-section-title"
                                    style={{
                                      marginBottom:
                                        "7px",
                                    }}
                                  >
                                    From Repair state{" "}
                                    {getRepairStateNumber(
                                      originColumn,
                                    )}
                                  </div>

                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns:
                                        "repeat(auto-fit, minmax(280px, 1fr))",
                                      gap: "12px",
                                      alignItems: "stretch",
                                    }}
                                  >
                                    {violations.map(
                                      (
                                        violation,
                                        index,
                                      ) => {
                                const detail =
                                  getViolationDetail(
                                    violation,
                                  );

                                const sessionIds =
                                  violation.session_ids ??
                                  [];

                                /*
                                 * Requested class remains visible as
                                 * a contributor, but cannot be chosen
                                 * as a collateral move.
                                 */
                                const movableSessionIds =
                                  sessionIds.filter(
                                    (
                                      sessionId,
                                    ) =>
                                      sessionId !==
                                      requestedSessionId,
                                  );

                                const canMove =
                                  canResolveByMoving(
                                    violation,
                                  ) &&
                                  movableSessionIds.length >
                                    0;

                                const canRelax =
                                  canResolveByRelaxing(
                                    violation,
                                  );

                                const hasRepairAction =
                                  canMove ||
                                  canRelax;

                                const historicalConfig =
                                  getHistoricalImpactConfig(
                                    violation,
                                  );

                                const historicalDatasetKey =
                                  historicalConfig
                                    ? getHistoricalImpactDatasetKey(
                                        historicalConfig,
                                      )
                                    : null;

                                const historicalRows =
                                  historicalDatasetKey
                                    ? (
                                        historicalImpactsByKey[
                                          historicalDatasetKey
                                        ] ?? []
                                      ) as HistoricalImpactRowLike[]
                                    : [];

                                const stakeholderHistoricalRows =
                                  historicalConfig
                                    ? historicalRows.filter(
                                        (impact) =>
                                          getHistoricalImpactRowStakeholderId(
                                            impact,
                                          ) ===
                                            historicalConfig.stakeholderId &&
                                          (
                                            !getHistoricalImpactRowType(
                                              impact,
                                            ) ||
                                            getHistoricalImpactRowType(
                                              impact,
                                            ) ===
                                              historicalConfig.impactType
                                          ),
                                      )
                                    : [];

                                const accumulatedImpactMinutes =
                                  stakeholderHistoricalRows.reduce(
                                    (
                                      total,
                                      impact,
                                    ) =>
                                      total +
                                      getHistoricalImpactMagnitudeMinutes(
                                        impact,
                                      ),
                                    0,
                                  );

                                const historicalPopoverKey =
                                  historicalConfig
                                    ? `${column.id}:${getViolationKey(
                                        violation,
                                      )}:historical-impact`
                                    : null;

                                const stakeholderName =
                                  historicalConfig
                                    ? historicalConfig.stakeholderType ===
                                      "lecturer"
                                      ? getLecturerName(
                                          historicalConfig.stakeholderId,
                                        )
                                      : getCohortName(
                                          historicalConfig.stakeholderId,
                                        )
                                    : "";

                                const mostRecentHistoricalDate =
                                  stakeholderHistoricalRows
                                    .map(
                                      getHistoricalImpactDate,
                                    )
                                    .filter(
                                      (
                                        value,
                                      ): value is string =>
                                        !!value,
                                    )
                                    .sort()
                                    .at(-1);

                                return (
                                  <div
                                    key={getViolationKey(
                                      violation,
                                    )}
                                    className={`interactive-repair-conflict ${
                                      !hasRepairAction
                                        ? "interactive-repair-conflict--blocked"
                                        : ""
                                    }`}
                                    style={
                                      !hasRepairAction
                                        ? {
                                            border:
                                              "1px solid #fecaca",
                                            background:
                                              "#fff1f2",
                                          }
                                        : undefined
                                    }
                                  >
                                    {/* Conflict heading */}

                                    <div className="interactive-repair-conflict-header">
                                      <div className="interactive-repair-conflict-index">
                                        {index +
                                          1}
                                      </div>

                                      <div>
                                        <div className="interactive-repair-conflict-name">
                                          {formatViolation(
                                            violation,
                                          )}
                                        </div>

                                        {detail && (
                                          <div className="interactive-repair-conflict-detail">
                                            {
                                              detail
                                            }
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Contributing classes */}

                                    {sessionIds.length >
                                      0 && (
                                      <div className="interactive-repair-conflict-section">
                                        <div className="interactive-repair-conflict-section-title">
                                          Contributing
                                          classes
                                        </div>

                                        <div className="interactive-repair-conflict-session-list">
                                          {sessionIds.map(
                                            (
                                              sessionId,
                                            ) => {
                                              const durationLabel =
                                                getSessionDurationLabel(
                                                  column.workingSessions,
                                                  sessionId,
                                                );

                                              return (
                                                <button
                                                  key={
                                                    sessionId
                                                  }
                                                  type="button"
                                                  className="interactive-repair-conflict-session"
                                                  onClick={() =>
                                                    openClassContext(
                                                      column.id,
                                                      sessionId,
                                                    )
                                                  }
                                                  title="Inspect lecturer, cohort and room timetable context"
                                                  style={{
                                                    cursor:
                                                      "pointer",
                                                    font:
                                                      "inherit",
                                                    textAlign:
                                                      "left",
                                                  }}
                                                >
                                                  <span>
                                                    {getSessionLabelFromSnapshot(
                                                      column.workingSessions,
                                                      sessionId,
                                                    )}
                                                  </span>

                                                  {durationLabel && (
                                                    <span
                                                      style={{
                                                        marginLeft:
                                                          "6px",
                                                        color:
                                                          "#64748b",
                                                        fontSize:
                                                          "11px",
                                                        fontWeight:
                                                          700,
                                                        whiteSpace:
                                                          "nowrap",
                                                      }}
                                                    >
                                                      ·{" "}
                                                      {
                                                        durationLabel
                                                      }
                                                    </span>
                                                  )}

                                                  <span
                                                    aria-hidden="true"
                                                    style={{
                                                      marginLeft:
                                                        "6px",
                                                      color:
                                                        "#818cf8",
                                                      fontSize:
                                                        "11px",
                                                    }}
                                                  >
                                                    ↗
                                                  </span>
                                                </button>
                                              );
                                            },
                                          )}
                                        </div>
                                      </div>
                                    )}

                                    {/* Historical impact — only for the four welfare constraints */}

                                    {historicalConfig && (
                                      <div
                                        className="interactive-repair-conflict-section"
                                        style={{
                                          position:
                                            "relative",
                                        }}
                                        onMouseEnter={() => {
                                          if (
                                            historicalPopoverKey
                                          ) {
                                            openHistoricalImpactPopover(
                                              historicalPopoverKey,
                                            );
                                          }
                                        }}
                                        onMouseLeave={
                                          scheduleHistoricalImpactClose
                                        }
                                      >
                                        <button
                                          ref={(node) => {
                                            if (
                                              !historicalPopoverKey
                                            ) {
                                              return;
                                            }

                                            if (node) {
                                              historicalImpactButtonRefs.current.set(
                                                historicalPopoverKey,
                                                node,
                                              );
                                            } else {
                                              historicalImpactButtonRefs.current.delete(
                                                historicalPopoverKey,
                                              );
                                            }
                                          }}
                                          type="button"
                                          aria-expanded={
                                            openHistoricalImpactKey ===
                                            historicalPopoverKey
                                          }
                                          onFocus={() => {
                                            if (
                                              historicalPopoverKey
                                            ) {
                                              openHistoricalImpactPopover(
                                                historicalPopoverKey,
                                              );
                                            }
                                          }}
                                          onClick={() =>
                                            setOpenHistoricalImpactKey(
                                              (current) =>
                                                current ===
                                                historicalPopoverKey
                                                  ? null
                                                  : historicalPopoverKey,
                                            )
                                          }
                                          style={{
                                            display:
                                              "inline-flex",
                                            alignItems:
                                              "center",
                                            gap: "5px",
                                            padding: 0,
                                            border: "none",
                                            background:
                                              "transparent",
                                            color:
                                              "#475569",
                                            fontSize:
                                              "12px",
                                            fontWeight:
                                              600,
                                            cursor:
                                              "pointer",
                                          }}
                                        >
                                          <span>
                                            Historical
                                            impact:
                                          </span>

                                          <strong
                                            style={{
                                              color:
                                                "#334155",
                                            }}
                                          >
                                            {stakeholderHistoricalRows.length >
                                            0
                                              ? formatAccumulatedImpact(
                                                  accumulatedImpactMinutes,
                                                  historicalConfig.impactType,
                                                )
                                              : "none recorded"}
                                          </strong>

                                          <span
                                            aria-hidden="true"
                                            style={{
                                              fontSize:
                                                "12px",
                                            }}
                                          >
                                            ⓘ
                                          </span>
                                        </button>

                                        {openHistoricalImpactKey ===
                                          historicalPopoverKey &&
                                          historicalPopoverKey &&
                                          typeof document !==
                                            "undefined" &&
                                          (() => {
                                            const trigger =
                                              historicalImpactButtonRefs.current.get(
                                                historicalPopoverKey,
                                              );

                                            if (!trigger) {
                                              return null;
                                            }

                                            const rect =
                                              trigger.getBoundingClientRect();

                                            const popoverWidth =
                                              280;
                                            const viewportPadding =
                                              12;

                                            /*
                                             * Prefer opening below the trigger.
                                             * Clamp horizontally so the panel
                                             * never runs off the viewport.
                                             */
                                            const left =
                                              Math.min(
                                                Math.max(
                                                  viewportPadding,
                                                  rect.left,
                                                ),
                                                Math.max(
                                                  viewportPadding,
                                                  window.innerWidth -
                                                    popoverWidth -
                                                    viewportPadding,
                                                ),
                                              );

                                            const top =
                                              rect.bottom +
                                              6;

                                            return createPortal(
                                              <div
                                                role="dialog"
                                                aria-label={`Historical impact for ${stakeholderName}`}
                                                onMouseEnter={
                                                  cancelHistoricalImpactClose
                                                }
                                                onMouseLeave={
                                                  scheduleHistoricalImpactClose
                                                }
                                                style={{
                                                  position:
                                                    "fixed",
                                                  zIndex:
                                                    10000,
                                                  left,
                                                  top,
                                                  width:
                                                    `${popoverWidth}px`,
                                                  maxWidth:
                                                    "calc(100vw - 24px)",
                                                  padding:
                                                    "12px",
                                                  border:
                                                    "1px solid #cbd5e1",
                                                  borderRadius:
                                                    "8px",
                                                  background:
                                                    "#ffffff",
                                                  boxShadow:
                                                    "0 10px 28px rgba(15, 23, 42, 0.14)",
                                                }}
                                              >
                                            <div
                                              style={{
                                                fontSize:
                                                  "10px",
                                                fontWeight:
                                                  700,
                                                letterSpacing:
                                                  "0.06em",
                                                textTransform:
                                                  "uppercase",
                                                color:
                                                  "#64748b",
                                                marginBottom:
                                                  "5px",
                                              }}
                                            >
                                              Historical
                                              impact
                                            </div>

                                            <div
                                              style={{
                                                fontSize:
                                                  "13px",
                                                fontWeight:
                                                  700,
                                                color:
                                                  "#0f172a",
                                                marginBottom:
                                                  "10px",
                                              }}
                                            >
                                              {
                                                stakeholderName
                                              }
                                            </div>

                                            <div
                                              style={{
                                                display:
                                                  "flex",
                                                justifyContent:
                                                  "space-between",
                                                alignItems:
                                                  "baseline",
                                                gap: "12px",
                                                padding:
                                                  "9px 0",
                                                borderTop:
                                                  "1px solid #e2e8f0",
                                                borderBottom:
                                                  "1px solid #e2e8f0",
                                              }}
                                            >
                                              <span
                                                style={{
                                                  fontSize:
                                                    "12px",
                                                  color:
                                                    "#64748b",
                                                }}
                                              >
                                                {historicalConfig.impactType ===
                                                "lunch-break-reduced"
                                                  ? "Accumulated lunch-break loss"
                                                  : "Accumulated excess teaching"}
                                              </span>

                                              <strong
                                                style={{
                                                  fontSize:
                                                    "15px",
                                                  color:
                                                    "#1e293b",
                                                  whiteSpace:
                                                    "nowrap",
                                                }}
                                              >
                                                {formatAccumulatedImpact(
                                                  accumulatedImpactMinutes,
                                                  historicalConfig.impactType,
                                                )}
                                              </strong>
                                            </div>

                                            <div
                                              style={{
                                                display:
                                                  "grid",
                                                gridTemplateColumns:
                                                  "1fr 1fr",
                                                gap: "8px",
                                                marginTop:
                                                  "9px",
                                                fontSize:
                                                  "11px",
                                                color:
                                                  "#64748b",
                                              }}
                                            >
                                              <span>
                                                Previous
                                                occurrences
                                                <strong
                                                  style={{
                                                    display:
                                                      "block",
                                                    marginTop:
                                                      "2px",
                                                    fontSize:
                                                      "13px",
                                                    color:
                                                      "#334155",
                                                  }}
                                                >
                                                  {
                                                    stakeholderHistoricalRows.length
                                                  }
                                                </strong>
                                              </span>

                                              <span>
                                                Most recent
                                                <strong
                                                  style={{
                                                    display:
                                                      "block",
                                                    marginTop:
                                                      "2px",
                                                    fontSize:
                                                      "13px",
                                                    color:
                                                      "#334155",
                                                  }}
                                                >
                                                  {mostRecentHistoricalDate
                                                    ? new Date(
                                                        `${mostRecentHistoricalDate}T00:00:00`,
                                                      ).toLocaleDateString(
                                                        "en-GB",
                                                        {
                                                          day:
                                                            "numeric",
                                                          month:
                                                            "short",
                                                          year:
                                                            "numeric",
                                                        },
                                                      )
                                                    : "—"}
                                                </strong>
                                              </span>
                                            </div>

                                            <Link
                                              to={`/historical-impact?stakeholder=${encodeURIComponent(
                                                historicalConfig.stakeholderId,
                                              )}&impact=${encodeURIComponent(
                                                historicalConfig.impactType,
                                              )}`}
                                              style={{
                                                display:
                                                  "inline-block",
                                                marginTop:
                                                  "10px",
                                                color:
                                                  "#4338ca",
                                                fontSize:
                                                  "12px",
                                                fontWeight:
                                                  600,
                                                textDecoration:
                                                  "none",
                                              }}
                                            >
                                              View full
                                              historical
                                              impact →
                                            </Link>
                                          </div>,
                                              document.body,
                                            );
                                          })()}
                                      </div>
                                    )}

                                    {/* Only newest diagnosed state is editable */}

                                    {isActive && (
                                      <div className="interactive-repair-conflict-section">
                                        <div className="interactive-repair-conflict-section-title">
                                          Possible
                                          resolutions
                                        </div>

                                        <div className="interactive-repair-conflict-actions">
                                          {canMove &&
                                            movableSessionIds.map(
                                              (
                                                sessionId,
                                              ) => (
                                                <button
                                                  key={`move-${sessionId}`}
                                                  type="button"
                                                  className="interactive-repair-action"
                                                  onClick={() =>
                                                    openMoveColumn(
                                                      sessionId,
                                                    )
                                                  }
                                                >
                                                  Move{" "}
                                                  {getSessionLabel(
                                                    sessionId,
                                                  )}
                                                </button>
                                              ),
                                            )}

                                          {canRelax && (
                                            <button
                                              type="button"
                                              className="interactive-repair-action interactive-repair-action--relax"
                                              onClick={() =>
                                                relaxViolation(
                                                  column.id,
                                                  violation,
                                                )
                                              }
                                            >
                                              Relax this
                                              constraint
                                            </button>
                                          )}

                                          {!canMove &&
                                            !canRelax && (
                                              <div className="interactive-repair-conflict-no-action">
                                                No
                                                interactive
                                                repair
                                                option
                                                available.
                                              </div>
                                            )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                      );
                                      },
                                    )}
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                        )}
                          </>
                        )}
                      </>
                    )}
                      </>
                    )}
                  </div>
                );
              },
            )}
          </div>
        )}

      {/* Archived failed paths */}

      {failedPathColumns.length > 0 && (
        <div
          style={{
            marginTop: "18px",
            marginBottom: "24px",
            padding: "12px",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            background: "#fafafa",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              marginBottom: "10px",
            }}
          >
            Failed paths
          </div>

          {failedPathColumns.map(
            (column) => {
              const stateNumber =
                repairColumns.findIndex(
                  (item) =>
                    item.id === column.id,
                ) + 1;

              const parentStateNumber =
                column.parentStateId
                  ? repairColumns.findIndex(
                      (item) =>
                        item.id === column.parentStateId,
                    ) + 1
                  : null;

              return (
                <div
                  key={`failed-${column.id}`}
                  style={{
                    marginTop: "8px",
                    padding: "10px",
                    border: "1px solid #fecaca",
                    borderRadius: "6px",
                    background: "#fff1f2",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    ✕ Repair state {stateNumber}
                  </div>

                  {column.actionLabel && (
                    <div>
                      {column.actionLabel}
                    </div>
                  )}

                  {parentStateNumber && (
                    <div
                      style={{
                        marginTop: "4px",
                        fontSize: "12px",
                      }}
                    >
                      Branched from Repair state{" "}
                      {parentStateNumber}
                    </div>
                  )}

                  {column.violations.length > 0 && (
                    <div
                      style={{
                        marginTop: "8px",
                      }}
                    >
                      <strong>
                        Why it failed
                      </strong>

                      {column.violations.map(
                        (violation) => (
                          <div
                            key={`failed-${column.id}-${getViolationKey(
                              violation,
                            )}`}
                            style={{
                              marginTop: "3px",
                            }}
                          >
                            •{" "}
                            {formatViolation(
                              violation,
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              );
            },
          )}
        </div>
      )}

      {/* Class context modal */}

      {classContextSelection &&
        classContextSession &&
        createPortal(
          <div
            role="presentation"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeClassContext();
              }
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 12000,
              display: "grid",
              placeItems: "center",
              padding: "28px",
              background:
                "rgba(15, 23, 42, 0.38)",
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="class-context-title"
              style={{
                width:
                  "min(920px, calc(100vw - 40px))",
                maxHeight:
                  "calc(100vh - 56px)",
                overflowY: "auto",
                background: "#ffffff",
                border:
                  "1px solid #d7ddf5",
                borderRadius: "14px",
                boxShadow:
                  "0 24px 70px rgba(15, 23, 42, 0.18)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent:
                    "space-between",
                  gap: "20px",
                  padding:
                    "20px 22px 16px",
                  borderBottom:
                    "1px solid #e6e9f2",
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      marginBottom: "5px",
                      color: "#7c849c",
                      fontSize: "10px",
                      fontWeight: 800,
                      letterSpacing:
                        "0.08em",
                      textTransform:
                        "uppercase",
                    }}
                  >
                    Class context
                  </div>

                  <h3
                    id="class-context-title"
                    style={{
                      margin: 0,
                      color: "#1e2340",
                      fontSize: "19px",
                      lineHeight: 1.3,
                      fontWeight: 750,
                    }}
                  >
                    {classContextModule
                      ? classContextModule.title
                        ? `${classContextModule.code} · ${classContextModule.title}`
                        : classContextModule.code
                      : classContextSession.id}
                  </h3>

                  <div
                    style={{
                      marginTop: "6px",
                      color: "#64748b",
                      fontSize: "13px",
                      fontWeight: 550,
                    }}
                  >
                    {formatClassContextDateTime(
                      classContextSession,
                    )}
                    {classContextSession.room
                      ? ` · ${classContextSession.room}`
                      : ""}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    closeClassContext
                  }
                  aria-label="Close class context"
                  style={{
                    flex: "0 0 auto",
                    border: 0,
                    background:
                      "transparent",
                    color: "#64748b",
                    fontSize: "22px",
                    lineHeight: 1,
                    cursor: "pointer",
                    padding: "3px 5px",
                  }}
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  padding: "18px 22px 22px",
                }}
              >
                <p
                  style={{
                    margin:
                      "0 0 14px",
                    color: "#64748b",
                    fontSize: "13px",
                    lineHeight: 1.5,
                  }}
                >
                  Inspect the current repair-state
                  schedules that could be affected
                  before choosing to move this class.
                </p>

                <div
                  role="tablist"
                  aria-label="Class context timetable"
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "7px",
                    marginBottom: "16px",
                  }}
                >
                  {classContextTabs.map(
                    (tab) => {
                      const selected =
                        classContextTab?.type ===
                          tab.type &&
                        classContextTab?.id ===
                          tab.id;

                      let label =
                        tab.id;

                      if (
                        tab.type ===
                        "lecturer"
                      ) {
                        label =
                          `Lecturer: ${
                            lecturers.find(
                              (lecturer) =>
                                lecturer.id ===
                                tab.id,
                            )?.name ??
                            tab.id
                          }`;
                      }

                      if (
                        tab.type ===
                        "cohort"
                      ) {
                        label =
                          `Cohort: ${getCohortName(
                            tab.id,
                          )}`;
                      }

                      if (
                        tab.type ===
                        "room"
                      ) {
                        label =
                          `Room: ${tab.id}`;
                      }

                      return (
                        <button
                          key={`${tab.type}-${tab.id}`}
                          type="button"
                          role="tab"
                          aria-selected={
                            selected
                          }
                          onClick={() =>
                            setClassContextTab(
                              tab,
                            )
                          }
                          style={{
                            border:
                              selected
                                ? "1px solid #8794d2"
                                : "1px solid #d7ddf5",
                            borderRadius:
                              "8px",
                            padding:
                              "8px 11px",
                            background:
                              selected
                                ? "#eef2fd"
                                : "#ffffff",
                            color:
                              selected
                                ? "#33428c"
                                : "#526079",
                            fontSize:
                              "12px",
                            fontWeight:
                              700,
                            cursor:
                              "pointer",
                          }}
                        >
                          {label}
                        </button>
                      );
                    },
                  )}
                </div>

                {(() => {
                  if (
                    !classContextTab
                  ) {
                    return (
                      <div
                        style={{
                          padding: "20px",
                          border:
                            "1px solid #e6e9f2",
                          borderRadius:
                            "10px",
                          color:
                            "#64748b",
                          fontSize:
                            "13px",
                        }}
                      >
                        No timetable context is
                        available for this class.
                      </div>
                    );
                  }

                  const selectedSlots =
                    sessionToSlotIds(
                      classContextSession,
                    );

                  if (
                    classContextTab.type ===
                    "lecturer"
                  ) {
                    const lecturer =
                      lecturers.find(
                        (item) =>
                          item.id ===
                          classContextTab.id,
                      );

                    const busySlots =
                      getBusySlots(
                        classContextSessions,
                        (session) =>
                          session.lecturerId ===
                          classContextTab.id,
                        classContextSession.id,
                      );

                    return (
                      <MiniTimetablePreview
                        title={`Lecturer: ${
                          lecturer?.name ??
                          classContextTab.id
                        }`}
                        busySlots={
                          busySlots
                        }
                        selectedSlots={
                          selectedSlots
                        }
                        unavailableSlots={
                          lecturerUnavailableSlotMap[
                            classContextTab.id
                          ] ?? []
                        }
                        fullTimetableLink={`/timetable-preview?lecturer=${encodeURIComponent(
                          classContextTab.id,
                        )}`}
                      />
                    );
                  }

                  if (
                    classContextTab.type ===
                    "cohort"
                  ) {
                    const busySlots =
                      getBusySlots(
                        classContextSessions,
                        (session) =>
                          session.cohortIds.includes(
                            classContextTab.id,
                          ),
                        classContextSession.id,
                      );

                    return (
                      <MiniTimetablePreview
                        title={`Cohort: ${getCohortName(
                          classContextTab.id,
                        )}`}
                        busySlots={
                          busySlots
                        }
                        selectedSlots={
                          selectedSlots
                        }
                        unavailableSlots={[]}
                        fullTimetableLink={`/timetable-preview?cohort=${encodeURIComponent(
                          classContextTab.id,
                        )}`}
                      />
                    );
                  }

                  const busySlots =
                    getBusySlots(
                      classContextSessions,
                      (session) =>
                        session.room ===
                        classContextTab.id,
                      classContextSession.id,
                    );

                  return (
                    <MiniTimetablePreview
                      title={`Room: ${classContextTab.id}`}
                      busySlots={
                        busySlots
                      }
                      selectedSlots={
                        selectedSlots
                      }
                      unavailableSlots={[]}
                      fullTimetableLink={`/timetable-preview?room=${encodeURIComponent(
                        classContextTab.id,
                      )}`}
                    />
                  );
                })()}

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                    marginTop: "16px",
                    paddingTop: "14px",
                    borderTop:
                      "1px solid #e6e9f2",
                  }}
                >
                  <div
                    style={{
                      color: "#7c849c",
                      fontSize: "12px",
                    }}
                  >
                    Selected cells show the class you
                    are inspecting; busy cells show
                    the surrounding timetable in this
                    repair state.
                  </div>

                  <button
                    type="button"
                    onClick={
                      closeClassContext
                    }
                    style={{
                      border:
                        "1px solid #d7ddf5",
                      borderRadius: "8px",
                      padding:
                        "8px 13px",
                      background:
                        "#ffffff",
                      color:
                        "#3f4b8f",
                      fontSize:
                        "12px",
                      fontWeight: 700,
                      cursor:
                        "pointer",
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </section>
          </div>,
          document.body,
        )}

      {/* Timetable */}

      <div className="interactive-repair-timetable">
        <TimetableView
          events={events}
          showFilters={false}
          showHeader={false}
          showLegend={false}
          showWeekHeading
          embedded
          requestedSessionId={
            requestedSessionId
          }
          additionalChangeSessionIds={
            additionalMovedSessionIds
          }
          highlightAdditionalChangesAsRequested
          repairProblemSessionIds={
            unresolvedConflictSessionIds
          }
          repairDeadEndSessionId={
            repairDeadEndSessionId
          }
        />
      </div>
    </div>
  );
}
