import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";

import { StakeholderViolationsPanel } from "./StakeholderViolationsPanel";
import { HistoricalImpactSummary } from "../../../impact/components/HistoricalImpactSummary";
import { api } from "../../../../shared/api/client";

import {
  fetchHistoricalImpacts,
  type HistoricalImpact,
  type HistoricalImpactType,
  type HistoricalStakeholderType,
} from "./historicalImpacts";

import "./Step4solution.css";
import { RequestedChangeSummary } from "../RequestedChangeSummary";

type RelaxableConstraintInstance = {
  instance_id: string;
  constraint_id: string;
  constraint_name: string;
  stakeholder_id: string;
  stakeholder_name: string;
  day: string | null;
};

type RelaxableConstraintGroups = {
  lecturer: RelaxableConstraintInstance[];
  cohort: RelaxableConstraintInstance[];
  session: RelaxableConstraintInstance[];
};

type Mode = "keep" | "specific" | "find";


type Violation = {
  type: string;
  [key: string]: any;
};


type Diagnostics = {
  violations: Violation[];
  overlapping_sessions: string[];
};


type RescheduleSolution = {
  start_slot: number;
  day: string;
  time: string;
  room_id: string;
  lecturer_id: string;
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

type MixedRecoveryResult = {
  status: "feasible" | "infeasible" | "invalid";
  reason: string | null;
  session_id?: string;
  start_slot?: number;
  day?: string;
  time?: string;
  room_id?: string;
  lecturer_id?: string;
  additional_changes?: AdditionalChange[];
  perturbation_count?: number;
  max_perturbations?: number;
  allowed_relaxations?: TemporaryConstraintDeactivation[];
  used_relaxations?: TemporaryConstraintDeactivation[];
  relaxation_count?: number;
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

type NamedEntity = {
  id: string;
  name: string;
};

type ModuleLike = {
  id: string;
  code?: string;
  name?: string;
  title?: string;
};


type SessionLike = {
  id: string;
  moduleId?: string;
  lecturerId: string;
  room?: string;
  cohortIds: string[];
};


type RecoveryOption =
  | "different-request"
  | "rearrange"
  | "relax";


type HistoricalImpactConfig = {
  stakeholderType: HistoricalStakeholderType;
  impactType: HistoricalImpactType;
  highlightStakeholderId: string;
};


function getHistoricalImpactConfig(
  violation: Violation,
): HistoricalImpactConfig | null {
  switch (violation.type) {
    case "lecturer_daily_hours":
      if (!violation.lecturer_id) return null;

      return {
        stakeholderType: "lecturer",
        impactType: "consecutive-teaching",
        highlightStakeholderId: violation.lecturer_id,
      };

    case "cohort_daily_hours":
      if (!violation.cohort_id) return null;

      return {
        stakeholderType: "cohort",
        impactType: "consecutive-teaching",
        highlightStakeholderId: violation.cohort_id,
      };

    case "lecturer_lunch_break":
      if (!violation.lecturer_id) return null;

      return {
        stakeholderType: "lecturer",
        impactType: "lunch-break-reduced",
        highlightStakeholderId: violation.lecturer_id,
      };

    default:
      return null;
  }
}


function getHistoricalImpactKey(
  stakeholderType: HistoricalStakeholderType,
  impactType: HistoricalImpactType,
): string {
  return `${stakeholderType}:${impactType}`;
}


export type TemporaryConstraintDeactivation = {
  constraint_id: string;
  instance_type:
    | "lecturer"
    | "cohort"
    | "session"
    | "room";
  instance_id: string;
  day: string | null;
};


const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};


type Step4SolutionProps = {
  solverLoading: boolean;
  solverError: string | null;
  solverResult: RescheduleResponse | null;
  perturbationPreview: RescheduleResponse | null;
  mixedRecoveryRequest: RescheduleRequest;

  selectedModuleLabel: string | null;
  selectedEventFallbackId?: string;
  selectedEventDayTime: string | null;
  selectedEventRoom?: string | null;
  selectedEventLecturerName?: string | null;

  requestedTimeLabel: string;
  requestedRoomLabel: string;
  requestedLecturerLabel: string;
  rescheduleScopeLabel: string;

  originalModes: {
    time: Mode;
    room: Mode;
    lecturer: Mode;
  } | null;

  getRoomName: (roomId: string) => string;
  getLecturerName: (lecturerId: string) => string;
  formatViolationNice: (v: Violation) => string;
  isRelaxableViolation: (type: string) => boolean;

  onBackToRequest: () => void;

  onRetryWithRelaxations: (
    constraints: TemporaryConstraintDeactivation[],
  ) => void;

  onFindRearrangements: () => void;

  appliedTemporaryDeactivations:
    TemporaryConstraintDeactivation[];

  needsInteractiveDiagnosis: boolean;

  days: string[];
  timeSlots: string[];
  lecturers: NamedEntity[];
  rooms: NamedEntity[];
  cohorts: NamedEntity[];
  sessions: SessionLike[];
  modules: ModuleLike[];

  lecturerUnavailableSlotMap:
    Record<string, string[]>;

  excludeSessionId: string;

  caseAProposedSlots: string[];
  caseBProposedSlots: string[];

  diagLecturer: string | null;
  onDiagLecturerChange: (
    value: string | null,
  ) => void;

  diagDay: string | null;
  onDiagDayChange: (
    value: string | null,
  ) => void;

  diagTime: string | null;
  onDiagTimeChange: (
    value: string | null,
  ) => void;

  diagRoom: string | null;
  onDiagRoomChange: (
    value: string | null,
  ) => void;

  diagLoading: boolean;
  diagError: string | null;
  diagResult: Diagnostics | null;
};


export function Step4Solution({
  solverLoading,
  solverError,
  solverResult,
  perturbationPreview,
  mixedRecoveryRequest,

  selectedModuleLabel,
  selectedEventFallbackId,
  selectedEventDayTime,
  selectedEventRoom,
  selectedEventLecturerName,

  originalModes,

  requestedTimeLabel,
  requestedRoomLabel,
  requestedLecturerLabel,
  rescheduleScopeLabel,

  getRoomName,
  getLecturerName,
  formatViolationNice,
  isRelaxableViolation,

  needsInteractiveDiagnosis,

  days,
  timeSlots,
  lecturers,
  rooms,
  cohorts,
  sessions,
  modules,

  lecturerUnavailableSlotMap,
  excludeSessionId,

  caseAProposedSlots,
  caseBProposedSlots,

  diagLecturer,
  onDiagLecturerChange,

  diagDay,
  onDiagDayChange,

  diagTime,
  onDiagTimeChange,

  diagRoom,
  onDiagRoomChange,

  diagLoading,
  diagError,
  diagResult,

  onBackToRequest,
  onRetryWithRelaxations,
  onFindRearrangements,

  appliedTemporaryDeactivations,
}: Step4SolutionProps) {
  const [
    selectedRecoveryOption,
    setSelectedRecoveryOption,
  ] = useState<RecoveryOption | null>(null);

  const [explanationOpen, setExplanationOpen] = useState(true);
  const [recoveryOpen, setRecoveryOpen] = useState(false);

  const [mixedRecoveryOpen, setMixedRecoveryOpen] = useState(false);
  const [mixedPerturbationLimit, setMixedPerturbationLimit] = useState(1);

  const [relaxableConstraints, setRelaxableConstraints] = useState<RelaxableConstraintGroups | null>(null);
  const [allowedRelaxationIds, setAllowedRelaxationIds] = useState<string[]>([]);
  const [allowedRelaxationsOpen, setAllowedRelaxationsOpen] = useState(false);
  const [mixedRecoveryLoading, setMixedRecoveryLoading] = useState(false);
  const [mixedRecoveryError, setMixedRecoveryError] = useState<string | null>(null);
  const [mixedRecoveryResult, setMixedRecoveryResult] =
    useState<MixedRecoveryResult | null>(null);

  /*
   * Historical impacts used in the Relax Constraints section.
   *
   * A request can be blocked by several impact-bearing constraints at once,
   * so we keep one historical dataset per stakeholder/impact combination.
   */
  const [
    historicalImpactsByKey,
    setHistoricalImpactsByKey,
  ] = useState<Record<string, HistoricalImpact[]>>({});


  function toggleRecoveryOption(
    option: RecoveryOption,
  ) {
    setSelectedRecoveryOption(
      (current) =>
        current === option
          ? null
          : option,
    );
  }


async function loadRelaxableConstraints() {
  if (relaxableConstraints) {
    return;
  }

  const data = await api.get<RelaxableConstraintGroups>(
    "/constraints/relaxable-instances",
  );

  setRelaxableConstraints(data);

}


const allRelaxableConstraints = relaxableConstraints
  ? [
      ...relaxableConstraints.lecturer.map((constraint) => ({
        ...constraint,
        instance_type: "lecturer" as const,
      })),
      ...relaxableConstraints.cohort.map((constraint) => ({
        ...constraint,
        instance_type: "cohort" as const,
      })),
      ...relaxableConstraints.session.map((constraint) => ({
        ...constraint,
        instance_type: "session" as const,
      })),
    ]
  : [];

const selectedAllowedRelaxations = allRelaxableConstraints.filter(
  (constraint) => allowedRelaxationIds.includes(constraint.instance_id),
);

async function findMixedRecoverySolution() {
  setMixedRecoveryLoading(true);
  setMixedRecoveryError(null);
  setMixedRecoveryResult(null);

  try {
    const allowedRelaxations: TemporaryConstraintDeactivation[] =
      selectedAllowedRelaxations.map((constraint) => ({
        constraint_id: constraint.constraint_id,
        instance_type: constraint.instance_type,
        // IMPORTANT: the mixed solver expects the stakeholder/entity id,
        // not the database constraint-instance row id used by the checkbox.
        instance_id: constraint.stakeholder_id,
        day: constraint.day,
      }));

    const result = await api.post<MixedRecoveryResult>(
      "/solver/reschedule/mixed",
      {
        request: {
          ...mixedRecoveryRequest,
          temporarily_deactivated_constraints: [],
          max_additional_changes: null,
        },
        max_perturbations: mixedPerturbationLimit,
        allowed_relaxations: allowedRelaxations,
      },
    );

    setMixedRecoveryResult(result);
  } catch (error) {
    console.error("Failed to run mixed recovery:", error);
    setMixedRecoveryError(
      error instanceof Error
        ? error.message
        : "Could not run mixed recovery.",
    );
  } finally {
    setMixedRecoveryLoading(false);
  }
}


  /*
   * For a concrete request we use the solver diagnostics.
   *
   * For a request containing FIND, the relevant blockers
   * are those from the concrete combination the user
   * diagnosed.
   */
  const activeViolations: Violation[] =
    needsInteractiveDiagnosis
      ? (diagResult?.violations ?? [])
      : solverResult &&
          solverResult.status !== "feasible"
        ? (
            solverResult.diagnostics
              ?.violations ?? []
          )
        : [];


  const hasActiveDiagnosis =
    activeViolations.length > 0;


  /*
   * Load every distinct historical-impact dataset needed by the current
   * blockers. For example:
   *
   * lecturer_daily_hours -> lecturer + consecutive-teaching
   * cohort_daily_hours   -> cohort + consecutive-teaching
   * lecturer_lunch_break -> lecturer + lunch-break-reduced
   *
   * Constraints without a historical-impact mapping are ignored.
   */
  useEffect(() => {
    if (selectedRecoveryOption !== "relax") {
      setHistoricalImpactsByKey({});
      return;
    }

    const configs = activeViolations
      .map(getHistoricalImpactConfig)
      .filter(
        (
          config,
        ): config is HistoricalImpactConfig =>
          config !== null,
      );

    const uniqueConfigs = Array.from(
      new Map(
        configs.map((config) => [
          getHistoricalImpactKey(
            config.stakeholderType,
            config.impactType,
          ),
          config,
        ]),
      ).values(),
    );

    if (uniqueConfigs.length === 0) {
      setHistoricalImpactsByKey({});
      return;
    }

    let cancelled = false;

    async function loadHistoricalImpacts() {
      try {
        const entries = await Promise.all(
          uniqueConfigs.map(async (config) => {
            const key = getHistoricalImpactKey(
              config.stakeholderType,
              config.impactType,
            );

            const impacts =
              await fetchHistoricalImpacts(
                config.stakeholderType,
                config.impactType,
              );

            return [key, impacts] as const;
          }),
        );

        if (!cancelled) {
          setHistoricalImpactsByKey(
            Object.fromEntries(entries),
          );
        }
      } catch (error) {
        console.error(
          "Failed to load historical impacts:",
          error,
        );

        if (!cancelled) {
          setHistoricalImpactsByKey({});
        }
      }
    }

    loadHistoricalImpacts();

    return () => {
      cancelled = true;
    };
  }, [
    selectedRecoveryOption,
    activeViolations,
  ]);


const canRearrange =
  !needsInteractiveDiagnosis &&
  solverResult?.status === "infeasible" &&
  solverResult.recovery_options?.can_perturb === true;

const minimumPerturbations =
  !needsInteractiveDiagnosis &&
  solverResult?.status === "infeasible"
    ? solverResult.recovery_options?.minimum_perturbations ?? null
    : null;


  /*
   * Relaxation is only a valid route when EVERY current
   * blocker is relaxable.
   */
  const unrelaxableViolations =
    activeViolations.filter(
      (violation) =>
        !isRelaxableViolation(
          violation.type,
        ),
    );


  const canRelax =
    hasActiveDiagnosis &&
    unrelaxableViolations.length === 0;

  const canMixedRecovery =
    hasActiveDiagnosis &&
    (canRelax || canRearrange);


  const lecturerUnavailableViolation =
    activeViolations.find(
      (violation) =>
        violation.type ===
        "lecturer_unavailable",
    );


  const firstUnrelaxableViolation =
    unrelaxableViolations[0];


  function getConstraintLabel(
    type: string,
  ): string {
    switch (type) {
      case "class_capacity":
        return "Class capacity";

      case "class_equipment":
        return "Required equipment";

      case "lecturer_daily_hours":
        return "Lecturer daily hours";

      case "cohort_daily_hours":
        return "Cohort daily hours";

      case "lecturer_lunch_break":
        return "Lecturer lunch break";

      default:
        return type
          .split("_")
          .map(
            (word) =>
              word.charAt(0).toUpperCase() +
              word.slice(1),
          )
          .join(" ");
    }
  }


  function getTemporaryConstraintLabel(
    constraintId: string,
  ): string {
    switch (constraintId) {
      case "class-capacity":
        return "Class capacity";

      case "class-equipment":
        return "Required equipment";

      case "lecturer-max-one-hour-per-day":
        return "Lecturer daily hours";

      case "cohort-max-teaching-hours-per-day":
        return "Cohort daily hours";

      case "lecturer-lunch-break":
        return "Lecturer lunch break";

      default:
        return constraintId;
    }
  }


  function getTemporaryConstraintContext(
    constraint:
      TemporaryConstraintDeactivation,
  ): string {
    const matchingViolation =
      activeViolations.find(
        (violation) => {
          if (
            constraint.instance_type ===
              "lecturer" &&
            violation.lecturer_id ===
              constraint.instance_id
          ) {
            return (
              !constraint.day ||
              violation.day ===
                constraint.day
            );
          }

          if (
            constraint.instance_type ===
              "cohort" &&
            violation.cohort_id ===
              constraint.instance_id
          ) {
            return (
              !constraint.day ||
              violation.day ===
                constraint.day
            );
          }

          if (
            constraint.instance_type ===
              "session" &&
            violation.session_id ===
              constraint.instance_id
          ) {
            return true;
          }

          return false;
        },
      );

    if (matchingViolation?.message) {
      return matchingViolation.message;
    }

    return constraint.day
      ? `${constraint.instance_id} · ${constraint.day}`
      : constraint.instance_id;
  }


function getAdditionalChangeSessionLabel(
  sessionId: string,
): string {
  const matchingSession = sessions.find(
    (session) => session.id === sessionId,
  );

  if (!matchingSession?.moduleId) {
    return sessionId;
  }

  const matchingModule = modules.find(
    (module) => module.id === matchingSession.moduleId,
  );

  if (!matchingModule) {
    return matchingSession.moduleId;
  }

  const code =
    matchingModule.code ?? matchingModule.id;

  const name =
    matchingModule.name ?? matchingModule.title;

  return name
    ? `${code} · ${name}`
    : code;
}

  function getAdditionalChangeSession(sessionId: string,): SessionLike | undefined {
      return sessions.find((session) => session.id === sessionId,);
  }


  const temporaryDeactivations:
    TemporaryConstraintDeactivation[] =
    [];


  for (
    const violation of
    activeViolations
  ) {
    switch (violation.type) {
      case "class_capacity":
        if (violation.session_id) {
          temporaryDeactivations.push({
            constraint_id:
              "class-capacity",

            instance_type:
              "session",

            instance_id:
              violation.session_id,

            day: null,
          });
        }

        break;


      case "class_equipment":
        if (violation.session_id) {
          temporaryDeactivations.push({
            constraint_id:
              "class-equipment",

            instance_type:
              "session",

            instance_id:
              violation.session_id,

            day: null,
          });
        }

        break;


      case "lecturer_daily_hours":
        if (
          violation.lecturer_id &&
          violation.day
        ) {
          temporaryDeactivations.push({
            constraint_id:
              "lecturer-max-one-hour-per-day",

            instance_type:
              "lecturer",

            instance_id:
              violation.lecturer_id,

            day:
              violation.day,
          });
        }

        break;


      case "cohort_daily_hours":
        if (
          violation.cohort_id &&
          violation.day
        ) {
          temporaryDeactivations.push({
            constraint_id:
              "cohort-max-teaching-hours-per-day",

            instance_type:
              "cohort",

            instance_id:
              violation.cohort_id,

            day:
              violation.day,
          });
        }

        break;


      case "lecturer_lunch_break":
        if (
          violation.lecturer_id &&
          violation.day
        ) {
          temporaryDeactivations.push({
            constraint_id:
              "lecturer-lunch-break",

            instance_type:
              "lecturer",

            instance_id:
              violation.lecturer_id,

            day:
              violation.day,
          });
        }

        break;
    }
  }


  return (
    <>
      <h2>Solution</h2>

      {(!solverResult || solverResult.status === "feasible") && (
        <RequestedChangeSummary
          originalTime={selectedEventDayTime ?? "—"}
          requestedTime={requestedTimeLabel}
          originalRoom={selectedEventRoom ?? "—"}
          requestedRoom={requestedRoomLabel}
          originalLecturer={selectedEventLecturerName ?? "—"}
          requestedLecturer={requestedLecturerLabel}
          rescheduleScope={rescheduleScopeLabel}
        />
      )}

      {solverLoading && (
        <p className="step-description">
          Finding a feasible solution…
        </p>
      )}

      {!solverLoading && solverError && (
        <div className="solution-card">
          <div className="solution-score bad">
            Could not run the reschedule solver.
          </div>

          <p className="step-description">
            {solverError}
          </p>
        </div>
      )}


      {/* FEASIBLE FLOW */}

      {!solverLoading &&
        solverResult?.status ===
          "feasible" && (
          <div className="solution-options">
            <div className="solution-card recommended">
              <div className="solution-card-header">
                <div>
                  <h4>
                    Feasible solution
                  </h4>

                  <div className="solution-class-name">
                    {selectedModuleLabel ??
                      selectedEventFallbackId}
                  </div>
                </div>

                <span className="solution-tag">
                  Recommended
                </span>
              </div>


              <div className="change-list">

                {/* Time */}

                {(originalModes?.time ===
                  "specific" ||
                  originalModes?.time ===
                    "find") && (
                  <div className="change-item">
                    <div className="change-item-label">
                      Time
                    </div>

                    <div className="change-item-values">
                      <span className="change-from">
                        {selectedEventDayTime ??
                          "—"}
                      </span>

                      <span className="change-arrow">
                        →
                      </span>

                      <span className="change-to">
                        {DAY_LABELS[
                          solverResult.day
                            ?.slice(0, 3)
                            .toLowerCase() ??
                            ""
                        ] ??
                          solverResult.day}{" "}
                        {solverResult.time}
                      </span>
                    </div>
                  </div>
                )}


                {/* Room */}

                {(originalModes?.room ===
                  "specific" ||
                  originalModes?.room ===
                    "find") && (
                  <div className="change-item">
                    <div className="change-item-label">
                      Room
                    </div>

                    <div className="change-item-values">
                      <span className="change-from">
                        {selectedEventRoom ??
                          "—"}
                      </span>

                      <span className="change-arrow">
                        →
                      </span>

                      <span className="change-to">
                        {solverResult.room_id
                          ? getRoomName(
                              solverResult.room_id,
                            )
                          : "—"}
                      </span>
                    </div>
                  </div>
                )}


                {/* Lecturer */}

                {(originalModes?.lecturer ===
                  "specific" ||
                  originalModes?.lecturer ===
                    "find") && (
                  <div className="change-item">
                    <div className="change-item-label">
                      Lecturer
                    </div>

                    <div className="change-item-values">
                      <span className="change-from">
                        {selectedEventLecturerName ??
                          "—"}
                      </span>

                      <span className="change-arrow">
                        →
                      </span>

                      <span className="change-to">
                        {solverResult.lecturer_id
                          ? getLecturerName(
                              solverResult.lecturer_id,
                            )
                          : "—"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>


            {(
              solverResult.additional_changes
                ?.length ?? 0
            ) > 0 && (
              <div className="solution-exceptions">
                <div className="solution-exceptions-heading">
                  <div>
                    <span className="solution-exceptions-eyebrow">
                      TIMETABLE
                      REARRANGEMENT
                    </span>

                    <h3>
                      Additional timetable
                      changes
                    </h3>
                  </div>

                  <span className="solution-exceptions-count">
                    {
                      solverResult
                        .additional_changes!
                        .length
                    }{" "}
                    {solverResult
                      .additional_changes!
                      .length === 1
                      ? "change"
                      : "changes"}
                  </span>
                </div>


                <p className="solution-exceptions-intro">
                  These classes were moved
                  to make your requested
                  change possible.
                </p>


                <div className="solution-exceptions-list">
                  {solverResult.additional_changes!.map(
                    (change) => (
                      <div
                        key={
                          change.session_id
                        }
                        className="solution-exception-row"
                      >
                        <div
                          style={{
                            width:
                              "100%",
                          }}
                        >
                          <strong>
                            {getAdditionalChangeSessionLabel(
                              change.session_id,
                            )}
                          </strong>

                          <div className="change-list">
                            {change.time_changed && (
                              <div className="change-item">
                                <div className="change-item-label">
                                  Time
                                </div>

                                <div className="change-item-values">
                                  <span className="change-from">
                                    {DAY_LABELS[
                                      change.old_day
                                        .slice(
                                          0,
                                          3,
                                        )
                                        .toLowerCase()
                                    ] ??
                                      change.old_day}{" "}
                                    {
                                      change.old_time
                                    }
                                  </span>

                                  <span className="change-arrow">
                                    →
                                  </span>

                                  <span className="change-to">
                                    {DAY_LABELS[
                                      change.new_day
                                        .slice(
                                          0,
                                          3,
                                        )
                                        .toLowerCase()
                                    ] ??
                                      change.new_day}{" "}
                                    {
                                      change.new_time
                                    }
                                  </span>
                                </div>
                              </div>
                            )}

                            {change.room_changed && (
                              <div className="change-item">
                                <div className="change-item-label">
                                  Room
                                </div>

                                <div className="change-item-values">
                                  <span className="change-from">
                                    {getRoomName(
                                      change.old_room_id,
                                    )}
                                  </span>

                                  <span className="change-arrow">
                                    →
                                  </span>

                                  <span className="change-to">
                                    {getRoomName(
                                      change.new_room_id,
                                    )}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>


                <p className="solution-exceptions-note">
                  Lecturers are unchanged.
                  All active constraints
                  remain enforced.
                </p>
              </div>
            )}


            {appliedTemporaryDeactivations.length >
              0 && (
              <div className="solution-exceptions">
                <div className="solution-exceptions-heading">
                  <div>
                    <span className="solution-exceptions-eyebrow">
                      TEMPORARY EXCEPTIONS
                    </span>

                    <h3>
                      Constraints deactivated
                      for this solution
                    </h3>
                  </div>

                  <span className="solution-exceptions-count">
                    {
                      appliedTemporaryDeactivations.length
                    }{" "}
                    {appliedTemporaryDeactivations.length ===
                    1
                      ? "exception"
                      : "exceptions"}
                  </span>
                </div>


                <p className="solution-exceptions-intro">
                  This solution was found by
                  temporarily deactivating the
                  following constraints.
                </p>


                <div className="solution-exceptions-list">
                  {appliedTemporaryDeactivations.map(
                    (
                      constraint,
                      index,
                    ) => (
                      <div
                        key={`${constraint.constraint_id}-${constraint.instance_id}-${constraint.day ?? "all"}-${index}`}
                        className="solution-exception-row"
                      >
                        <div>
                          <strong>
                            {getTemporaryConstraintLabel(
                              constraint.constraint_id,
                            )}
                          </strong>

                          <span>
                            {getTemporaryConstraintContext(
                              constraint,
                            )}
                          </span>
                        </div>

                        <span className="solution-exception-badge">
                          Temporary
                        </span>
                      </div>
                    ),
                  )}
                </div>


                <p className="solution-exceptions-note">
                  These exceptions apply only
                  to this solution. Your global
                  constraint settings remain
                  unchanged.
                </p>
              </div>
            )}
          </div>
        )}


      {/* INFEASIBLE FLOW */}

      {!solverLoading &&
        solverResult &&
        solverResult.status !==
          "feasible" && (
          <div className="infeasible-flow">

            {/* 1. Outcome */}

            <section
              className="infeasible-outcome-card"
              style={{
                display: "block",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                }}
              >
                <div
                  className="infeasible-outcome-icon"
                  aria-hidden="true"
                >
                  <TriangleAlert size={20} />
                </div>

                <div>
                  <h3>
                    This timetable change isn't feasible
                  </h3>

                  <p>
                    {solverResult.reason ??
                      "No feasible solution was found for the requested timetable change."}
                  </p>
                </div>
              </div>

              <div
                style={{
                  marginTop: "16px",
                  paddingTop: "16px",
                  borderTop: "1px solid rgba(239, 68, 68, 0.18)",
                }}
              >
                <RequestedChangeSummary
                  variant="embedded"
                  originalTime={selectedEventDayTime ?? "—"}
                  requestedTime={requestedTimeLabel}
                  originalRoom={selectedEventRoom ?? "—"}
                  requestedRoom={requestedRoomLabel}
                  originalLecturer={selectedEventLecturerName ?? "—"}
                  requestedLecturer={requestedLecturerLabel}
                  rescheduleScope={rescheduleScopeLabel}
                />
              </div>
            </section>


            {/* 2. Explanation */}

            <section className="infeasible-section-card">
              <button
                type="button"
                className="infeasible-section-heading"
                onClick={() => setExplanationOpen((open) => !open)}
                aria-expanded={explanationOpen}
                style={{
                  width: "100%",
                  border: 0,
                  padding: 0,
                  background: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "16px",
                }}
              >
                <div>
                  <span className="infeasible-eyebrow">
                    FEASIBILITY EXPLANATION
                  </span>
                </div>

                {explanationOpen ? (
                  <ChevronUp size={20} aria-hidden="true" />
                ) : (
                  <ChevronDown size={20} aria-hidden="true" />
                )}
              </button>

              {explanationOpen && (
                <div>

              {/* CASE A */}

              {!needsInteractiveDiagnosis &&
                solverResult.diagnostics && (
                  <div className="diagnostics-section">
                    <StakeholderViolationsPanel
                      violations={
                        solverResult
                          .diagnostics
                          .violations
                      }
                      proposedSlots={
                        caseAProposedSlots
                      }
                      excludeSessionId={
                        excludeSessionId
                      }
                      lecturers={
                        lecturers
                      }
                      rooms={rooms}
                      cohorts={cohorts}
                      sessions={sessions}
                      lecturerUnavailableSlotMap={
                        lecturerUnavailableSlotMap
                      }
                      formatViolationNice={
                        formatViolationNice
                      }
                      isRelaxableViolation={
                        isRelaxableViolation
                      }
                    />
                  </div>
                )}


              {/* CASE B */}

              {needsInteractiveDiagnosis &&
                originalModes && (
                  <div className="interactive-diagnosis">
                    <p className="step-description">
                      Because you asked the
                      system to{" "}
                      <strong>
                        find
                      </strong>{" "}
                      a value, pick concrete
                      options below to see
                      why each combination
                      fails.
                    </p>


                    <div className="diag-dropdowns">

                      {originalModes.lecturer ===
                        "find" && (
                        <div>
                          <label>
                            Lecturer
                          </label>

                          <select
                            value={
                              diagLecturer ??
                              ""
                            }
                            onChange={(
                              e,
                            ) =>
                              onDiagLecturerChange(
                                e.target
                                  .value ||
                                  null,
                              )
                            }
                          >
                            <option value="">
                              Select
                              lecturer…
                            </option>

                            {lecturers.map(
                              (
                                lecturer,
                              ) => (
                                <option
                                  key={
                                    lecturer.id
                                  }
                                  value={
                                    lecturer.id
                                  }
                                >
                                  {
                                    lecturer.name
                                  }
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                      )}


                      {originalModes.time ===
                        "find" && (
                        <>
                          <div>
                            <label>
                              Day
                            </label>

                            <select
                              value={
                                diagDay ??
                                ""
                              }
                              onChange={(
                                e,
                              ) =>
                                onDiagDayChange(
                                  e.target
                                    .value ||
                                    null,
                                )
                              }
                            >
                              <option value="">
                                Select day…
                              </option>

                              {days.map(
                                (
                                  day,
                                ) => (
                                  <option
                                    key={
                                      day
                                    }
                                    value={
                                      day
                                    }
                                  >
                                    {
                                      day
                                    }
                                  </option>
                                ),
                              )}
                            </select>
                          </div>


                          <div>
                            <label>
                              Time
                            </label>

                            <select
                              value={
                                diagTime ??
                                ""
                              }
                              onChange={(
                                e,
                              ) =>
                                onDiagTimeChange(
                                  e.target
                                    .value ||
                                    null,
                                )
                              }
                            >
                              <option value="">
                                Select time…
                              </option>

                              {timeSlots.map(
                                (
                                  time,
                                ) => (
                                  <option
                                    key={
                                      time
                                    }
                                    value={
                                      time
                                    }
                                  >
                                    {
                                      time
                                    }
                                  </option>
                                ),
                              )}
                            </select>
                          </div>
                        </>
                      )}


                      {originalModes.room ===
                        "find" && (
                        <div>
                          <label>
                            Room
                          </label>

                          <select
                            value={
                              diagRoom ??
                              ""
                            }
                            onChange={(
                              e,
                            ) =>
                              onDiagRoomChange(
                                e.target
                                  .value ||
                                  null,
                              )
                            }
                          >
                            <option value="">
                              Select room…
                            </option>

                            {rooms.map(
                              (room) => (
                                <option
                                  key={
                                    room.id
                                  }
                                  value={
                                    room.id
                                  }
                                >
                                  {
                                    room.name
                                  }
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                      )}
                    </div>


                    {diagLoading && (
                      <p className="diagnosis-status">
                        Checking this
                        combination…
                      </p>
                    )}


                    {diagError && (
                      <p className="diagnosis-error">
                        {diagError}
                      </p>
                    )}


                    {diagResult && (
                      <div className="diagnostics-section diagnostics-section-spaced">
                        <StakeholderViolationsPanel
                          violations={
                            diagResult.violations
                          }
                          proposedSlots={
                            caseBProposedSlots
                          }
                          excludeSessionId={
                            excludeSessionId
                          }
                          lecturers={
                            lecturers
                          }
                          rooms={
                            rooms
                          }
                          cohorts={
                            cohorts
                          }
                          sessions={
                            sessions
                          }
                          lecturerUnavailableSlotMap={
                            lecturerUnavailableSlotMap
                          }
                          formatViolationNice={
                            formatViolationNice
                          }
                          isRelaxableViolation={
                            isRelaxableViolation
                          }
                        />
                      </div>
                    )}
                  </div>
                )}

                </div>
              )}
            </section>


            {/* 3. Recovery */}

            <section className="infeasible-section-card recovery-card">
              <button
                type="button"
                className="infeasible-section-heading"
                onClick={() => setRecoveryOpen((open) => !open)}
                aria-expanded={recoveryOpen}
                style={{
                  width: "100%",
                  border: 0,
                  padding: 0,
                  background: "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "16px",
                }}
              >
                <div>
                  <span className="infeasible-eyebrow">
                    RECOVERY OPTIONS
                  </span>



                </div>

                {recoveryOpen ? (
                  <ChevronUp size={20} aria-hidden="true" />
                ) : (
                  <ChevronDown size={20} aria-hidden="true" />
                )}
              </button>


              {recoveryOpen && (
                <>
                  {firstUnrelaxableViolation &&
                    !canRelax &&
                    !canRearrange && (
                    <div
                      style={{
                        marginTop: "18px",
                        padding: "14px 16px",
                        border: "1px solid #f0b8b8",
                        borderRadius: "10px",
                        background: "#fff7f7",
                      }}
                    >
                      <strong
                        style={{
                          color: "#9f2929",
                        }}
                      >
                        This slot cannot be recovered.
                      </strong>

                      <div
                        style={{
                          marginTop: "4px",
                          color: "#374151",
                        }}
                      >
                        {formatViolationNice(firstUnrelaxableViolation)}. This
                        constraint cannot be relaxed.
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: "14px",
                      marginTop: "18px",
                    }}
                  >
                    {/* LEFT — RELAXATION ONLY */}
                    <div
                      className={`recovery-option ${!canRelax ? "disabled" : ""}`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        minHeight: "260px",
                        padding: "18px",
                      }}
                    >
                      <div className="recovery-option-icon">
                        <SlidersHorizontal size={20} />
                      </div>

                      <div style={{ marginTop: "14px" }}>
                        <div className="recovery-title-with-status">
                          <h4>Relax constraints only</h4>

                          {!canRelax && (
                            <span className="recovery-unavailable-badge">
                              Not available
                            </span>
                          )}
                        </div>

                        <p>
                          Keep the rest of the timetable unchanged and relax the
                          constraints blocking this request.
                        </p>

                        {canRelax ? (
                          <div style={{ marginTop: "12px" }}>
                            <strong>Constraints to relax:</strong>
                            <ul
                              style={{
                                margin: "8px 0 0",
                                paddingLeft: "20px",
                              }}
                            >
                              {activeViolations.map((violation, index) => (
                                <li
                                  key={`${violation.type}-${index}`}
                                  style={{ marginBottom: "4px" }}
                                >
                                  {formatViolationNice(violation)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : firstUnrelaxableViolation ? (
                          <span className="recovery-disabled-reason">
                            Relaxation alone cannot resolve this request.{" "}
                            {formatViolationNice(firstUnrelaxableViolation)} is
                            unrelaxable.
                          </span>
                        ) : (
                          <span className="recovery-disabled-reason">
                            No relaxation-only recovery is available.
                          </span>
                        )}
                      </div>

                      <div style={{ marginTop: "auto", paddingTop: "20px" }}>
                        <button
                          type="button"
                          className="retry-with-relaxations-button"
                          disabled={
                            !canRelax ||
                            solverLoading ||
                            temporaryDeactivations.length === 0
                          }
                          onClick={() =>
                            onRetryWithRelaxations(temporaryDeactivations)
                          }
                          style={{
                            background: canRelax ? "#2563eb" : undefined,
                            color: canRelax ? "#ffffff" : undefined,
                            borderColor: canRelax ? "#2563eb" : undefined,
                          }}
                        >
                          Accept recovery
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>

                    {/* MIDDLE — MIXED RECOVERY */}
                    <div
                      className={`recovery-option ${!canMixedRecovery ? "disabled" : ""}`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        minHeight: "260px",
                        padding: "18px",
                      }}
                    >
                      <div className="recovery-option-icon">
                        <SlidersHorizontal size={20} />
                      </div>

                      <div style={{ marginTop: "14px" }}>
                        <div className="recovery-title-with-status">
                          <h4>Mixed recovery</h4>
                          {!canMixedRecovery && (
                            <span className="recovery-unavailable-badge">
                              Not available
                            </span>
                          )}
                        </div>

                        <p>
                          Allow some timetable changes and some constraint
                          relaxations.
                        </p>

                        {canMixedRecovery ? (
                          <span className="recovery-protection">
                            You decide what the system is allowed to change.
                          </span>
                        ) : (
                          <span className="recovery-disabled-reason">
                            The current blocker cannot be resolved here.
                          </span>
                        )}
                      </div>

                      <div style={{ marginTop: "auto", paddingTop: "20px" }}>
                       <button
                          type="button"
                          className="find-rearrangements-button"
                          disabled={!canMixedRecovery || solverLoading}
                          onClick={async () => {
                              if (!mixedRecoveryOpen) {
                                await loadRelaxableConstraints();
                              }

                              setMixedRecoveryOpen((open) => !open);
                            }}
                            >
                          {mixedRecoveryOpen
                            ? "Close configuration"
                            : "Configure recovery"}

                          {mixedRecoveryOpen ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ArrowRight size={16} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* RIGHT — PERTURBATION ONLY */}
                    <div
                      className={`recovery-option ${!canRearrange ? "disabled" : ""}`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        minHeight: "260px",
                        padding: "18px",
                      }}
                    >
                      <div className="recovery-option-icon">
                        <RefreshCw size={20} />
                      </div>

                      <div style={{ marginTop: "14px" }}>
                        <div className="recovery-title-with-status">
                          <h4>Perturbations only</h4>

                          {!canRearrange && (
                            <span className="recovery-unavailable-badge">
                              Not available
                            </span>
                          )}
                        </div>

                        <p>
                          Keep all constraints enforced and move other classes to
                          make this request possible.
                        </p>

                        {canRearrange ? (
                          <>
                            <span className="recovery-protection">
                              No constraints will be relaxed.
                            </span>

                            {minimumPerturbations !== null && !perturbationPreview && (
                              <p style={{ marginTop: "10px" }}>
                                Minimum additional classes affected:{" "}
                                <strong>{minimumPerturbations}</strong>
                              </p>
                            )}

                        {perturbationPreview?.status === "feasible" &&
                          perturbationPreview.additional_changes &&
                          perturbationPreview.additional_changes.length > 0 && (
                            <div
                              style={{
                                marginTop: "18px",
                                paddingTop: "16px",
                                borderTop: "1px solid #d9e0ea",
                              }}
                            >
                              <strong
                                style={{
                                  display: "block",
                                  fontSize: "16px",
                                  marginBottom: "16px",
                                }}
                              >
                                Proposed rearrangement
                              </strong>

                              {/* PRIMARY CHANGE */}
                              <div
                                style={{
                                  padding: "14px",
                                  border: "1px solid #c7d2fe",
                                  borderRadius: "10px",
                                  background: "#f8faff",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    color: "#4f46e5",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                    marginBottom: "6px",
                                  }}
                                >
                                  Primary change · Your request
                                </div>

                                <strong>
                                  {selectedModuleLabel ?? selectedEventFallbackId}
                                </strong>

                                {/* TIME */}
                                <div style={{ marginTop: "12px" }}>
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 600,
                                      color: "#64748b",
                                    }}
                                  >
                                    Time
                                  </div>

                                  <div>
                                    {selectedEventDayTime ?? "—"}
                                    {" → "}
                                    {requestedTimeLabel}
                                  </div>
                                </div>

                                {/* ROOM */}
                                <div style={{ marginTop: "8px" }}>
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 600,
                                      color: "#64748b",
                                    }}
                                  >
                                    Room
                                  </div>

                                  <div>
                                    {selectedEventRoom ?? "—"}
                                    {" → "}
                                    {requestedRoomLabel}
                                  </div>
                                </div>

                                {/* LECTURER */}
                                <div style={{ marginTop: "8px" }}>
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 600,
                                      color: "#64748b",
                                    }}
                                  >
                                    Lecturer
                                  </div>

                                  <div>
                                    {selectedEventLecturerName ?? "—"}
                                    {" → "}
                                    {requestedLecturerLabel}
                                  </div>
                                </div>
                              </div>

                              {/* ADDITIONAL CHANGES */}
                              <div
                                style={{
                                  marginTop: "18px",
                                  paddingTop: "16px",
                                  borderTop: "1px solid #e5e7eb",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    color: "#64748b",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                  }}
                                >
                                  Additional changes
                                </div>

                                <p style={{ margin: "6px 0 0" }}>
                                  {perturbationPreview.additional_changes.length} other{" "}
                                  {perturbationPreview.additional_changes.length === 1
                                    ? "class must be moved"
                                    : "classes must be moved"}{" "}
                                  to make your request possible.
                                </p>

                                {perturbationPreview.additional_changes.map((change) => {
                                  const session = getAdditionalChangeSession(
                                    change.session_id,
                                  );

                                  return (
                                    <div
                                    key={change.session_id}
                                    style={{
                                          marginTop: "14px",
                                          padding: "14px",
                                          border: "1px solid #f3d69a",
                                          borderRadius: "10px",
                                          background: "#fff8e6",
                                        }}
                                    >
                                   <div>
                                                      <strong
                                                        style={{
                                                          display: "block",
                                                          fontSize: "16px",
                                                        }}
                                                      >
                                                        {getAdditionalChangeSessionLabel(
                                                          change.session_id,
                                                        )}
                                                      </strong>

                                                      {session && (
                                                        <div
                                                          style={{
                                                            marginTop: "6px",
                                                            fontSize: "13px",
                                                            color: "#64748b",
                                                          }}
                                                        >
                                                          <div>
                                                            <strong>Lecturer:</strong>{" "}
                                                            {getLecturerName(session.lecturerId)}
                                                          </div>

                                                          {session.room && (
                                                            <div>
                                                              <strong>Current room:</strong>{" "}
                                                              {session.room}
                                                            </div>
                                                          )}
                                                        </div>
                                                      )}
                                                    </div>

                                    {change.time_changed && (
                                      <div style={{ marginTop: "10px" }}>
                                        <div
                                          style={{
                                            fontSize: "12px",
                                            fontWeight: 600,
                                            color: "#64748b",
                                          }}
                                        >
                                          Time
                                        </div>

                                        <div>
                                          {DAY_LABELS[
                                            change.old_day
                                              .slice(0, 3)
                                              .toLowerCase()
                                          ] ?? change.old_day}{" "}
                                          {change.old_time}
                                          {" → "}
                                          {DAY_LABELS[
                                            change.new_day
                                              .slice(0, 3)
                                              .toLowerCase()
                                          ] ?? change.new_day}{" "}
                                          {change.new_time}
                                        </div>
                                      </div>
                                    )}

                                    {change.room_changed && (
                                      <div style={{ marginTop: "8px" }}>
                                        <div
                                          style={{
                                            fontSize: "12px",
                                            fontWeight: 600,
                                            color: "#64748b",
                                          }}
                                        >
                                          Room
                                        </div>

                                        <div>
                                          {getRoomName(change.old_room_id)}
                                          {" → "}
                                          {getRoomName(change.new_room_id)}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  );
                                })}

                                <p
                                  style={{
                                    marginTop: "14px",
                                    marginBottom: 0,
                                    fontSize: "13px",
                                    color: "#64748b",
                                  }}
                                >
                                  No constraints are relaxed. Lecturers of additional
                                  classes remain unchanged.
                                </p>
                              </div>
                            </div>
                          )}
                          </>
                        ) : (
                          <span className="recovery-disabled-reason">
                            No perturbation-only solution exists while keeping
                            all active constraints enforced.
                          </span>
                        )}
                      </div>

                        {!perturbationPreview && (
                          <div style={{ marginTop: "auto", paddingTop: "20px" }}>
                            <button
                              type="button"
                              className="find-rearrangements-button"
                              disabled={!canRearrange || solverLoading}
                              onClick={onFindRearrangements}
                            >
                              Find rearrangement
                              <ArrowRight size={16} />
                            </button>
                          </div>
                        )}
                    </div>
                  </div>


                  {mixedRecoveryOpen && (
                      <div
                        style={{
                          marginTop: "14px",
                          padding: "22px",
                          background: "#f8fafc",
                          border: "1px solid #d9e0ea",
                          borderRadius: "12px",
                        }}
                      >
                        {/* PERTURBATION LIMIT */}

                        <div>
                          <div
                            style={{
                              fontSize: "12px",
                              fontWeight: 700,
                              color: "#64748b",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            Perturbation limit
                          </div>

                          <div
                            style={{
                              marginTop: "12px",
                              fontWeight: 600,
                            }}
                          >
                            Maximum additional classes that may be moved
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              marginTop: "10px",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setMixedPerturbationLimit((value) =>
                                  Math.max(0, value - 1)
                                )
                              }
                            >
                              −
                            </button>

                            <strong
                              style={{
                                minWidth: "32px",
                                textAlign: "center",
                              }}
                            >
                              {mixedPerturbationLimit}
                            </strong>

                            <button
                              type="button"
                              onClick={() =>
                                setMixedPerturbationLimit((value) => value + 1)
                              }
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div
                          style={{
                            margin: "22px 0",
                            borderTop: "1px solid #d9e0ea",
                          }}
                        />

                        {/* CONSTRAINT RELAXATIONS */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                            gap: "32px",
                            alignItems: "start",
                          }}
                        >
                          {/* LEFT — CONSTRAINT PICKER */}
                          <div>
                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: 700,
                                color: "#64748b",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                              }}
                            >
                              Constraints allowed to relax
                            </div>

                            <p
                              style={{
                                margin: "6px 0 0",
                                color: "#64748b",
                              }}
                            >
                              Select constraints the solver may relax if needed.
                            </p>

                            <div
                              style={{
                                marginTop: "12px",
                                width: "100%",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setAllowedRelaxationsOpen((open) => !open)
                                }
                                style={{
                                  width: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "10px 12px",
                                  background: "#ffffff",
                                  border: "1px solid #d9e0ea",
                                  borderRadius: "8px",
                                  cursor: "pointer",
                                }}
                              >
                                <span>
                                  {allowedRelaxationIds.length} of{" "}
                                  {allRelaxableConstraints.length} constraints allowed to relax
                                </span>

                                {allowedRelaxationsOpen ? (
                                  <ChevronUp size={16} />
                                ) : (
                                  <ChevronDown size={16} />
                                )}
                              </button>

                              {allowedRelaxationsOpen && (
                                <div
                                  style={{
                                    marginTop: "6px",
                                    padding: "6px",
                                    background: "#ffffff",
                                    border: "1px solid #d9e0ea",
                                    borderRadius: "8px",
                                    maxHeight: "320px",
                                    overflowY: "auto",
                                  }}
                                >
                                  {allRelaxableConstraints.map((constraint) => {
                                    const checked =
                                      allowedRelaxationIds.includes(
                                        constraint.instance_id,
                                      );

                                    return (
                                      <label
                                        key={constraint.instance_id}
                                        style={{
                                          display: "flex",
                                          alignItems: "flex-start",
                                          gap: "10px",
                                          padding: "9px",
                                          cursor: "pointer",
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => {
                                            setAllowedRelaxationIds((current) =>
                                              checked
                                                ? current.filter(
                                                    (id) =>
                                                      id !== constraint.instance_id,
                                                  )
                                                : [
                                                    ...current,
                                                    constraint.instance_id,
                                                  ],
                                            );
                                          }}
                                        />

                                        <span>
                                          <strong>
                                            {constraint.constraint_name}
                                          </strong>

                                          <span
                                            style={{
                                              display: "block",
                                              marginTop: "2px",
                                              fontSize: "12px",
                                              color: "#64748b",
                                            }}
                                          >
                                            {constraint.stakeholder_name}
                                            {constraint.day
                                              ? ` · ${
                                                  DAY_LABELS[constraint.day] ??
                                                  constraint.day
                                                }`
                                              : ""}
                                          </span>
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* RIGHT — RELAXATIONS PERMITTED */}
                          <div
                            style={{
                              padding: "16px",
                              border: "1px solid #f3d69a",
                              borderRadius: "10px",
                              background: "#fff8e6",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: 700,
                                color: "#92400e",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                              }}
                            >
                              Relaxations permitted
                            </div>

                            <div
                              style={{
                                marginTop: "6px",
                                fontSize: "14px",
                                fontWeight: 600,
                              }}
                            >
                              {selectedAllowedRelaxations.length} selected
                            </div>

                            {selectedAllowedRelaxations.length === 0 ? (
                              <p
                                style={{
                                  margin: "8px 0 0",
                                  color: "#64748b",
                                }}
                              >
                                No constraint relaxations are currently permitted.
                                All constraints will remain enforced.
                              </p>
                            ) : (
                              <>
                                <p
                                  style={{
                                    margin: "8px 0 0",
                                    color: "#64748b",
                                  }}
                                >
                                  The solver may relax the following constraints if
                                  needed to find a solution. All other constraints
                                  will remain enforced.
                                </p>

                                <div style={{ marginTop: "12px" }}>
                                  {selectedAllowedRelaxations.map((constraint) => (
                                    <div
                                      key={`permitted-${constraint.instance_id}`}
                                      style={{
                                        padding: "10px 0",
                                        borderTop: "1px solid #f3d69a",
                                      }}
                                    >
                                      <strong>
                                        {constraint.constraint_name}
                                      </strong>

                                      <div
                                        style={{
                                          marginTop: "2px",
                                          fontSize: "13px",
                                          color: "#64748b",
                                        }}
                                      >
                                        {constraint.stakeholder_name}
                                        {constraint.day
                                          ? ` · ${
                                              DAY_LABELS[constraint.day] ??
                                              constraint.day
                                            }`
                                          : ""}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <div
                                  style={{
                                    marginTop: "12px",
                                    padding: "10px 12px",
                                    borderRadius: "8px",
                                    background: "#fffbeb",
                                    fontSize: "13px",
                                    color: "#78350f",
                                  }}
                                >
                                  Selecting a constraint does not mean it will
                                  definitely be relaxed. It only gives the solver
                                  permission to relax it if needed.
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                          <div
                            style={{
                              marginTop: "18px",
                              display: "flex",
                              justifyContent: "flex-end",
                            }}
                          >
                            <button
                              type="button"
                              className="find-rearrangements-button"
                              disabled={
                                mixedRecoveryLoading ||
                                !canMixedRecovery
                              }
                              onClick={findMixedRecoverySolution}
                            >
                              {mixedRecoveryLoading
                                ? "Finding solution…"
                                : "Find best solution"}
                              {!mixedRecoveryLoading && (
                                <ArrowRight size={16} />
                              )}
                            </button>
                          </div>

                          {mixedRecoveryError && (
                            <div
                              style={{
                                marginTop: "14px",
                                padding: "12px 14px",
                                border: "1px solid #f0b8b8",
                                borderRadius: "8px",
                                background: "#fff7f7",
                                color: "#9f2929",
                              }}
                            >
                              {mixedRecoveryError}
                            </div>
                          )}

                          {mixedRecoveryResult?.status === "infeasible" && (
                            <div
                              style={{
                                marginTop: "14px",
                                padding: "14px",
                                border: "1px solid #f0b8b8",
                                borderRadius: "10px",
                                background: "#fff7f7",
                              }}
                            >
                              <strong>No mixed recovery solution found.</strong>
                              <div style={{ marginTop: "4px", color: "#64748b" }}>
                                {mixedRecoveryResult.reason ??
                                  "Try allowing more perturbations or permitting additional relaxations."}
                              </div>
                            </div>
                          )}

                          {mixedRecoveryResult?.status === "feasible" && (
                            <div
                              style={{
                                marginTop: "20px",
                                paddingTop: "20px",
                                borderTop: "1px solid #d9e0ea",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  color: "#64748b",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                Mixed recovery solution
                              </div>

                              {/* PRIMARY REQUEST */}
                              <div
                                style={{
                                  marginTop: "12px",
                                  padding: "14px",
                                  border: "1px solid #c7d2fe",
                                  borderRadius: "10px",
                                  background: "#f8faff",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    color: "#4f46e5",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                    marginBottom: "6px",
                                  }}
                                >
                                  Primary change · Your request
                                </div>

                                <strong>
                                  {selectedModuleLabel ?? selectedEventFallbackId}
                                </strong>

                                <div style={{ marginTop: "10px" }}>
                                  <strong>Time:</strong>{" "}
                                  {selectedEventDayTime ?? "—"} →{" "}
                                  {mixedRecoveryResult.day
                                    ? `${
                                        DAY_LABELS[
                                          mixedRecoveryResult.day
                                            .slice(0, 3)
                                            .toLowerCase()
                                        ] ?? mixedRecoveryResult.day
                                      } ${mixedRecoveryResult.time ?? ""}`
                                    : requestedTimeLabel}
                                </div>

                                <div style={{ marginTop: "6px" }}>
                                  <strong>Room:</strong>{" "}
                                  {selectedEventRoom ?? "—"} →{" "}
                                  {mixedRecoveryResult.room_id
                                    ? getRoomName(mixedRecoveryResult.room_id)
                                    : requestedRoomLabel}
                                </div>

                                <div style={{ marginTop: "6px" }}>
                                  <strong>Lecturer:</strong>{" "}
                                  {selectedEventLecturerName ?? "—"} →{" "}
                                  {mixedRecoveryResult.lecturer_id
                                    ? getLecturerName(
                                        mixedRecoveryResult.lecturer_id,
                                      )
                                    : requestedLecturerLabel}
                                </div>
                              </div>

                              {/* PERTURBATIONS */}
                              <div
                                style={{
                                  marginTop: "16px",
                                  padding: "14px",
                                  border: "1px solid #f3d69a",
                                  borderRadius: "10px",
                                  background: "#fff8e6",
                                }}
                              >
                                <strong>
                                  Additional classes moved ·{" "}
                                  {mixedRecoveryResult.perturbation_count ?? 0} of{" "}
                                  {mixedPerturbationLimit} permitted
                                </strong>

                                {(mixedRecoveryResult.additional_changes?.length ??
                                  0) === 0 ? (
                                  <p style={{ margin: "8px 0 0", color: "#64748b" }}>
                                    No other classes needed to move.
                                  </p>
                                ) : (
                                  mixedRecoveryResult.additional_changes!.map(
                                    (change) => (
                                      <div
                                        key={change.session_id}
                                        style={{
                                          marginTop: "12px",
                                          paddingTop: "12px",
                                          borderTop: "1px solid #f3d69a",
                                        }}
                                      >
                                        <strong>
                                          {getAdditionalChangeSessionLabel(
                                            change.session_id,
                                          )}
                                        </strong>

                                        {change.time_changed && (
                                          <div style={{ marginTop: "6px" }}>
                                            Time:{" "}
                                            {DAY_LABELS[
                                              change.old_day
                                                .slice(0, 3)
                                                .toLowerCase()
                                            ] ?? change.old_day}{" "}
                                            {change.old_time} →{" "}
                                            {DAY_LABELS[
                                              change.new_day
                                                .slice(0, 3)
                                                .toLowerCase()
                                            ] ?? change.new_day}{" "}
                                            {change.new_time}
                                          </div>
                                        )}

                                        {change.room_changed && (
                                          <div style={{ marginTop: "4px" }}>
                                            Room:{" "}
                                            {getRoomName(change.old_room_id)} →{" "}
                                            {getRoomName(change.new_room_id)}
                                          </div>
                                        )}
                                      </div>
                                    ),
                                  )
                                )}
                              </div>

                              {/* ACTUAL RELAXATIONS USED */}
                              <div
                                style={{
                                  marginTop: "16px",
                                  padding: "14px",
                                  border: "1px solid #f3d69a",
                                  borderRadius: "10px",
                                  background: "#fffbeb",
                                }}
                              >
                                <strong>
                                  Constraint relaxations used ·{" "}
                                  {mixedRecoveryResult.relaxation_count ?? 0}
                                </strong>

                                {(mixedRecoveryResult.used_relaxations?.length ??
                                  0) === 0 ? (
                                  <p style={{ margin: "8px 0 0", color: "#64748b" }}>
                                    None of the permitted relaxations were needed.
                                  </p>
                                ) : (
                                  mixedRecoveryResult.used_relaxations!.map(
                                    (relaxation, index) => {
                                      const matchingConstraint =
                                        allRelaxableConstraints.find(
                                          (constraint) =>
                                            constraint.constraint_id ===
                                              relaxation.constraint_id &&
                                            constraint.instance_type ===
                                              relaxation.instance_type &&
                                            constraint.stakeholder_id ===
                                              relaxation.instance_id &&
                                            constraint.day === relaxation.day,
                                        );

                                      return (
                                        <div
                                          key={`${relaxation.constraint_id}-${relaxation.instance_id}-${relaxation.day ?? "all"}-${index}`}
                                          style={{
                                            marginTop: "10px",
                                            paddingTop: "10px",
                                            borderTop: "1px solid #f3d69a",
                                          }}
                                        >
                                          <strong>
                                            {matchingConstraint?.constraint_name ??
                                              getTemporaryConstraintLabel(
                                                relaxation.constraint_id,
                                              )}
                                          </strong>
                                          <div
                                            style={{
                                              marginTop: "2px",
                                              fontSize: "13px",
                                              color: "#64748b",
                                            }}
                                          >
                                            {matchingConstraint?.stakeholder_name ??
                                              relaxation.instance_id}
                                            {relaxation.day
                                              ? ` · ${
                                                  DAY_LABELS[relaxation.day] ??
                                                  relaxation.day
                                                }`
                                              : ""}
                                          </div>
                                        </div>
                                      );
                                    },
                                  )
                                )}
                              </div>

                              <p
                                style={{
                                  margin: "12px 0 0",
                                  fontSize: "13px",
                                  color: "#64748b",
                                }}
                              >
                                Only relaxations actually used by the final
                                solution are shown above.
                              </p>
                            </div>
                          )}
                        </div>
                    )}
                  <div
                    style={{
                      marginTop: "16px",
                      paddingTop: "14px",
                      borderTop: "1px solid #d9e0ea",
                    }}
                  >
                    <button
                      type="button"
                      className="back-to-request-button"
                      onClick={onBackToRequest}
                    >
                      Choose a different time, room, or lecturer
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
    </>
  );
}