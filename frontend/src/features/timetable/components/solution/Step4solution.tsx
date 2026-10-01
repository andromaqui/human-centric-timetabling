import { useEffect, useState, useMemo, useRef } from "react";
import {
  ArrowRight,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  GitCompareArrows,
  RefreshCw,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";

import { StakeholderViolationsPanel } from "./StakeholderViolationsPanel";
import { HistoricalImpactSummary } from "../../../impact/components/HistoricalImpactSummary";
import { api } from "../../../../shared/api/client";
import { PerturbationImpactModal, type PerturbationImpact,} from "./PerturbationImpactModal";
import { PerturbationImpactComparisonModal } from "./PerturbationImpactComparisonModal";

import {
  fetchHistoricalImpacts,
  type HistoricalImpact,
  type HistoricalImpactType,
  type HistoricalStakeholderType,
} from "./historicalImpacts";

import "./Step4solution.css";
import { RequestedChangeSummary } from "../RequestedChangeSummary";
import { RoomCapacityVisualisation } from "./RoomCapacityVisualisation";
import { CohortGapVisualisation } from "./CohortGapVisualisation";
import { CohortRoomChangeVisualisation } from "./CohortRoomChangeVisualisation";

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


type PerturbationAlternative = {
  rank: number;
  objective_score: number | null;
  session_id: string;
  start_slot: number;
  day: string;
  time: string;
  room_id: string;
  lecturer_id: string;
  perturbation_count: number;
  additional_changes: AdditionalChange[];
  proven_optimal_for_remaining_model?: boolean;
  impact?: PerturbationImpact;
};

type PerturbationAlternativesResponse = {
  status: "feasible" | "infeasible" | "invalid";
  reason: string | null;
  minimum_perturbations: number | null;
  solution_count?: number;
  solutions: PerturbationAlternative[];
};

type RecoveryOptions = {
  can_perturb: boolean | null;
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

type AnyMinimumRelaxationResult = {
  status: "feasible" | "infeasible" | "invalid";
  reason?: string | null;
  minimum_relaxations?: number | null;
  relaxations?: TemporaryConstraintDeactivation[];
  start_slot?: number;
  day?: string;
  time?: string;
  room_id?: string;
  lecturer_id?: string;
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
  protected_constraints?: TemporaryConstraintDeactivation[];
  used_relaxations?: TemporaryConstraintDeactivation[];
  relaxation_count?: number;
  minimum_relaxations?: number;
  minimum_perturbations?: number;
  objective_score?: number | null;
  objective_components?: {
    room_waste: number;
    cohort_gaps: number;
    lecturer_idle: number;
    cohort_room_changes: number;
  };
  impact?: PerturbationImpact;
};

type MixedRecoveryGuidance = {
  status: "analysed" | "invalid";
  case?: string;
  relax_only?: {
    feasible: boolean;
    relaxation_count: number | null;
    perturbation_count: number | null;
  };
  perturb_only?: {
    feasible: boolean;
    relaxation_count: number | null;
    perturbation_count: number | null;
  };
  suggested_mixed?: {
    max_perturbations: number | null;
    relaxation_count: number | null;
    reason: string | null;
  };
  suggested_solution?: MixedRecoveryResult | null;
  auto_protected_constraint_types?: string[];
  auto_protected_constraints?: TemporaryConstraintDeactivation[];
  protected_constraints?: TemporaryConstraintDeactivation[];
  reason?: string | null;
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
      objective_score?: number | null;
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
  capacity?: number;
};

type ModuleLike = {
  id: string;
  code?: string;
  name?: string;
  title?: string;
  requiredCapacity?: number | null;
  required_capacity?: number | null;
};


type SessionLike = {
  id: string;
  moduleId?: string;
  lecturerId: string;
  room?: string;
  roomId?: string | null;
  cohortIds: string[];
  start?: string;
  end?: string;
  day?: string;
  time?: string;
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

export type StoredSolutionCandidate = {
  key: string;
  source: "direct" | "perturbation" | "mixed";
  label: string;
  session_id: string;
  day?: string;
  time?: string;
  room_id?: string;
  lecturer_id?: string;
  objective_score?: number | null;
  additional_changes: AdditionalChange[];
  relaxations: TemporaryConstraintDeactivation[];
  // Preserve the exact impact object used by View impacts / Compare impacts.
  impact?: PerturbationImpact;
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
  minimumPerturbationLoading: boolean;
  solverError: string | null;
  solverResult: RescheduleResponse | null;
  perturbationAlternatives: PerturbationAlternativesResponse | null;
  mixedRecoveryRequest: RescheduleRequest;
  anyRelaxationResult: AnyMinimumRelaxationResult | null;
  anyRelaxationLoading: boolean;
  anyRelaxationError: string | null;
  onFindMinimumRelaxation: () => void | Promise<void>;

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

  onFindRearrangements: () => void | Promise<void>;

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

  onStoreSolution: (solution: StoredSolutionCandidate) => void;
  storedSolutionKeys: string[];
};


export function Step4Solution({
  solverLoading,
  minimumPerturbationLoading,
  solverError,
  solverResult,
  perturbationAlternatives,
  mixedRecoveryRequest,
  anyRelaxationResult,
  anyRelaxationLoading,
  anyRelaxationError,
  onFindMinimumRelaxation,

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
  onStoreSolution,
  storedSolutionKeys,
}: Step4SolutionProps) {
  const [
    selectedRecoveryOption,
    setSelectedRecoveryOption,
  ] = useState<RecoveryOption | null>(null);

  const [explanationOpen, setExplanationOpen] = useState(true);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [perturbationResultsMinimized, setPerturbationResultsMinimized] = useState(false);
  const [mixedResultsMinimized, setMixedResultsMinimized] = useState(false);
  const [mixedSolutionMinimized, setMixedSolutionMinimized] = useState(false);
  const [mixedConfigurationMinimized, setMixedConfigurationMinimized] = useState(false);

  const [mixedRecoveryOpen, setMixedRecoveryOpen] = useState(false);
  const [rearrangementsLoading, setRearrangementsLoading] = useState(false);
  const autoRearrangementsStartedRef = useRef(false);
  const [mixedPerturbationLimit, setMixedPerturbationLimit] = useState(0);
  const [mixedGuidance, setMixedGuidance] = useState<MixedRecoveryGuidance | null>(null);
  const [mixedGuidanceLoading, setMixedGuidanceLoading] = useState(false);
  const [mixedGuidanceError, setMixedGuidanceError] = useState<string | null>(null);

  const [relaxableConstraints, setRelaxableConstraints] = useState<RelaxableConstraintGroups | null>(null);
  const [protectedConstraintIds, setProtectedConstraintIds] = useState<string[]>([]);
  const [protectedConstraintsOpen, setProtectedConstraintsOpen] = useState(false);
  const [constraintSearch, setConstraintSearch] = useState("");
  const [expandedConstraintTypes, setExpandedConstraintTypes] = useState<string[]>([]);
  const [protectedSummaryOpen, setProtectedSummaryOpen] = useState(false);
  const [mixedRecoveryLoading, setMixedRecoveryLoading] = useState(false);
  const [mixedRecoveryError, setMixedRecoveryError] = useState<string | null>(null);
  const [mixedRecoveryResult, setMixedRecoveryResult] = useState<MixedRecoveryResult | null>(null);
  const [selectedPerturbationImpact, setSelectedPerturbationImpact] = useState<PerturbationImpact | null>(null);
  const [showImpactComparison, setShowImpactComparison] = useState(false);

  function isStored(key: string) {
    return storedSolutionKeys.includes(key);
  }

  function storeButton(candidate: StoredSolutionCandidate, inline = false) {
    const stored = isStored(candidate.key);
    return (
      <button
        type="button"
        className="find-rearrangements-button"
        disabled={stored}
        onClick={() => onStoreSolution(candidate)}
        style={{ width: "auto", marginTop: inline ? 0 : "14px" }}
      >
        {stored ? "Stored" : "Store"}
      </button>
    );
  }
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


async function loadRelaxableConstraints(): Promise<RelaxableConstraintGroups> {
  if (relaxableConstraints) {
    return relaxableConstraints;
  }

  const data = await api.get<RelaxableConstraintGroups>(
    "/constraints/relaxable-instances",
  );

  setRelaxableConstraints(data);
  return data;
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

const selectedProtectedConstraints = allRelaxableConstraints.filter(
  (constraint) =>
    protectedConstraintIds.includes(getProtectionKey(constraint)),
);

const groupedProtectedConstraints = useMemo(() => {
  type StakeholderGroup = {
    key: string;
    name: string;
    days: string[];
    count: number;
  };

  type ConstraintGroup = {
    id: string;
    name: string;
    stakeholders: StakeholderGroup[];
    count: number;
  };

  const constraintMap = new Map<
    string,
    {
      id: string;
      name: string;
      stakeholders: Map<string, StakeholderGroup>;
      count: number;
    }
  >();

  for (const constraint of selectedProtectedConstraints) {
    let constraintGroup = constraintMap.get(constraint.constraint_id);

    if (!constraintGroup) {
      constraintGroup = {
        id: constraint.constraint_id,
        name: constraint.constraint_name,
        stakeholders: new Map(),
        count: 0,
      };
      constraintMap.set(constraint.constraint_id, constraintGroup);
    }

    constraintGroup.count += 1;

    const stakeholderKey = `${constraint.instance_type}:${constraint.stakeholder_id}`;
    let stakeholderGroup = constraintGroup.stakeholders.get(stakeholderKey);

    if (!stakeholderGroup) {
      stakeholderGroup = {
        key: stakeholderKey,
        name: constraint.stakeholder_name,
        days: [],
        count: 0,
      };
      constraintGroup.stakeholders.set(stakeholderKey, stakeholderGroup);
    }

    stakeholderGroup.count += 1;

    if (constraint.day) {
      const dayKey = constraint.day.slice(0, 3).toLowerCase();
      const dayLabel = DAY_LABELS[dayKey] ?? constraint.day;

      if (!stakeholderGroup.days.includes(dayLabel)) {
        stakeholderGroup.days.push(dayLabel);
      }
    }
  }

  const dayOrder = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ];

  return Array.from(constraintMap.values())
    .map(
      (constraintGroup): ConstraintGroup => ({
        id: constraintGroup.id,
        name: constraintGroup.name,
        count: constraintGroup.count,
        stakeholders: Array.from(constraintGroup.stakeholders.values())
          .map((stakeholder) => ({
            ...stakeholder,
            days: [...stakeholder.days].sort(
              (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b),
            ),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}, [selectedProtectedConstraints]);

type PickerConstraint = (typeof allRelaxableConstraints)[number];

function getProtectionKey(constraint: PickerConstraint) {
  return [
    constraint.constraint_id,
    constraint.instance_type,
    constraint.stakeholder_id,
    constraint.day ?? "",
  ].join("::");
}
type PickerStakeholderGroup = { key: string; name: string; constraints: PickerConstraint[] };
type PickerConstraintGroup = { key: string; id: string; name: string; constraints: PickerConstraint[]; stakeholders: PickerStakeholderGroup[] };
type PickerStakeholderTypeGroup = { type: PickerConstraint["instance_type"]; label: string; constraints: PickerConstraint[]; constraintGroups: PickerConstraintGroup[] };

const pickerDayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
function getPickerDayLabel(day: string | null) {
  if (!day) return null;
  return DAY_LABELS[day.slice(0, 3).toLowerCase()] ?? day;
}

const groupedConstraintPicker = useMemo<PickerStakeholderTypeGroup[]>(() => {
  const search = constraintSearch.trim().toLowerCase();
  const visible = allRelaxableConstraints.filter((constraint) => !search || [
    constraint.constraint_name, constraint.stakeholder_name, constraint.instance_type,
    getPickerDayLabel(constraint.day) ?? "",
  ].some((value) => value.toLowerCase().includes(search)));

  const typeConfig: Array<{ type: PickerConstraint["instance_type"]; label: string }> = [
    { type: "lecturer", label: "Lecturer constraints" },
    { type: "cohort", label: "Cohort constraints" },
    { type: "session", label: "Session constraints" },
  ];

  return typeConfig.map(({ type, label }) => {
    const typeConstraints = visible.filter((constraint) => constraint.instance_type === type);
    const byConstraint = new Map<string, PickerConstraint[]>();
    for (const constraint of typeConstraints) byConstraint.set(constraint.constraint_id, [...(byConstraint.get(constraint.constraint_id) ?? []), constraint]);
    const constraintGroups = Array.from(byConstraint.entries()).map(([constraintId, constraints]) => {
      const byStakeholder = new Map<string, PickerConstraint[]>();
      for (const constraint of constraints) {
        const key = `${constraint.instance_type}:${constraint.stakeholder_id}`;
        byStakeholder.set(key, [...(byStakeholder.get(key) ?? []), constraint]);
      }
      return {
        key: `${type}:${constraintId}`, id: constraintId, name: constraints[0]?.constraint_name ?? constraintId, constraints,
        stakeholders: Array.from(byStakeholder.entries()).map(([key, stakeholderConstraints]) => ({
          key, name: stakeholderConstraints[0]?.stakeholder_name ?? stakeholderConstraints[0]?.stakeholder_id ?? key,
          constraints: [...stakeholderConstraints].sort((a,b) => {
            const ad=getPickerDayLabel(a.day), bd=getPickerDayLabel(b.day);
            if (!ad && !bd) return 0; if (!ad) return -1; if (!bd) return 1;
            return pickerDayOrder.indexOf(ad)-pickerDayOrder.indexOf(bd);
          }),
        })).sort((a,b)=>a.name.localeCompare(b.name)),
      };
    }).sort((a,b)=>a.name.localeCompare(b.name));
    return { type, label, constraints: typeConstraints, constraintGroups };
  }).filter((group)=>group.constraints.length>0);
}, [allRelaxableConstraints, constraintSearch]);

function getProtectedCount(constraints: PickerConstraint[]) {
  return constraints.reduce(
    (count, constraint) =>
      count +
      (protectedConstraintIds.includes(getProtectionKey(constraint)) ? 1 : 0),
    0,
  );
}

function setConstraintsProtected(
  constraints: PickerConstraint[],
  shouldProtect: boolean,
) {
  const affectedIds = new Set(constraints.map(getProtectionKey));

  const nextIds = shouldProtect
    ? Array.from(
        new Set([
          ...protectedConstraintIds,
          ...Array.from(affectedIds),
        ]),
      )
    : protectedConstraintIds.filter((id) => !affectedIds.has(id));

  setProtectedConstraintIds(nextIds);
  setMixedRecoveryResult(null);
}
function toggleConstraintTypeOpen(key: string) {
  setExpandedConstraintTypes((current) => current.includes(key) ? current.filter((item)=>item!==key) : [...current,key]);
}
function setIndeterminate(element: HTMLInputElement | null, checkedCount: number, totalCount: number) {
  if (element) element.indeterminate = checkedCount > 0 && checkedCount < totalCount;
}

function flattenRelaxableConstraints(groups: RelaxableConstraintGroups) {
  return [
    ...groups.lecturer.map((constraint) => ({ ...constraint, instance_type: "lecturer" as const })),
    ...groups.cohort.map((constraint) => ({ ...constraint, instance_type: "cohort" as const })),
    ...groups.session.map((constraint) => ({ ...constraint, instance_type: "session" as const })),
  ];
}

function buildProtectedConstraintPayload(
  ids: string[],
  constraints = allRelaxableConstraints,
): TemporaryConstraintDeactivation[] {
  return constraints
    .filter((constraint) => ids.includes(getProtectionKey(constraint)))
    .map((constraint) => ({
      constraint_id: constraint.constraint_id,
      instance_type: constraint.instance_type,
      instance_id: constraint.stakeholder_id,
      day: constraint.day,
    }));
}

async function refreshMixedRecoveryGuidance(
  ids: string[],
  constraints = allRelaxableConstraints,
) {
  setMixedGuidanceLoading(true);
  setMixedGuidanceError(null);
  setMixedRecoveryResult(null);

  try {
    const protectedConstraints = buildProtectedConstraintPayload(ids, constraints);
    const result = await api.post<MixedRecoveryGuidance>(
      "/solver/reschedule/mixed/guidance",
      {
        request: {
          ...mixedRecoveryRequest,
          temporarily_deactivated_constraints: [],
          max_additional_changes: null,
        },
        // Guidance does not use this budget; the shared request schema requires it.
        max_perturbations: 0,
        protected_constraints: protectedConstraints,
      },
    );

    setMixedGuidance(result);
    setMixedRecoveryResult(result.suggested_solution ?? null);

    const suggestedBudget =
      result.suggested_mixed?.max_perturbations;

    if (typeof suggestedBudget === "number") {
      setMixedPerturbationLimit(suggestedBudget);
    }
  } catch (error) {
    console.error("Failed to load mixed recovery guidance:", error);
    setMixedGuidanceError(
      error instanceof Error
        ? error.message
        : "Could not calculate recovery guidance.",
    );
  } finally {
    setMixedGuidanceLoading(false);
  }
}

async function findMixedRecoverySolution() {
  setMixedRecoveryLoading(true);
  setMixedRecoveryError(null);
  setMixedRecoveryResult(null);

  try {
    // The user selects constraints that MUST remain enforced.
    //
    // IMPORTANT:
    // The checkbox uses the database constraint-instance row id,
    // but the mixed solver expects the stakeholder/entity id:
    //   - lecturer id for lecturer constraints
    //   - cohort id for cohort constraints
    //   - session id for session constraints
    const protectedConstraints: TemporaryConstraintDeactivation[] =
      selectedProtectedConstraints.map((constraint) => ({
        constraint_id: constraint.constraint_id,
        instance_type: constraint.instance_type,
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

        // All relaxable constraints may be relaxed unless
        // the user explicitly protects them.
        protected_constraints: protectedConstraints,
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
  const activeViolations = useMemo<Violation[]>(() => {
    if (needsInteractiveDiagnosis) {
      return diagResult?.violations ?? [];
    }

    if (solverResult && solverResult.status !== "feasible") {
      return solverResult.diagnostics?.violations ?? [];
    }

    return [];
  }, [needsInteractiveDiagnosis, diagResult, solverResult]);


  const hasActiveDiagnosis =
    activeViolations.length > 0;

  const requestContainsFind =
    mixedRecoveryRequest.time_mode === "find" ||
    mixedRecoveryRequest.room_mode === "find" ||
    mixedRecoveryRequest.lecturer_mode === "find";

  // Start mixed-recovery guidance automatically as soon as an infeasible,
  // diagnosed request reaches Step 4. This is independent from the separate
  // minimum-perturbation request.
  const mixedRecoveryRequestKey = useMemo(
    () => JSON.stringify(mixedRecoveryRequest),
    [mixedRecoveryRequest],
  );

  useEffect(() => {
    setMixedGuidance(null);
    setMixedGuidanceError(null);
    setMixedRecoveryResult(null);
    setMixedPerturbationLimit(0);
    setMixedRecoveryOpen(false);
    autoRearrangementsStartedRef.current = false;
    setRearrangementsLoading(false);
  }, [mixedRecoveryRequestKey]);

  useEffect(() => {
    if (
      (!requestContainsFind && !hasActiveDiagnosis) ||
      mixedGuidance ||
      mixedGuidanceLoading
    ) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const groups = await loadRelaxableConstraints();
        if (cancelled) return;

        const constraints = flattenRelaxableConstraints(groups);
        await refreshMixedRecoveryGuidance(
          protectedConstraintIds,
          constraints,
        );
      } catch (error) {
        if (cancelled) return;

        console.error(
          "Failed to prepare automatic mixed recovery guidance:",
          error,
        );
        setMixedGuidanceError(
          error instanceof Error
            ? error.message
            : "Could not prepare mixed recovery guidance.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
    // mixedRecoveryRequestKey intentionally resets this effect when the
    // reschedule request changes. Guidance/protection changes are handled
    // explicitly elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasActiveDiagnosis,
    requestContainsFind,
    mixedRecoveryRequestKey,
  ]);


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
      setHistoricalImpactsByKey((current) =>
        Object.keys(current).length === 0 ? current : {},
      );
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
      setHistoricalImpactsByKey((current) =>
        Object.keys(current).length === 0 ? current : {},
      );
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


/*
 * Concrete requests can keep using the lightweight recovery_options gate.
 *
 * FIND / ANY is different: the detailed minimum-perturbation solver must
 * search globally across all allowed target placements. A candidate-level
 * or preliminary `can_perturb: false` must therefore not disable this route.
 * Let /min-perturbation make the authoritative decision instead.
 */
const perturbationAvailability =
  solverResult?.status === "infeasible"
    ? requestContainsFind
      ? true
      : !needsInteractiveDiagnosis
        ? solverResult.recovery_options?.can_perturb ?? null
        : false
    : false;

const checkingPerturbations =
  solverResult?.status === "infeasible" &&
  !requestContainsFind &&
  !needsInteractiveDiagnosis &&
  (minimumPerturbationLoading || perturbationAvailability === null);

const canRearrange =
  solverResult?.status === "infeasible" &&
  (
    requestContainsFind ||
    (!needsInteractiveDiagnosis && perturbationAvailability === true)
  );

const minimumPerturbations =
  solverResult?.status === "infeasible" &&
  !requestContainsFind &&
  !needsInteractiveDiagnosis
    ? solverResult.recovery_options?.minimum_perturbations ?? null
    : null;


  /*
   * Once the lightweight minimum-perturbation check confirms that a
   * perturbation-only recovery exists, automatically load the actual
   * rearrangement alternatives. This keeps Step 4 fast: the page renders
   * first, the minimum is calculated separately, and only then do we ask
   * for the full solution alternatives.
   *
   * The parent owns perturbationAlternatives, so a successful response
   * prevents this effect from running again. rearrangementsLoading also
   * prevents duplicate requests while the alternatives request is active.
   */
  useEffect(() => {
    if (
      !canRearrange ||
      checkingPerturbations ||
      perturbationAlternatives !== null ||
      autoRearrangementsStartedRef.current
    ) {
      return;
    }

    // Mark this request as started before changing state. The previous version
    // depended on rearrangementsLoading; setting it to true immediately ran the
    // effect cleanup, which marked the request as cancelled and prevented the
    // finally block from ever clearing the spinner.
    autoRearrangementsStartedRef.current = true;
    setRearrangementsLoading(true);

    void Promise.resolve(onFindRearrangements())
      .catch((error) => {
        console.error(
          "Failed to automatically load rearrangement alternatives:",
          error,
        );
      })
      .finally(() => {
        setRearrangementsLoading(false);
      });

    // onFindRearrangements is intentionally omitted: the ref guarantees one
    // automatic alternatives request per reschedule request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canRearrange,
    checkingPerturbations,
    perturbationAlternatives,
  ]);


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
  requestContainsFind ||
  (
    hasActiveDiagnosis &&
    unrelaxableViolations.length === 0
  );

  // Concrete requests still use their diagnosed blockers.
  // FIND requests are searched globally by the mixed solver, independently
  // of whichever concrete candidate is selected in the explanation UI.
  const canMixedRecovery =
    requestContainsFind || hasActiveDiagnosis;


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


function getAnyRelaxationConstraintContext(
  constraint: TemporaryConstraintDeactivation,
): string {
  let stakeholder = constraint.instance_id;
  if (constraint.instance_type === "cohort") {
    stakeholder = cohorts.find((item) => item.id === constraint.instance_id)?.name ?? constraint.instance_id;
  } else if (constraint.instance_type === "lecturer") {
    stakeholder = getLecturerName(constraint.instance_id);
  } else if (constraint.instance_type === "room") {
    stakeholder = getRoomName(constraint.instance_id);
  }
  const day = constraint.day
    ? DAY_LABELS[constraint.day.slice(0, 3).toLowerCase()] ?? constraint.day
    : null;
  return day ? `${stakeholder} · ${day}` : stakeholder;
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


  const targetSession = sessions.find(
    (session) => session.id === solverResult?.session_id,
  );

  const roomCapacityRooms = rooms
    .filter((room) => typeof room.capacity === "number")
    .map((room) => ({
      id: room.id,
      name: room.name,
      capacity: room.capacity as number,
    }));

  const roomCapacitySessions = sessions.flatMap((session) => {
    const module = modules.find((item) => item.id === session.moduleId);
    const requiredCapacity =
      module?.requiredCapacity ?? module?.required_capacity ?? null;

    const isTarget = session.id === solverResult?.session_id;
    const roomId = isTarget
      ? solverResult?.room_id ?? session.roomId ?? session.room ?? null
      : session.roomId ?? session.room ?? null;

    const day = isTarget
      ? solverResult?.day ?? session.day
      : session.day;
    const time = isTarget
      ? solverResult?.time ?? session.time
      : session.time;

    if (!roomId || requiredCapacity == null || !day || !time) return [];

    return [{
      id: session.id,
      moduleCode: module?.code ?? module?.id ?? session.moduleId ?? session.id,
      moduleName: module?.name ?? module?.title,
      day: DAY_LABELS[day.slice(0, 3).toLowerCase()] ?? day,
      time,
      roomId,
      requiredCapacity,
    }];
  });

  const cohortGapSessions = sessions.flatMap((session) => {
    const module = modules.find((item) => item.id === session.moduleId);
    const isTarget = session.id === solverResult?.session_id;

    let day = session.day;
    let startTime = session.time;
    let endTime: string | undefined;

    if (session.start) {
      const startDate = new Date(session.start);
      if (!Number.isNaN(startDate.getTime())) {
        day = startDate.toLocaleDateString("en-IE", { weekday: "long" });
        startTime = startDate.toTimeString().slice(0, 5);
      }
    }

    if (session.end) {
      const endDate = new Date(session.end);
      if (!Number.isNaN(endDate.getTime())) {
        endTime = endDate.toTimeString().slice(0, 5);
      }
    }

    if (isTarget && solverResult?.status === "feasible") {
      day = solverResult.day ?? day;
      startTime = solverResult.time ?? startTime;

      // Preserve the target session's existing duration when moving it.
      if (session.start && session.end && startTime) {
        const oldStart = new Date(session.start);
        const oldEnd = new Date(session.end);
        const durationMinutes = Math.round(
          (oldEnd.getTime() - oldStart.getTime()) / 60000,
        );
        const [hours, minutes] = startTime.split(":").map(Number);
        if (Number.isFinite(hours) && Number.isFinite(minutes) && durationMinutes > 0) {
          const total = hours * 60 + minutes + durationMinutes;
          endTime = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
        }
      }
    }

    if (!day || !startTime || !endTime) return [];

    return [{
      id: session.id,
      moduleCode: module?.code ?? module?.id ?? session.moduleId ?? session.id,
      moduleName: module?.name ?? module?.title,
      cohortIds: session.cohortIds,
      day: DAY_LABELS[day.slice(0, 3).toLowerCase()] ?? day,
      startTime,
      endTime,
    }];
  });

  const cohortRoomChangeSessions = sessions.flatMap((session) => {
    const module = modules.find((item) => item.id === session.moduleId);
    const isTarget = session.id === solverResult?.session_id;

    let day = session.day;
    let startTime = session.time;
    let endTime: string | undefined;
    let roomId = session.roomId ?? session.room ?? null;

    if (session.start) {
      const startDate = new Date(session.start);
      if (!Number.isNaN(startDate.getTime())) {
        day = startDate.toLocaleDateString("en-IE", { weekday: "long" });
        startTime = startDate.toTimeString().slice(0, 5);
      }
    }

    if (session.end) {
      const endDate = new Date(session.end);
      if (!Number.isNaN(endDate.getTime())) {
        endTime = endDate.toTimeString().slice(0, 5);
      }
    }

    if (isTarget && solverResult?.status === "feasible") {
      day = solverResult.day ?? day;
      startTime = solverResult.time ?? startTime;
      roomId = solverResult.room_id ?? roomId;

      // Preserve the target session's existing duration when moving it.
      if (session.start && session.end && startTime) {
        const oldStart = new Date(session.start);
        const oldEnd = new Date(session.end);
        const durationMinutes = Math.round(
          (oldEnd.getTime() - oldStart.getTime()) / 60000,
        );

        const [hours, minutes] = startTime.split(":").map(Number);
        if (
          Number.isFinite(hours) &&
          Number.isFinite(minutes) &&
          durationMinutes > 0
        ) {
          const total = hours * 60 + minutes + durationMinutes;
          endTime = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
        }
      }
    }

    if (!day || !startTime || !endTime || !roomId) return [];

    return [{
      id: session.id,
      moduleCode: module?.code ?? module?.id ?? session.moduleId ?? session.id,
      moduleName: module?.name ?? module?.title,
      cohortIds: session.cohortIds,
      day: DAY_LABELS[day.slice(0, 3).toLowerCase()] ?? day,
      startTime,
      endTime,
      roomId,
      roomName: getRoomName(roomId),
    }];
  });

  const initialCohortId = targetSession?.cohortIds?.[0] ?? null;

  return (
    <>
      <style>{`
        @keyframes step4SolverSpin { to { transform: rotate(360deg); } }
        .find-rearrangements-button,
        .back-to-request-button {
          background: #f8fafc !important;
          color: #475569 !important;
          border-color: #cbd5e1 !important;
        }
        .find-rearrangements-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
      `}</style>
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

      {solverResult?.status ==="feasible" && (
          <div className="solution-options">

            {(solverResult.objective_score != null ||
              originalModes?.room === "find" ||
              originalModes?.time === "find") && (
              <section style={{ marginTop: "22px" }}>
                <div
                  style={{
                    padding: "16px",
                    border: "1px solid #d9e0ea",
                    borderRadius: "10px",
                    background: "#f8fafc",
                  }}
                >
                  <div style={{ fontSize: "13px", color: "#64748b" }}>
                    Weighted objective score
                  </div>
                  <div style={{ marginTop: "4px", fontSize: "28px", fontWeight: 700 }}>
                    {solverResult.objective_score ?? "—"}
                  </div>
                  <div style={{ marginTop: "4px", fontSize: "13px", color: "#64748b" }}>
                    Lower scores indicate a lower weighted objective penalty.
                  </div>
                </div>

                <div style={{ marginTop: "22px" }}>
                  <h3 style={{ marginBottom: "6px" }}>Objective impacts</h3>
                  <p className="step-description" style={{ marginTop: 0 }}>
                    Explore the timetable characteristics behind this solution's objective score.
                  </p>

                  {originalModes?.room === "find" && (
                    <RoomCapacityVisualisation
                      rooms={roomCapacityRooms}
                      sessions={roomCapacitySessions}
                      initialRoomId={solverResult.room_id ?? null}
                      proposedSessionId={solverResult.session_id}
                    />
                  )}

                  {(originalModes?.time === "find" || originalModes?.room === "find") && (
                    <CohortGapVisualisation
                      cohorts={cohorts}
                      sessions={cohortGapSessions}
                      initialCohortId={initialCohortId}
                      proposedSessionId={solverResult.session_id}
                    />
                  )}

                  {(originalModes?.time === "find" || originalModes?.room === "find") && (
                    <CohortRoomChangeVisualisation
                      cohorts={cohorts}
                      sessions={cohortRoomChangeSessions}
                      initialCohortId={initialCohortId}
                      proposedSessionId={solverResult.session_id}
                    />
                  )}
                </div>
              </section>
            )}

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

            {storeButton({
              key: `direct:${solverResult.session_id}:${solverResult.day ?? solverResult.solution?.day ?? ""}:${solverResult.time ?? solverResult.solution?.time ?? ""}:${solverResult.room_id ?? solverResult.solution?.room_id ?? ""}:${solverResult.lecturer_id ?? solverResult.solution?.lecturer_id ?? ""}:${(solverResult.additional_changes ?? []).map((change) => change.session_id).join(",")}:${appliedTemporaryDeactivations.map((item) => `${item.constraint_id}:${item.instance_id}:${item.day ?? ""}`).join(",")}`,
              source: "direct",
              label: appliedTemporaryDeactivations.length > 0 ? "Relaxation solution" : "Direct solution",
              session_id: solverResult.session_id,
              day: solverResult.day ?? solverResult.solution?.day,
              time: solverResult.time ?? solverResult.solution?.time,
              room_id: solverResult.room_id ?? solverResult.solution?.room_id,
              lecturer_id: solverResult.lecturer_id ?? solverResult.solution?.lecturer_id,
              objective_score: solverResult.objective_score,
              additional_changes: solverResult.additional_changes ?? [],
              relaxations: appliedTemporaryDeactivations,
            })}
          </div>
        )}


      {/* INFEASIBLE FLOW */}

      {solverResult &&
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
                    !canRearrange &&
                    !checkingPerturbations && (
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
                    <div className={`recovery-option ${!canRelax ? "disabled" : ""}`} style={{ display: "flex", flexDirection: "column", minHeight: "260px", padding: "18px" }}>
                      <div className="recovery-option-icon"><SlidersHorizontal size={20} /></div>
                      <div style={{ marginTop: "14px" }}>
                        <div className="recovery-title-with-status">
                          <h4>Violate constraints only</h4>
                          {!canRelax && <span className="recovery-unavailable-badge">Not available</span>}
                        </div>
                        <p>Keep the rest of the timetable unchanged and relax the constraints blocking this request.</p>

                        {requestContainsFind ? (
                          anyRelaxationResult?.status === "feasible" ? (
                            <div style={{ marginTop: "12px" }}>
                              <strong>Selected placement:</strong>
                              <div style={{ marginTop: "6px" }}>{anyRelaxationResult.day} {anyRelaxationResult.time}</div>
                              <div style={{ marginTop: "3px" }}>
                                {anyRelaxationResult.room_id ? getRoomName(anyRelaxationResult.room_id) : "—"}
                                {" · "}
                                {anyRelaxationResult.lecturer_id ? getLecturerName(anyRelaxationResult.lecturer_id) : "—"}
                              </div>
                              <div style={{ marginTop: "14px" }}>
                                <strong>Constraints to relax:</strong>
                                <ul style={{ margin: "8px 0 0", paddingLeft: "20px" }}>
                                  {(anyRelaxationResult.relaxations ?? []).map((constraint, index) => (
                                    <li key={`${constraint.constraint_id}-${constraint.instance_id}-${constraint.day ?? ""}-${index}`} style={{ marginBottom: "4px" }}>
                                      {getTemporaryConstraintLabel(constraint.constraint_id)}{" — "}{getAnyRelaxationConstraintContext(constraint)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div className="recovery-protection" style={{ marginTop: "10px" }}>
                                {anyRelaxationResult.minimum_relaxations ?? anyRelaxationResult.relaxations?.length ?? 0} constraint{(anyRelaxationResult.minimum_relaxations ?? anyRelaxationResult.relaxations?.length ?? 0) === 1 ? "" : "s"} relaxed.
                              </div>
                            </div>
                          ) : (
                            <div style={{ marginTop: "12px" }}>
                              <span className="recovery-protection">Search all allowed placements and find the solution requiring the fewest constraint relaxations.</span>
                              {anyRelaxationError && <div className="recovery-disabled-reason" style={{ marginTop: "10px" }}>{anyRelaxationError}</div>}
                            </div>
                          )
                        ) : canRelax ? (
                          <div style={{ marginTop: "12px" }}>
                            <strong>Constraints to relax:</strong>
                            <ul style={{ margin: "8px 0 0", paddingLeft: "20px" }}>
                              {activeViolations.map((violation, index) => (
                                <li key={`${violation.type}-${index}`} style={{ marginBottom: "4px" }}>{formatViolationNice(violation)}</li>
                              ))}
                            </ul>
                          </div>
                        ) : firstUnrelaxableViolation ? (
                          <span className="recovery-disabled-reason">Relaxation alone cannot resolve this request. {formatViolationNice(firstUnrelaxableViolation)} is unrelaxable.</span>
                        ) : (
                          <span className="recovery-disabled-reason">No relaxation-only recovery is available.</span>
                        )}
                      </div>

                      <div style={{ marginTop: "auto", paddingTop: "20px" }}>
                        {requestContainsFind ? (
                          anyRelaxationResult?.status === "feasible" ? (
                            storeButton({
                              key: `relax-any:${mixedRecoveryRequest.session_id}:${anyRelaxationResult.start_slot ?? ""}:${anyRelaxationResult.room_id ?? ""}:${anyRelaxationResult.lecturer_id ?? ""}:${(anyRelaxationResult.relaxations ?? []).map((item) => `${item.constraint_id}:${item.instance_id}:${item.day ?? ""}`).join(",")}`,
                              source: "direct", label: "Relaxation solution", session_id: mixedRecoveryRequest.session_id,
                              day: anyRelaxationResult.day, time: anyRelaxationResult.time, room_id: anyRelaxationResult.room_id, lecturer_id: anyRelaxationResult.lecturer_id,
                              objective_score: null, additional_changes: [], relaxations: anyRelaxationResult.relaxations ?? [],
                            })
                          ) : (
                            <button type="button" className="find-rearrangements-button" onClick={() => void onFindMinimumRelaxation()} disabled={anyRelaxationLoading} style={{ width: "auto", marginTop: "14px" }}>
                              {anyRelaxationLoading ? "Finding relaxation solution…" : "Find relaxation solution"}
                            </button>
                          )
                        ) : canRelax && temporaryDeactivations.length > 0 ? (
                          storeButton({
                            key: `relax:${mixedRecoveryRequest.session_id}:${mixedRecoveryRequest.requested_start ?? ""}:${mixedRecoveryRequest.requested_room_id ?? ""}:${mixedRecoveryRequest.requested_lecturer_id ?? ""}:${temporaryDeactivations.map((item) => `${item.constraint_id}:${item.instance_id}:${item.day ?? ""}`).join(",")}`,
                            source: "direct", label: "Relaxation solution", session_id: mixedRecoveryRequest.session_id,
                            day: diagDay ?? activeViolations.find((violation) => violation.day)?.day,
                            time: diagTime ?? (mixedRecoveryRequest.requested_start ? mixedRecoveryRequest.requested_start.slice(11, 16) : undefined),
                            room_id: diagRoom ?? mixedRecoveryRequest.requested_room_id ?? undefined,
                            lecturer_id: diagLecturer ?? mixedRecoveryRequest.requested_lecturer_id ?? undefined,
                            objective_score: null, additional_changes: [], relaxations: temporaryDeactivations,
                          })
                        ) : (
                          <button type="button" className="find-rearrangements-button" disabled style={{ width: "auto", marginTop: "14px" }}>Store</button>
                        )}
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
                          Set a maximum timetable-disruption budget and let
                          the solver preserve as many constraints as possible.
                        </p>

                        {canMixedRecovery ? (
                          <span className="recovery-protection">
                            The solver minimises relaxations first, then
                            perturbations, then timetable-quality penalty.
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
                          onClick={() => {
                            // Guidance starts automatically when Step 4 receives
                            // an infeasible diagnosis. This button only reveals
                            // the independently running/resulting mixed-recovery UI.
                            setMixedResultsMinimized(false);
                            setMixedRecoveryOpen(true);
                          }}
                          aria-busy={mixedGuidanceLoading}
                        >
                          {mixedGuidanceLoading
                            ? "View mixed recovery progress"
                            : mixedRecoveryOpen
                              ? "Mixed recovery open"
                              : "Explore mixed recovery"}

                          {mixedGuidanceLoading ? (
                            <RefreshCw
                              size={16}
                              aria-hidden="true"
                              style={{ animation: "step4SolverSpin 0.8s linear infinite" }}
                            />
                          ) : (
                            <ArrowRight size={16} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* RIGHT — PERTURBATION ONLY */}
                    <div
                      className={`recovery-option ${!canRearrange && !checkingPerturbations ? "disabled" : ""}`}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        minHeight: "260px",
                        padding: "18px",
                      }}
                    >
                      <div className="recovery-option-icon">
                        <RefreshCw
                          size={20}
                          style={
                            checkingPerturbations
                              ? { animation: "step4SolverSpin 0.8s linear infinite" }
                              : undefined
                          }
                        />
                      </div>

                      <div style={{ marginTop: "14px" }}>
                        <div className="recovery-title-with-status">
                          <h4>Move other classes only</h4>

                          {!checkingPerturbations && !canRearrange && (
                            <span className="recovery-unavailable-badge">
                              Not available
                            </span>
                          )}
                        </div>

                        {checkingPerturbations ? (
                          <>
                            <span className="recovery-protection">
                              No constraints will be relaxed.
                            </span>

                            <p style={{ marginTop: "10px" }}>
                              Calculating minimum additional perturbations…
                            </p>
                          </>
                        ) : canRearrange ? (
                          <>
                            <span className="recovery-protection">
                              No constraints will be relaxed.
                            </span>

                            {minimumPerturbations !== null && (
                              <p style={{ marginTop: "10px" }}>
                                Minimum additional perturbations:{" "}
                                <strong>{minimumPerturbations}</strong>
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="recovery-disabled-reason">
                            No perturbation-only solution exists while keeping
                            all active constraints enforced.
                          </span>
                        )}
                      </div>

                      <div style={{ marginTop: "auto", paddingTop: "20px" }}>
                        <button
                          type="button"
                          className="find-rearrangements-button"
                          disabled={
                            checkingPerturbations ||
                            !canRearrange ||
                            solverLoading ||
                            rearrangementsLoading
                          }
                          onClick={async () => {
                            if (rearrangementsLoading) return;
                            setRearrangementsLoading(true);
                            try {
                              await onFindRearrangements();
                            } finally {
                              setRearrangementsLoading(false);
                            }
                          }}
                          aria-busy={checkingPerturbations || rearrangementsLoading}
                        >
                          {checkingPerturbations
                            ? "Checking rearrangements…"
                            : rearrangementsLoading
                              ? perturbationAlternatives?.status === "feasible"
                                ? "Refreshing rearrangements…"
                                : "Finding rearrangements…"
                              : perturbationAlternatives?.status === "feasible"
                                ? "Refresh rearrangements"
                                : "Find rearrangements"}

                          {checkingPerturbations || rearrangementsLoading ? (
                            <RefreshCw
                              size={16}
                              aria-hidden="true"
                              style={{ animation: "step4SolverSpin 0.8s linear infinite" }}
                            />
                          ) : (
                            <ArrowRight size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {perturbationAlternatives?.status === "feasible" &&
                    perturbationAlternatives.solutions.length > 0 && (
                      <section
                        style={{
                          marginTop: "18px",
                          padding: "18px",
                          border: "1px solid #d9e0ea",
                          borderRadius: "12px",
                          background: "#f8fafc",
                        }}
                      >
                        <div style={{ marginBottom: perturbationResultsMinimized ? 0 : "16px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
                            <div>
                              <span className="infeasible-eyebrow">
                                PERTURBATION RECOVERY
                              </span>
                              <h3 style={{ margin: "6px 0 0" }}>
                                {perturbationAlternatives.solutions.length}{" "}
                                {perturbationAlternatives.solutions.length === 1
                                  ? "feasible rearrangement found"
                                  : "feasible rearrangements found"}
                              </h3>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPerturbationResultsMinimized((minimized) => !minimized)}
                              aria-expanded={!perturbationResultsMinimized}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "7px 10px",
                                border: "1px solid #cbd5e1",
                                borderRadius: "8px",
                                background: "#f8fafc",
                                color: "#475569",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: "pointer",
                                flexShrink: 0,
                              }}
                            >
                              {perturbationResultsMinimized ? "Expand" : "Minimize"}
                              {perturbationResultsMinimized ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                            </button>
                          </div>

                          {!perturbationResultsMinimized && (
                            <p className="step-description" style={{ marginBottom: 0 }}>
                              {requestContainsFind
                                ? "The solver searched all allowed ANY placements, kept every active constraint enforced, and chose a minimum-perturbation recovery."
                                : "Each option keeps all active constraints enforced and moves the minimum number of additional classes."}
                            </p>
                          )}


                          {!perturbationResultsMinimized && <button
                                      type="button"
                                          onClick={() => setShowImpactComparison(true)}
                                          style={{
                                            marginTop: "14px",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            padding: "9px 14px",
                                            border: "1px solid #cbd5e1",
                                            borderRadius: "8px",
                                            background: "#f8fafc",
                                            color: "#475569",
                                            fontSize: "13px",
                                            fontWeight: 700,
                                            cursor: "pointer",
                                            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)",
                                          }}
                                        >
                                          <GitCompareArrows size={16} />
                                          Compare impacts
                                        </button>}
                        </div>

                        {!perturbationResultsMinimized && <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                            gap: "14px",
                          }}
                        >
                          {perturbationAlternatives.solutions.slice(0, 3).map((solution, index) => (
                            <div
                              key={`${solution.rank}-${index}`}
                              className="recovery-option"
                              style={{ padding: "16px", background: "#ffffff" }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: "12px",
                                  alignItems: "flex-start",
                                }}
                              >
                                <div>
                                  <span className="infeasible-eyebrow">
                                    SOLUTION {solution.rank ?? index + 1}
                                  </span>
                                  <h4 style={{ margin: "6px 0 0" }}>
                                    {solution.perturbation_count}{" "}
                                    {solution.perturbation_count === 1
                                      ? "additional perturbation"
                                      : "additional perturbations"}
                                  </h4>
                                </div>

                                {solution.objective_score != null && (
                                  <div style={{ textAlign: "right", fontSize: "13px" }}>
                                    <div style={{ color: "#64748b" }}>Score</div>
                                    <strong>{solution.objective_score}</strong>
                                  </div>
                                )}
                              </div>

                              {requestContainsFind && (
                                <div
                                  style={{
                                    marginTop: "14px",
                                    padding: "12px",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: "10px",
                                  }}
                                >
                                  <strong>Selected target placement</strong>
                                  <div style={{ marginTop: "8px", fontSize: "13px" }}>
                                    <strong>Time:</strong>{" "}
                                    {DAY_LABELS[solution.day.slice(0, 3).toLowerCase()] ?? solution.day}{" "}
                                    {solution.time}
                                  </div>
                                  <div style={{ marginTop: "6px", fontSize: "13px" }}>
                                    <strong>Room:</strong>{" "}
                                    {getRoomName(solution.room_id)}
                                  </div>
                                  <div style={{ marginTop: "6px", fontSize: "13px" }}>
                                    <strong>Lecturer:</strong>{" "}
                                    {getLecturerName(solution.lecturer_id)}
                                  </div>
                                </div>
                              )}

                              <div style={{ marginTop: "14px" }}>
                                {solution.additional_changes.map((change) => {
                                  const session = getAdditionalChangeSession(change.session_id);

                                  return (
                                    <div
                                      key={change.session_id}
                                      style={{
                                        marginTop: "10px",
                                        padding: "12px",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "10px",
                                      }}
                                    >
                                      <strong>
                                        {getAdditionalChangeSessionLabel(change.session_id)}
                                      </strong>

                                      {session && (
                                        <div
                                          style={{
                                            marginTop: "4px",
                                            fontSize: "12px",
                                            color: "#64748b",
                                          }}
                                        >
                                          {getLecturerName(session.lecturerId)}
                                        </div>
                                      )}

                                      {change.time_changed && (
                                        <div style={{ marginTop: "8px", fontSize: "13px" }}>
                                          <strong>Time:</strong>{" "}
                                          {DAY_LABELS[change.old_day.slice(0, 3).toLowerCase()] ?? change.old_day}{" "}
                                          {change.old_time} →{" "}
                                          {DAY_LABELS[change.new_day.slice(0, 3).toLowerCase()] ?? change.new_day}{" "}
                                          {change.new_time}
                                        </div>
                                      )}

                                      {change.room_changed && (
                                        <div style={{ marginTop: "6px", fontSize: "13px" }}>
                                          <strong>Room:</strong>{" "}
                                          {getRoomName(change.old_room_id)} →{" "}
                                          {getRoomName(change.new_room_id)}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {solution.impact && (
                          <button
                            type="button"
                            onClick={() => setSelectedPerturbationImpact(solution.impact!)}
                            style={{
                              marginTop: "14px",
                              width: "100%",
                              padding: "9px 12px",
                              border: "1px solid #cbd5e1",
                              borderRadius: "8px",
                              background: "#f8fafc",
                              color: "#475569",
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            View impacts
                          </button>
                        )}

                        {storeButton({
                          key: `perturbation:${solution.session_id}:${solution.rank}:${solution.day}:${solution.time}:${solution.room_id}:${solution.lecturer_id}`,
                          source: "perturbation",
                          label: `Perturbation solution ${solution.rank ?? index + 1}`,
                          session_id: solution.session_id,
                          day: solution.day,
                          time: solution.time,
                          room_id: solution.room_id,
                          lecturer_id: solution.lecturer_id,
                          objective_score: solution.objective_score,
                          additional_changes: solution.additional_changes ?? [],
                          relaxations: [],
                          impact: solution.impact,
                        })}

                        <p
                                style={{
                                  margin: "14px 0 0",
                                  fontSize: "12px",
                                  color: "#64748b",
                                }}
                              >
                              </p>
                            </div>
                          ))}
                        </div>}
                      </section>
                    )}

                  {perturbationAlternatives &&
                    perturbationAlternatives.status !== "feasible" && (
                      <div
                        style={{
                          marginTop: "18px",
                          padding: "14px 16px",
                          border: "1px solid #f0b8b8",
                          borderRadius: "10px",
                          background: "#fff7f7",
                        }}
                      >
                        {perturbationAlternatives.reason ??
                          "No perturbation-only rearrangement was found."}
                      </div>
                    )}

                  {mixedRecoveryOpen && (
                    <>
                      <div
                        style={{
                          marginTop: "14px",
                          padding: "22px",
                          background: "#f8fafc",
                          border: "1px solid #d9e0ea",
                          borderRadius: "12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: "16px",
                            marginBottom: mixedResultsMinimized ? 0 : "18px",
                          }}
                        >
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
                              MIXED RECOVERY
                            </div>
                            <h3 style={{ margin: "4px 0 0" }}>
                              Mixed recovery
                            </h3>
                          </div>

                          <button
                            type="button"
                            onClick={() => setMixedResultsMinimized((minimized) => !minimized)}
                            aria-expanded={!mixedResultsMinimized}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "7px 10px",
                              border: "1px solid #cbd5e1",
                              borderRadius: "8px",
                              background: "#f8fafc",
                              color: "#475569",
                              fontSize: "12px",
                              fontWeight: 700,
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                          >
                            {mixedResultsMinimized ? "Expand" : "Minimize"}
                            {mixedResultsMinimized ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                          </button>
                        </div>

                        {!mixedResultsMinimized && (
                          <>
                            {/* MIXED RECOVERY SOLUTION — independently foldable */}
                            <div
                              style={{
                                padding: "18px",
                                border: "1px solid #d9e0ea",
                                borderRadius: "12px",
                                background: "#f8fafc",
                              }}
                            >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "16px",
                                padding: "0 0 12px",
                                borderBottom: mixedSolutionMinimized ? 0 : "1px solid #d9e0ea",
                                marginBottom: mixedSolutionMinimized ? "14px" : "18px",
                              }}
                            >
                              <div>
                                <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                  Solution
                                </div>
                                    {mixedRecoveryLoading && (
                                          <span
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: "6px",
                                            }}
                                          >
                                            Calculating best solution…
                                            <RefreshCw
                                              size={14}
                                              style={{
                                                animation: "step4SolverSpin 0.8s linear infinite",
                                              }}
                                            />
                                          </span>
                                        )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setMixedSolutionMinimized((value) => !value)}
                                aria-expanded={!mixedSolutionMinimized}
                                title={mixedSolutionMinimized ? "Expand solution" : "Collapse solution"}
                                aria-label={mixedSolutionMinimized ? "Expand mixed recovery solution" : "Collapse mixed recovery solution"}
                                style={{ width: "32px", height: "32px", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, border: "1px solid #dbe3ee", borderRadius: "999px", background: "#ffffff", color: "#475569", cursor: "pointer", flexShrink: 0 }}
                              >
                                {mixedSolutionMinimized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                              </button>
                            </div>

                            {!mixedSolutionMinimized && (
                              <>
                        {mixedGuidanceLoading && (
                          <div
                            role="status"
                            aria-live="polite"
                            style={{
                              margin: "0 0 16px",
                              display: "flex",
                              alignItems: "center",
                              gap: "9px",
                              color: "#64748b",
                              fontSize: "13px",
                            }}
                          >
                            <RefreshCw
                              size={16}
                              aria-hidden="true"
                              style={{ animation: "step4SolverSpin 0.8s linear infinite" }}
                            />
                            <span>Calculating the first useful mixed-recovery budget…</span>
                          </div>
                        )}

                        {mixedGuidanceError && (
                          <div style={{ marginBottom: "16px", color: "#9f2929" }}>
                            {mixedGuidanceError}
                          </div>
                        )}

                        {/* DEFAULT / CURRENT MIXED RECOVERY SOLUTION */}
                        {!mixedGuidanceLoading && mixedRecoveryResult?.status === "feasible" && (
                          <div
                           style={{
      borderTop: "1px solid #d9e0ea",
      paddingTop: "18px",
      marginTop: "18px",
    }}
                          >
                            <strong>Suggested recovery</strong>
                            <div style={{ marginTop: "5px", fontSize: "13px", color: "#64748b" }}>
                              {mixedRecoveryResult.perturbation_count ?? 0} perturbation
                              {(mixedRecoveryResult.perturbation_count ?? 0) === 1 ? "" : "s"} + {" "}
                              {mixedRecoveryResult.relaxation_count ?? 0} relaxation
                              {(mixedRecoveryResult.relaxation_count ?? 0) === 1 ? "" : "s"}.
                              {protectedConstraintIds.length > 0
                                ? " Recalculated using your protected constraints."
                                : " This is the first useful mixed recovery found by the guidance search."}
                            </div>
                          </div>
                        )}

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
                                Changes
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
                                  Perturbations used ·{" "}
                                  {mixedRecoveryResult.perturbation_count ?? 0} of{" "}
                                  {mixedRecoveryResult.max_perturbations ??
                                    mixedPerturbationLimit} permitted
                                </strong>

                                {(mixedRecoveryResult.additional_changes?.length ??
                                  0) === 0 ? (
                                  <p style={{ margin: "8px 0 0", color: "#64748b" }}>
                                    No additional timetable fields needed to change.
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

                                <p
                                  style={{
                                    margin: "10px 0 0",
                                    fontSize: "13px",
                                    color: "#64748b",
                                  }}
                                >
                                  Time and room changes are counted separately,
                                  so one class can contribute two perturbations
                                  if both fields change.
                                </p>
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
                            {mixedRecoveryResult.impact && (
                              <div
                                style={{
                                  marginTop: "16px",
                                  padding: "14px",
                                  border: "1px solid #d9e0ea",
                                  borderRadius: "10px",
                                  background: "#f8fafc",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: "16px",
                                }}
                              >
                                <div>
                                  <strong>Timetable impact</strong>
                                  <p
                                    style={{
                                      margin: "4px 0 0",
                                      fontSize: "13px",
                                      color: "#64748b",
                                    }}
                                  >
                                    {mixedRecoveryResult.perturbation_count ?? 0}{" "}
                                    {(mixedRecoveryResult.perturbation_count ?? 0) === 1
                                      ? "perturbation"
                                      : "perturbations"}{" "}
                                    · {mixedRecoveryResult.relaxation_count ?? 0}{" "}
                                    {(mixedRecoveryResult.relaxation_count ?? 0) === 1
                                      ? "constraint relaxation"
                                      : "constraint relaxations"}
                                  </p>
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    flexShrink: 0,
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="find-rearrangements-button"
                                    onClick={() =>
                                      setSelectedPerturbationImpact(
                                        mixedRecoveryResult.impact!,
                                      )
                                    }
                                    style={{ width: "auto" }}
                                  >
                                    View impact
                                    <ArrowRight size={16} />
                                  </button>

                                  {storeButton({
                                    key: `mixed:${mixedRecoveryResult.session_id ?? mixedRecoveryRequest.session_id}:${mixedRecoveryResult.day ?? ""}:${mixedRecoveryResult.time ?? ""}:${mixedRecoveryResult.room_id ?? ""}:${mixedRecoveryResult.lecturer_id ?? ""}:${mixedRecoveryResult.perturbation_count ?? 0}:${mixedRecoveryResult.relaxation_count ?? 0}`,
                                    source: "mixed",
                                    label: "Mixed recovery solution",
                                    session_id: mixedRecoveryResult.session_id ?? mixedRecoveryRequest.session_id,
                                    day: mixedRecoveryResult.day,
                                    time: mixedRecoveryResult.time,
                                    room_id: mixedRecoveryResult.room_id,
                                    lecturer_id: mixedRecoveryResult.lecturer_id,
                                    objective_score: mixedRecoveryResult.objective_score,
                                    additional_changes: mixedRecoveryResult.additional_changes ?? [],
                                    relaxations: mixedRecoveryResult.used_relaxations ?? [],
                                    impact: mixedRecoveryResult.impact,
                                  }, true)}
                                </div>
                              </div>
                            )}
                            </div>
                          )}

                              </>
                            )}
                            </div>

                            {/* MIXED RECOVERY CONFIGURATION — independently foldable */}
                            <div
                              style={{
                                marginTop: "28px",
                                padding: "18px",
                                border: "1px solid #d9e0ea",
                                borderRadius: "12px",
                                background: "#f8fafc",
                              }}
                            >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "16px",
                                padding: "12px 0",
                                borderTop: "1px solid #d9e0ea",
                                borderBottom: mixedConfigurationMinimized ? 0 : "1px solid #d9e0ea",
                                marginTop: "6px",
                                marginBottom: mixedConfigurationMinimized ? 0 : "18px",
                              }}
                            >
                              <div>
                                <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                  Configuration
                                </div>
                                <strong style={{ display: "block", marginTop: "3px" }}>Recovery configuration</strong>
                              </div>
                              <button
                                type="button"
                                onClick={() => setMixedConfigurationMinimized((value) => !value)}
                                aria-expanded={!mixedConfigurationMinimized}
                                title={mixedConfigurationMinimized ? "Expand configuration" : "Collapse configuration"}
                                aria-label={mixedConfigurationMinimized ? "Expand recovery configuration" : "Collapse recovery configuration"}
                                style={{ width: "32px", height: "32px", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, border: "1px solid #dbe3ee", borderRadius: "999px", background: "#ffffff", color: "#475569", cursor: "pointer", flexShrink: 0 }}
                              >
                                {mixedConfigurationMinimized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                              </button>
                            </div>

                            {!mixedConfigurationMinimized && (
                              <>
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
                            Maximum additional perturbations
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

                          <p
                            style={{
                              margin: "10px 0 0",
                              fontSize: "13px",
                              color: "#64748b",
                              maxWidth: "620px",
                            }}
                          >
                            Choose how much timetable disruption the solver may
                            use to preserve more constraints. A time change and
                            a room change each count as one perturbation. The
                            solver may use fewer than this maximum.
                          </p>
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
                            <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              CONSTRAINTS TO KEEP ENFORCED
                            </div>
                            <p style={{ margin: "6px 0 0", color: "#64748b" }}>Protect whole groups or choose individual stakeholders and days.</p>
                            <div style={{ marginTop: "12px" }}>
                              <button type="button" onClick={() => setProtectedConstraintsOpen((open) => !open)} aria-expanded={protectedConstraintsOpen}
                                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "#ffffff", border: "1px solid #d9e0ea", borderRadius: "8px", cursor: "pointer" }}>
                                <span><strong>{protectedConstraintIds.length}</strong> of {allRelaxableConstraints.length} protected</span>
                                {protectedConstraintsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                              {protectedConstraintsOpen && (
                                <div style={{ marginTop: "8px", background: "#ffffff", border: "1px solid #d9e0ea", borderRadius: "10px", overflow: "hidden" }}>
                                  <div style={{ padding: "12px", borderBottom: "1px solid #e5e7eb", background: "#f8fafc" }}>
                                    <input type="search" value={constraintSearch} onChange={(event) => setConstraintSearch(event.target.value)} placeholder="Search constraints or stakeholders…" aria-label="Search protected constraints"
                                      style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#ffffff", outline: "none", fontSize: "13px" }} />
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginTop: "9px", fontSize: "12px", color: "#64748b" }}>
                                      <span>{constraintSearch ? `${groupedConstraintPicker.reduce((total, group) => total + group.constraints.length, 0)} matching constraints` : `${allRelaxableConstraints.length} relaxable constraints`}</span>
                                      {protectedConstraintIds.length > 0 && <button type="button" onClick={() => setConstraintsProtected(allRelaxableConstraints, false)} style={{ padding: 0, border: 0, background: "transparent", color: "#475569", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>Clear all</button>}
                                    </div>
                                  </div>
                                  <div style={{ maxHeight: "390px", overflowY: "auto", padding: "6px" }}>
                                    {groupedConstraintPicker.length === 0 ? <div style={{ padding: "24px 14px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>No constraints match “{constraintSearch}”.</div> : groupedConstraintPicker.map((typeGroup) => {
                                      const typeProtected = getProtectedCount(typeGroup.constraints);
                                      return <div key={typeGroup.type} style={{ marginBottom: "8px", border: "1px solid #e2e8f0", borderRadius: "9px", overflow: "hidden" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 11px", background: "#f8fafc" }}>
                                          <input type="checkbox" ref={(element) => setIndeterminate(element, typeProtected, typeGroup.constraints.length)} checked={typeGroup.constraints.length > 0 && typeProtected === typeGroup.constraints.length} onChange={(event) => setConstraintsProtected(typeGroup.constraints, event.target.checked)} aria-label={`Protect all ${typeGroup.label}`} />
                                          <strong style={{ flex: 1, fontSize: "13px", color: "#1e293b" }}>{typeGroup.label}</strong><span style={{ fontSize: "11px", color: "#64748b" }}>{typeProtected} / {typeGroup.constraints.length}</span>
                                        </div>
                                        <div style={{ padding: "5px" }}>{typeGroup.constraintGroups.map((constraintGroup) => {
                                          const protectedCount=getProtectedCount(constraintGroup.constraints); const open=expandedConstraintTypes.includes(constraintGroup.key)||constraintSearch.trim().length>0;
                                          return <div key={constraintGroup.key} style={{ borderBottom: "1px solid #eef2f7" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "9px 7px" }}>
                                              <input type="checkbox" ref={(element)=>setIndeterminate(element,protectedCount,constraintGroup.constraints.length)} checked={constraintGroup.constraints.length>0&&protectedCount===constraintGroup.constraints.length} onChange={(event)=>setConstraintsProtected(constraintGroup.constraints,event.target.checked)} aria-label={`Protect all ${constraintGroup.name}`} />
                                              <button type="button" onClick={()=>toggleConstraintTypeOpen(constraintGroup.key)} style={{ flex:1,minWidth:0,display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px",padding:0,border:0,background:"transparent",textAlign:"left",cursor:"pointer" }}>
                                                <span style={{ overflow:"hidden",textOverflow:"ellipsis",fontSize:"13px",fontWeight:600,color:"#1e293b" }}>{constraintGroup.name}</span><span style={{display:"flex",alignItems:"center",gap:"7px",flexShrink:0}}><span style={{fontSize:"11px",color:"#64748b"}}>{protectedCount} / {constraintGroup.constraints.length}</span>{open?<ChevronUp size={14}/>:<ChevronDown size={14}/>}</span>
                                              </button>
                                            </div>
                                            {open && <div style={{ padding:"0 8px 9px 34px" }}>{constraintGroup.stakeholders.map((stakeholder)=>{
                                              const stakeholderProtected=getProtectedCount(stakeholder.constraints); const dayConstraints=stakeholder.constraints.filter((constraint)=>constraint.day); const nonDayConstraints=stakeholder.constraints.filter((constraint)=>!constraint.day);
                                              return <div key={stakeholder.key} style={{padding:"9px 0",borderTop:"1px solid #f1f5f9"}}>
                                                <div style={{display:"flex",alignItems:"center",gap:"9px"}}><input type="checkbox" ref={(element)=>setIndeterminate(element,stakeholderProtected,stakeholder.constraints.length)} checked={stakeholder.constraints.length>0&&stakeholderProtected===stakeholder.constraints.length} onChange={(event)=>setConstraintsProtected(stakeholder.constraints,event.target.checked)} aria-label={`Protect ${stakeholder.name}`}/><span style={{flex:1,minWidth:0,fontSize:"12px",fontWeight:600,color:"#334155"}}>{stakeholder.name}</span><span style={{fontSize:"10px",color:"#94a3b8"}}>{stakeholderProtected}/{stakeholder.constraints.length}</span></div>
                                                {dayConstraints.length>0 && <div style={{display:"flex",flexWrap:"wrap",gap:"6px",marginTop:"8px",marginLeft:"24px"}}>{dayConstraints.map((constraint)=>{ const checked=protectedConstraintIds.includes(getProtectionKey(constraint)); const dayLabel=getPickerDayLabel(constraint.day)??"Day"; return <label key={constraint.instance_id} title={dayLabel} style={{display:"inline-flex",alignItems:"center",gap:"5px",padding:"5px 7px",border:checked?"1px solid #93c5fd":"1px solid #e2e8f0",borderRadius:"6px",background:checked?"#eff6ff":"#ffffff",fontSize:"11px",fontWeight:600,color:checked?"#1d4ed8":"#64748b",cursor:"pointer"}}><input type="checkbox" checked={checked} onChange={(event)=>setConstraintsProtected([constraint],event.target.checked)} style={{width:"12px",height:"12px",margin:0}}/>{dayLabel.slice(0,3)}</label>;})}</div>}
                                                {nonDayConstraints.map((constraint)=>{const checked=protectedConstraintIds.includes(getProtectionKey(constraint)); return <label key={constraint.instance_id} style={{display:"flex",alignItems:"center",gap:"7px",marginTop:"8px",marginLeft:"24px",fontSize:"11px",color:"#64748b",cursor:"pointer"}}><input type="checkbox" checked={checked} onChange={(event)=>setConstraintsProtected([constraint],event.target.checked)}/>Protect this constraint</label>;})}
                                              </div>;
                                            })}</div>}
                                          </div>;
                                        })}</div>
                                      </div>;
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* RIGHT — PROTECTED CONSTRAINTS */}
                          <div
                            style={{
                              border: "1px solid #f3d69a",
                              borderRadius: "10px",
                              background: "#fff8e6",
                              overflow: "hidden",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setProtectedSummaryOpen((open) => !open)
                              }
                              aria-expanded={protectedSummaryOpen}
                              style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "16px",
                                padding: "16px",
                                border: 0,
                                background: "transparent",
                                cursor: "pointer",
                                textAlign: "left",
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    color: "#92400e",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                  }}
                                >
                                  Constraints protected
                                </div>

                                <div
                                  style={{
                                    marginTop: "5px",
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    color: "#1e293b",
                                  }}
                                >
                                  {selectedProtectedConstraints.length} selected
                                </div>
                              </div>

                              {protectedSummaryOpen ? (
                                <ChevronUp size={18} aria-hidden="true" />
                              ) : (
                                <ChevronDown size={18} aria-hidden="true" />
                              )}
                            </button>

                            {protectedSummaryOpen && (
                              <div
                                style={{
                                  padding: "0 16px 16px",
                                  borderTop: "1px solid #f3d69a",
                                }}
                              >
                                {selectedProtectedConstraints.length === 0 ? (
                                  <p
                                    style={{
                                      margin: "14px 0 0",
                                      fontSize: "13px",
                                      color: "#64748b",
                                    }}
                                  >
                                    No constraints are protected. The solver may relax any
                                    relaxable constraint if needed.
                                  </p>
                                ) : (
                                  <>
                                    <p
                                      style={{
                                        margin: "14px 0",
                                        fontSize: "13px",
                                        color: "#64748b",
                                      }}
                                    >
                                      These constraints must remain enforced.
                                    </p>

                                    <div
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "8px",
                                      }}
                                    >
                                      {groupedProtectedConstraints.map(
                                        (constraintGroup) => (
                                          <details
                                            key={constraintGroup.id}
                                            style={{
                                              background: "rgba(255, 255, 255, 0.45)",
                                              border: "1px solid #f3d69a",
                                              borderRadius: "8px",
                                              overflow: "hidden",
                                            }}
                                          >
                                            <summary
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                gap: "12px",
                                                padding: "10px 12px",
                                                cursor: "pointer",
                                                fontSize: "13px",
                                                fontWeight: 600,
                                                color: "#1e293b",
                                              }}
                                            >
                                              <span>{constraintGroup.name}</span>
                                              <span
                                                style={{
                                                  flexShrink: 0,
                                                  fontSize: "12px",
                                                  fontWeight: 600,
                                                  color: "#92400e",
                                                }}
                                              >
                                                {constraintGroup.count}
                                              </span>
                                            </summary>

                                            <div style={{ padding: "0 12px 10px" }}>
                                              {constraintGroup.stakeholders.map(
                                                (stakeholder, index) => (
                                                  <div
                                                    key={stakeholder.key}
                                                    style={{
                                                      padding: "9px 0",
                                                      borderTop:
                                                        index === 0
                                                          ? "1px solid #f3d69a"
                                                          : "1px solid rgba(243, 214, 154, 0.65)",
                                                    }}
                                                  >
                                                    <div
                                                      style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "space-between",
                                                        gap: "12px",
                                                      }}
                                                    >
                                                      <strong
                                                        style={{
                                                          fontSize: "13px",
                                                          color: "#334155",
                                                        }}
                                                      >
                                                        {stakeholder.name}
                                                      </strong>

                                                      <span
                                                        style={{
                                                          fontSize: "11px",
                                                          color: "#94a3b8",
                                                        }}
                                                      >
                                                        {stakeholder.count}
                                                      </span>
                                                    </div>

                                                    {stakeholder.days.length > 0 && (
                                                      <div
                                                        style={{
                                                          marginTop: "4px",
                                                          fontSize: "12px",
                                                          color: "#64748b",
                                                        }}
                                                      >
                                                        {stakeholder.days.join(" · ")}
                                                      </div>
                                                    )}
                                                  </div>
                                                ),
                                              )}
                                            </div>
                                          </details>
                                        ),
                                      )}
                                    </div>

                                    <div
                                      style={{
                                        marginTop: "12px",
                                        padding: "10px 12px",
                                        borderRadius: "8px",
                                        background: "#fffbeb",
                                        fontSize: "12px",
                                        color: "#78350f",
                                      }}
                                    >
                                      Protected constraints remain enforced. Unselected
                                      constraints may be relaxed if needed.
                                    </div>
                                  </>
                                )}
                              </div>
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
                                ? "Calculating best solution…"
                                : "Find best solution"}
                              {mixedRecoveryLoading ? (
                                <RefreshCw
                                  size={16}
                                  aria-hidden="true"
                                  style={{ animation: "step4SolverSpin 0.8s linear infinite" }}
                                />
                              ) : (
                                <ArrowRight size={16} />
                              )}
                            </button>
                          </div>
                              </>
                            )}
                            </div>

                          </>
                        )}
                      </div>
                    </>
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

      {selectedPerturbationImpact && (
        <PerturbationImpactModal
          impact={selectedPerturbationImpact}
          sessions={sessions}
          modules={modules}
          cohorts={cohorts}
          lecturers={lecturers}
          rooms={rooms}
          onClose={() => setSelectedPerturbationImpact(null)}
        />
      )}

     {showImpactComparison && (
      <PerturbationImpactComparisonModal
                  solutions={perturbationAlternatives.solutions}
                  sessions={sessions}
                  modules={modules}
                  cohorts={cohorts}
                  lecturers={lecturers}
                  rooms={rooms}
                  onClose={() => setShowImpactComparison(false)}
                />
      )}
    </>
  );
}
