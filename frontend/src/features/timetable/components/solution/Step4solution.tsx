import { useState } from "react";
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
import "./Step4solution.css";
import { HistoricalImpactSummary } from "../../../impact/components/HistoricalImpactSummary"


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
    };

type NamedEntity = { id: string; name: string };

type SessionLike = {
  id: string;
  moduleId?: string;
  lecturerId: string;
  room?: string;
  cohortIds: string[];
};

type RecoveryOption = "different-request" | "rearrange" | "relax";

export type TemporaryConstraintDeactivation = {
  constraint_id: string;
  instance_type: "lecturer" | "cohort" | "session" | "room";
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

  selectedModuleLabel: string | null;
  selectedEventFallbackId?: string;
  selectedEventDayTime: string | null;
  selectedEventRoom?: string | null;
  selectedEventLecturerName?: string | null;

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
  onFindRearrangements: (maxAdditionalChanges: number) => void;
  appliedTemporaryDeactivations: TemporaryConstraintDeactivation[];

  needsInteractiveDiagnosis: boolean;
  days: string[];
  timeSlots: string[];
  lecturers: NamedEntity[];
  rooms: NamedEntity[];
  cohorts: NamedEntity[];
  sessions: SessionLike[];
  lecturerUnavailableSlotMap: Record<string, string[]>;
  excludeSessionId: string;

  // The proposed slot each diagnosis case checks violations against.
  // Case A (concrete request) and Case B (interactive "find" diagnosis)
  // can differ since Case B lets the user pick a different day/time to test.
  caseAProposedSlots: string[];
  caseBProposedSlots: string[];

  diagLecturer: string | null;
  onDiagLecturerChange: (value: string | null) => void;
  diagDay: string | null;
  onDiagDayChange: (value: string | null) => void;
  diagTime: string | null;
  onDiagTimeChange: (value: string | null) => void;
  diagRoom: string | null;
  onDiagRoomChange: (value: string | null) => void;

  diagLoading: boolean;
  diagError: string | null;
  diagResult: Diagnostics | null;
};

export function Step4Solution({
  solverLoading,
  solverError,
  solverResult,
  selectedModuleLabel,
  selectedEventFallbackId,
  selectedEventDayTime,
  selectedEventRoom,
  selectedEventLecturerName,
  originalModes,
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
  const [selectedRecoveryOption, setSelectedRecoveryOption] =
    useState<RecoveryOption | null>(null);

  const [rearrangeMode, setRearrangeMode] = useState<"minimal" | "limit">(
    "minimal",
  );
  const [maxAdditionalChanges, setMaxAdditionalChanges] = useState(2);

  function toggleRecoveryOption(option: RecoveryOption) {
    setSelectedRecoveryOption((current) =>
      current === option ? null : option,
    );
  }

  /*
   * For a concrete request we use the solver diagnostics.
   * For a request containing FIND, the relevant blockers are the ones from
   * the concrete combination the user has just diagnosed.
   */
  const activeViolations: Violation[] = needsInteractiveDiagnosis
    ? (diagResult?.violations ?? [])
    : solverResult && solverResult.status !== "feasible"
      ? (solverResult.diagnostics?.violations ?? [])
      : [];

  const hasActiveDiagnosis = activeViolations.length > 0;

  /*
   * Rearranging other classes cannot change a lecturer's declared
   * unavailability. Other blocker types are deliberately left open for now:
   * the later solver can try to resolve them by moving/cascading classes.
   */
  const hasLecturerUnavailability = activeViolations.some(
    (violation) => violation.type === "lecturer_unavailable",
  );

  const canRearrange = hasActiveDiagnosis && !hasLecturerUnavailability;

  /*
   * Relaxation is only a valid route when EVERY current blocker is relaxable.
   * One unrelaxable blocker disables the whole recovery strategy because
   * relaxing the others would still leave the request infeasible.
   */
  const unrelaxableViolations = activeViolations.filter(
    (violation) => !isRelaxableViolation(violation.type),
  );
  const canRelax =
    hasActiveDiagnosis && unrelaxableViolations.length === 0;

  const lecturerUnavailableViolation = activeViolations.find(
    (violation) => violation.type === "lecturer_unavailable",
  );

  const firstUnrelaxableViolation = unrelaxableViolations[0];

  function getConstraintLabel(type: string): string {
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
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
    }
  }

  function getTemporaryConstraintLabel(constraintId: string): string {
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
    constraint: TemporaryConstraintDeactivation,
  ): string {
    const matchingViolation = activeViolations.find((violation) => {
      if (
        constraint.instance_type === "lecturer" &&
        violation.lecturer_id === constraint.instance_id
      ) {
        return !constraint.day || violation.day === constraint.day;
      }

      if (
        constraint.instance_type === "cohort" &&
        violation.cohort_id === constraint.instance_id
      ) {
        return !constraint.day || violation.day === constraint.day;
      }

      if (
        constraint.instance_type === "session" &&
        violation.session_id === constraint.instance_id
      ) {
        return true;
      }

      return false;
    });

    if (matchingViolation?.message) {
      return matchingViolation.message;
    }

    return constraint.day
      ? `${constraint.instance_id} · ${constraint.day}`
      : constraint.instance_id;
  }

  function getAdditionalChangeSessionLabel(sessionId: string): string {
    const matchingSession = sessions.find((session) => session.id === sessionId);
    return matchingSession?.moduleId ?? sessionId;
  }

  const temporaryDeactivations: TemporaryConstraintDeactivation[] = [];

  for (const violation of activeViolations) {
    switch (violation.type) {
      case "class_capacity":
        if (violation.session_id) {
          temporaryDeactivations.push({
            constraint_id: "class-capacity",
            instance_type: "session",
            instance_id: violation.session_id,
            day: null,
          });
        }
        break;

      case "class_equipment":
        if (violation.session_id) {
          temporaryDeactivations.push({
            constraint_id: "class-equipment",
            instance_type: "session",
            instance_id: violation.session_id,
            day: null,
          });
        }
        break;

      case "lecturer_daily_hours":
        if (violation.lecturer_id && violation.day) {
          temporaryDeactivations.push({
            constraint_id: "lecturer-max-one-hour-per-day",
            instance_type: "lecturer",
            instance_id: violation.lecturer_id,
            day: violation.day,
          });
        }
        break;

      case "cohort_daily_hours":
        if (violation.cohort_id && violation.day) {
          temporaryDeactivations.push({
            constraint_id: "cohort-max-teaching-hours-per-day",
            instance_type: "cohort",
            instance_id: violation.cohort_id,
            day: violation.day,
          });
        }
        break;

      case "lecturer_lunch_break":
        if (violation.lecturer_id && violation.day) {
          temporaryDeactivations.push({
            constraint_id: "lecturer-lunch-break",
            instance_type: "lecturer",
            instance_id: violation.lecturer_id,
            day: violation.day,
          });
        }
        break;
    }
  }

  return (
    <>
      <h2>Solution</h2>

      {solverLoading && (
        <p className="step-description">Finding a feasible solution…</p>
      )}

      {!solverLoading && solverError && (
        <div className="solution-card">
          <div className="solution-score bad">
            Could not run the reschedule solver.
          </div>
          <p className="step-description">{solverError}</p>
        </div>
      )}

      {/* FEASIBLE FLOW: intentionally unchanged */}
      {!solverLoading && solverResult?.status === "feasible" && (
        <div className="solution-options">
          <div className="solution-card recommended">
            <div className="solution-card-header">
              <div>
                <h4>Feasible solution</h4>
                <div className="solution-class-name">
                  {selectedModuleLabel ?? selectedEventFallbackId}
                </div>
              </div>
              <span className="solution-tag">Recommended</span>
            </div>

            <div className="change-list">
              {/* Time */}
              {(originalModes?.time === "specific" ||
                originalModes?.time === "find") && (
                <div className="change-item">
                  <div className="change-item-label">Time</div>
                  <div className="change-item-values">
                    <span className="change-from">
                      {selectedEventDayTime ?? "—"}
                    </span>
                    <span className="change-arrow">→</span>
                    <span className="change-to">
                      {DAY_LABELS[
                        solverResult.day?.slice(0, 3).toLowerCase() ?? ""
                      ] ?? solverResult.day}{" "}
                      {solverResult.time}
                    </span>
                  </div>
                </div>
              )}

              {/* Room */}
              {(originalModes?.room === "specific" ||
                originalModes?.room === "find") && (
                <div className="change-item">
                  <div className="change-item-label">Room</div>
                  <div className="change-item-values">
                    <span className="change-from">
                      {selectedEventRoom ?? "—"}
                    </span>
                    <span className="change-arrow">→</span>
                    <span className="change-to">
                      {solverResult.room_id
                        ? getRoomName(solverResult.room_id)
                        : "—"}
                    </span>
                  </div>
                </div>
              )}

              {/* Lecturer */}
              {(originalModes?.lecturer === "specific" ||
                originalModes?.lecturer === "find") && (
                <div className="change-item">
                  <div className="change-item-label">Lecturer</div>
                  <div className="change-item-values">
                    <span className="change-from">
                      {selectedEventLecturerName ?? "—"}
                    </span>
                    <span className="change-arrow">→</span>
                    <span className="change-to">
                      {solverResult.lecturer_id
                        ? getLecturerName(solverResult.lecturer_id)
                        : "—"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {(solverResult.additional_changes?.length ?? 0) > 0 && (
            <div className="solution-exceptions">
              <div className="solution-exceptions-heading">
                <div>
                  <span className="solution-exceptions-eyebrow">
                    TIMETABLE REARRANGEMENT
                  </span>
                  <h3>Additional timetable changes</h3>
                </div>

                <span className="solution-exceptions-count">
                  {solverResult.additional_changes!.length}{" "}
                  {solverResult.additional_changes!.length === 1
                    ? "change"
                    : "changes"}
                </span>
              </div>

              <p className="solution-exceptions-intro">
                These classes were moved to make your requested change possible.
              </p>

              <div className="solution-exceptions-list">
                {solverResult.additional_changes!.map((change) => (
                  <div
                    key={change.session_id}
                    className="solution-exception-row"
                  >
                    <div style={{ width: "100%" }}>
                      <strong>
                        {getAdditionalChangeSessionLabel(change.session_id)}
                      </strong>

                      <div className="change-list">
                        {change.time_changed && (
                          <div className="change-item">
                            <div className="change-item-label">Time</div>

                            <div className="change-item-values">
                              <span className="change-from">
                                {DAY_LABELS[
                                  change.old_day.slice(0, 3).toLowerCase()
                                ] ?? change.old_day}{" "}
                                {change.old_time}
                              </span>

                              <span className="change-arrow">→</span>

                              <span className="change-to">
                                {DAY_LABELS[
                                  change.new_day.slice(0, 3).toLowerCase()
                                ] ?? change.new_day}{" "}
                                {change.new_time}
                              </span>
                            </div>
                          </div>
                        )}

                        {change.room_changed && (
                          <div className="change-item">
                            <div className="change-item-label">Room</div>

                            <div className="change-item-values">
                              <span className="change-from">
                                {getRoomName(change.old_room_id)}
                              </span>

                              <span className="change-arrow">→</span>

                              <span className="change-to">
                                {getRoomName(change.new_room_id)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="solution-exceptions-note">
                Lecturers are unchanged. All active constraints remain enforced.
              </p>
            </div>
          )}

          {appliedTemporaryDeactivations.length > 0 && (
            <div className="solution-exceptions">
              <div className="solution-exceptions-heading">
                <div>
                  <span className="solution-exceptions-eyebrow">
                    TEMPORARY EXCEPTIONS
                  </span>
                  <h3>Constraints deactivated for this solution</h3>
                </div>

                <span className="solution-exceptions-count">
                  {appliedTemporaryDeactivations.length}{" "}
                  {appliedTemporaryDeactivations.length === 1
                    ? "exception"
                    : "exceptions"}
                </span>
              </div>

              <p className="solution-exceptions-intro">
                This solution was found by temporarily deactivating the
                following constraints.
              </p>

              <div className="solution-exceptions-list">
                {appliedTemporaryDeactivations.map((constraint, index) => (
                  <div
                    key={`${constraint.constraint_id}-${constraint.instance_id}-${constraint.day ?? "all"}-${index}`}
                    className="solution-exception-row"
                  >
                    <div>
                      <strong>
                        {getTemporaryConstraintLabel(constraint.constraint_id)}
                      </strong>
                      <span>
                        {getTemporaryConstraintContext(constraint)}
                      </span>
                    </div>

                    <span className="solution-exception-badge">
                      Temporary
                    </span>
                  </div>
                ))}
              </div>

              <p className="solution-exceptions-note">
                These exceptions apply only to this solution. Your global
                constraint settings remain unchanged.
              </p>
            </div>
          )}
        </div>
      )}

      {!solverLoading && solverResult && solverResult.status !== "feasible" && (
        <div className="infeasible-flow">
          {/* 1. Outcome */}
          <section className="infeasible-outcome-card">
            <div className="infeasible-outcome-icon" aria-hidden="true">
              <TriangleAlert size={20} />
            </div>

            <div>
              <h3>This change isn't possible</h3>
              <p>
                {solverResult.reason ??
                  "We couldn't find a solution with the current request and constraints."}
              </p>
            </div>
          </section>

          {/* 2. Explanation */}
          <section className="infeasible-section-card">
            <div className="infeasible-section-heading">
              <span className="infeasible-eyebrow">
                Why this doesn't work
              </span>
              <h3>See what's blocking this request</h3>
            </div>

            {/* CASE A: Concrete request → show diagnostics directly */}
            {!needsInteractiveDiagnosis && solverResult.diagnostics && (
              <div className="diagnostics-section">
                <StakeholderViolationsPanel
                  violations={solverResult.diagnostics.violations}
                  proposedSlots={caseAProposedSlots}
                  excludeSessionId={excludeSessionId}
                  lecturers={lecturers}
                  rooms={rooms}
                  cohorts={cohorts}
                  sessions={sessions}
                  lecturerUnavailableSlotMap={lecturerUnavailableSlotMap}
                  formatViolationNice={formatViolationNice}
                  isRelaxableViolation={isRelaxableViolation}
                />
              </div>
            )}

            {/* CASE B: Any FIND → interactive diagnosis dropdowns */}
            {needsInteractiveDiagnosis && originalModes && (
              <div className="interactive-diagnosis">
                <p className="step-description">
                  Because you asked the system to <strong>find</strong> a value,
                  pick concrete options below to see why each combination
                  fails.
                </p>

                <div className="diag-dropdowns">
                  {originalModes.lecturer === "find" && (
                    <div>
                      <label>Lecturer</label>
                      <select
                        value={diagLecturer ?? ""}
                        onChange={(e) =>
                          onDiagLecturerChange(e.target.value || null)
                        }
                      >
                        <option value="">Select lecturer…</option>
                        {lecturers.map((lecturer) => (
                          <option key={lecturer.id} value={lecturer.id}>
                            {lecturer.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {originalModes.time === "find" && (
                    <>
                      <div>
                        <label>Day</label>
                        <select
                          value={diagDay ?? ""}
                          onChange={(e) =>
                            onDiagDayChange(e.target.value || null)
                          }
                        >
                          <option value="">Select day…</option>
                          {days.map((day) => (
                            <option key={day} value={day}>
                              {day}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label>Time</label>
                        <select
                          value={diagTime ?? ""}
                          onChange={(e) =>
                            onDiagTimeChange(e.target.value || null)
                          }
                        >
                          <option value="">Select time…</option>
                          {timeSlots.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {originalModes.room === "find" && (
                    <div>
                      <label>Room</label>
                      <select
                        value={diagRoom ?? ""}
                        onChange={(e) =>
                          onDiagRoomChange(e.target.value || null)
                        }
                      >
                        <option value="">Select room…</option>
                        {rooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {diagLoading && (
                  <p className="diagnosis-status">
                    Checking this combination…
                  </p>
                )}

                {diagError && (
                  <p className="diagnosis-error">{diagError}</p>
                )}

                {diagResult && (
                  <div className="diagnostics-section diagnostics-section-spaced">
                    <StakeholderViolationsPanel
                      violations={diagResult.violations}
                      proposedSlots={caseBProposedSlots}
                      excludeSessionId={excludeSessionId}
                      lecturers={lecturers}
                      rooms={rooms}
                      cohorts={cohorts}
                      sessions={sessions}
                      lecturerUnavailableSlotMap={lecturerUnavailableSlotMap}
                      formatViolationNice={formatViolationNice}
                      isRelaxableViolation={isRelaxableViolation}
                    />
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 3. Recovery */}
          <section className="infeasible-section-card recovery-card">
            <div className="infeasible-section-heading">
              <span className="infeasible-eyebrow">Try another approach</span>
              <h3>What are you willing to change?</h3>
              <p>
                Choose how the system should expand its search for a solution.
              </p>
            </div>

            <div className="recovery-options">
              {/* Option 1 — always available */}
              <div
                className={`recovery-option ${
                  selectedRecoveryOption === "different-request"
                    ? "selected"
                    : ""
                }`}
              >
                <button
                  type="button"
                  className="recovery-option-button"
                  onClick={() => toggleRecoveryOption("different-request")}
                  aria-expanded={
                    selectedRecoveryOption === "different-request"
                  }
                >
                  <div className="recovery-option-icon">
                    <CalendarRange size={20} />
                  </div>

                  <div className="recovery-option-copy">
                    <div className="recovery-option-title-row">
                      <h4>Choose a different option</h4>
                      {selectedRecoveryOption === "different-request" ? (
                        <ChevronUp size={18} />
                      ) : (
                        <ChevronDown size={18} />
                      )}
                    </div>

                    <p>
                      Look for another time, room, or lecturer for this class.
                    </p>

                    <span className="recovery-protection">
                      Existing timetable and constraints stay unchanged.
                    </span>
                  </div>
                </button>

                {selectedRecoveryOption === "different-request" && (
                  <div className="recovery-expanded">
                    <p>
                      Return to <strong>Step 1: Request</strong> to change your time,
                      room, lecturer, or other selections.
                    </p>

                    <button
                      type="button"
                      className="back-to-request-button"
                      onClick={onBackToRequest}
                    >
                      ← Back to Step 1
                    </button>
                  </div>
                )}
              </div>

              {/* Option 2 — disabled when lecturer unavailability is involved */}
              <div
                className={`recovery-option ${
                  selectedRecoveryOption === "rearrange" ? "selected" : ""
                } ${!canRearrange ? "disabled" : ""}`}
              >
                <button
                  type="button"
                  className="recovery-option-button"
                  onClick={() =>
                    canRearrange && toggleRecoveryOption("rearrange")
                  }
                  aria-expanded={selectedRecoveryOption === "rearrange"}
                  disabled={!canRearrange}
                >
                  <div className="recovery-option-icon">
                    <RefreshCw size={20} />
                  </div>

                  <div className="recovery-option-copy">
                    <div className="recovery-option-title-row">
                      <div className="recovery-title-with-status">
                        <h4>Rearrange the timetable</h4>
                        {!canRearrange && (
                          <span className="recovery-unavailable-badge">
                            Not available
                          </span>
                        )}
                      </div>

                      {canRearrange &&
                        (selectedRecoveryOption === "rearrange" ? (
                          <ChevronUp size={18} />
                        ) : (
                          <ChevronDown size={18} />
                        ))}
                    </div>

                    <p>
                      Keep this request and allow other classes to move to make
                      room.
                    </p>

                    {canRearrange ? (
                      <span className="recovery-protection">
                        Constraints stay enforced.
                      </span>
                    ) : hasLecturerUnavailability &&
                      lecturerUnavailableViolation ? (
                      <span className="recovery-disabled-reason">
                        Rearranging other classes cannot resolve all blockers. {" "}
                        {formatViolationNice(lecturerUnavailableViolation)}.
                      </span>
                    ) : (
                      <span className="recovery-disabled-reason">
                        Choose concrete values above first so we can check
                        whether rearranging can help.
                      </span>
                    )}
                  </div>
                </button>

                {selectedRecoveryOption === "rearrange" && canRearrange && (
                  <div className="recovery-expanded rearrange-expanded">
                    <div className="recovery-expanded-heading">
                      <h5>How much can the timetable change?</h5>
                      <p>
                        Keep this request fixed and choose how much disruption
                        the system may introduce elsewhere.
                      </p>
                    </div>

                    <div className="rearrange-choice-list">
                      <label
                        className={`rearrange-choice ${
                          rearrangeMode === "minimal" ? "selected" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="rearrange-mode"
                          value="minimal"
                          checked={rearrangeMode === "minimal"}
                          onChange={() => setRearrangeMode("minimal")}
                        />

                        <div className="rearrange-choice-copy">
                          <strong>Minimal disruption</strong>
                          <span>Move as little as possible. We’ll wire this mode next.</span>
                        </div>
                      </label>

                      <label
                        className={`rearrange-choice ${
                          rearrangeMode === "limit" ? "selected" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="rearrange-mode"
                          value="limit"
                          checked={rearrangeMode === "limit"}
                          onChange={() => setRearrangeMode("limit")}
                        />

                        <div className="rearrange-choice-copy">
                          <strong>Allow up to a set number of changes</strong>
                          <span>
                            Set the maximum number of additional time or room
                            changes the system may make.
                          </span>

                          <div
                            className={`rearrange-limit-control ${
                              rearrangeMode !== "limit" ? "disabled" : ""
                            }`}
                          >
                            <span>Allow up to</span>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={maxAdditionalChanges}
                              disabled={rearrangeMode !== "limit"}
                              onChange={(event) => {
                                const next = Number(event.target.value);
                                if (Number.isNaN(next)) return;
                                setMaxAdditionalChanges(
                                  Math.min(20, Math.max(1, next)),
                                );
                              }}
                            />
                            <span>additional changes</span>
                          </div>
                        </div>
                      </label>
                    </div>

                    <div className="rearrange-notice">
                      <strong>All constraints stay enforced.</strong>
                      <span>
                        A change means changing the time or room of another
                        class. Lecturers will not be changed.
                      </span>
                    </div>

                    <div className="recovery-actions">
                      <button
                        type="button"
                        className="find-rearrangements-button"
                        onClick={() => {
                          if (rearrangeMode !== "limit") return;
                          onFindRearrangements(maxAdditionalChanges);
                        }}
                        disabled={
                          rearrangeMode !== "limit" ||
                          maxAdditionalChanges < 1 ||
                          solverLoading
                        }
                      >
                        Find rearrangements
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Option 3 — available only when ALL blockers are relaxable */}
              <div
                className={`recovery-option ${
                  selectedRecoveryOption === "relax" ? "selected" : ""
                } ${!canRelax ? "disabled" : ""}`}
              >
                <button
                  type="button"
                  className="recovery-option-button"
                  onClick={() => canRelax && toggleRecoveryOption("relax")}
                  aria-expanded={selectedRecoveryOption === "relax"}
                  disabled={!canRelax}
                >
                  <div className="recovery-option-icon">
                    <SlidersHorizontal size={20} />
                  </div>

                  <div className="recovery-option-copy">
                    <div className="recovery-option-title-row">
                      <div className="recovery-title-with-status">
                        <h4>Relax constraints</h4>
                        {!canRelax && (
                          <span className="recovery-unavailable-badge">
                            Not available
                          </span>
                        )}
                      </div>

                      {canRelax &&
                        (selectedRecoveryOption === "relax" ? (
                          <ChevronUp size={18} />
                        ) : (
                          <ChevronDown size={18} />
                        ))}
                    </div>

                    <p>
                      Keep this request and allow selected scheduling
                      constraints to be relaxed.
                    </p>

                    {canRelax ? (
                      <span className="recovery-protection">
                        All current blockers are relaxable.
                      </span>
                    ) : firstUnrelaxableViolation ? (
                      <span className="recovery-disabled-reason">
                        This route cannot resolve all blockers. {" "}
                        {formatViolationNice(firstUnrelaxableViolation)} is an
                        unrelaxable constraint.
                      </span>
                    ) : (
                      <span className="recovery-disabled-reason">
                        Choose concrete values above first so we can check which
                        constraints are blocking the request.
                      </span>
                    )}
                  </div>
                </button>

                {selectedRecoveryOption === "relax" && canRelax && (
                  <>

                  <div className="recovery-expanded relax-expanded">
                    <div className="recovery-expanded-heading">
                      <h5>Temporarily deactivate blocking constraints</h5>
                      <p>
                        To retry this request, the following constraints would
                        need to be deactivated for this rescheduling attempt.
                      </p>

                      <HistoricalImpactSummary/>
                    </div>

                    <div className="temporary-relaxation-list">
                      {activeViolations.map((violation, index) => (
                        <div
                          key={`${violation.type}-${index}`}
                          className="temporary-relaxation-item"
                        >
                          <div className="temporary-relaxation-header">
                            <div>
                              <div className="temporary-relaxation-title">
                                {getConstraintLabel(violation.type)}
                              </div>

                              <div className="temporary-relaxation-detail">
                                {formatViolationNice(violation)}
                              </div>
                            </div>

                            <span className="temporary-badge">Temporary</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="temporary-relaxation-notice">
                      <strong>Only for this request.</strong>
                      <span>
                        These constraints would remain active in your global
                        constraint settings and for future scheduling attempts.
                      </span>
                    </div>

                    <div className="recovery-actions">
                      <button
                        type="button"
                        className="retry-with-relaxations-button"
                        onClick={() =>
                          onRetryWithRelaxations(temporaryDeactivations)
                        }
                        disabled={
                          temporaryDeactivations.length === 0 || solverLoading
                        }
                      >
                        Try again with constraints deactivated
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}