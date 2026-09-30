import { useState } from "react";
import { X, ArrowDown, ArrowUp } from "lucide-react";
import { ObjectiveValuesPanel } from "./ObjectiveValuesPanel";

type NamedEntity = { id: string; name: string; capacity?: number };
type ModuleLike = { id: string; code?: string; name?: string; title?: string };
type SessionLike = {
  id: string;
  moduleId?: string;
  lecturerId: string;
  room?: string;
  roomId?: string | null;
  cohortIds: string[];
};

type SessionContext = {
  session_id: string;
  day: string;
  start_time: string;
  end_time: string;
  start_slot: number;
  end_slot: number;
  room_id: string | null;
  lecturer_id: string | null;
};

type EmptyPeriod = {
  day: string;
  start_time: string;
  end_time: string;
  start_slot: number;
  end_slot: number;
  slots: number[];
  session_before: SessionContext | null;
  session_after: SessionContext | null;
};

type RoomWasteDetails = {
  room_id: string;
  room_capacity: number;
  required_capacity: number;
  unused_capacity: number;
  session_id: string;
  day: string;
  start_time: string;
  end_time: string;
  start_slot: number;
  end_slot: number;
};

type GapDetails = {
  gap_slots: number[];
  gaps_by_day: Record<string, number[]>;
  periods: EmptyPeriod[];
};

type LecturerIdleDetails = {
  idle_slots: number[];
  idle_by_day: Record<string, number[]>;
  periods: EmptyPeriod[];
};

type RoomChange = {
  session_a_id: string;
  session_b_id: string;
  room_a_id: string;
  room_b_id: string;
  day: string;
  first_session: SessionContext;
  second_session: SessionContext;
};

type RoomChangeDetails = { room_changes: RoomChange[] };

type ImpactAffected<T> = {
  id: string;
  before: number;
  after: number;
  delta: number;
  before_details: T | null;
  after_details: T | null;
};

type ImpactObjective<T> = {
  before: number;
  after: number;
  delta: number;
  weight: number;
  weighted_before: number;
  weighted_after: number;
  weighted_delta: number;
  affected: ImpactAffected<T>[];
};

export type PerturbationImpact = {
  baseline_score: number;
  proposed_score: number;
  score_delta: number;
  objectives: {
    room_waste: ImpactObjective<RoomWasteDetails>;
    cohort_gaps: ImpactObjective<GapDetails>;
    lecturer_idle: ImpactObjective<LecturerIdleDetails>;
    cohort_room_changes: ImpactObjective<RoomChangeDetails>;
  };
};

export type PerturbationImpactContentProps = {
  impact: PerturbationImpact;
  sessions: SessionLike[];
  modules: ModuleLike[];
  cohorts: NamedEntity[];
  lecturers: NamedEntity[];
  rooms: NamedEntity[];
};

type Props = PerturbationImpactContentProps & {
  onClose: () => void;
};

function formatDay(day: string) {
  return day ? day.charAt(0).toUpperCase() + day.slice(1) : "";
}

export function PerturbationImpactContent({
  impact,
  sessions,
  modules,
  cohorts,
  lecturers,
  rooms,
}: PerturbationImpactContentProps) {
  const [groupBy, setGroupBy] = useState<"stakeholder" | "objective">("stakeholder");

  const getSessionLabel = (sessionId: string) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session?.moduleId) return sessionId;
    const module = modules.find((item) => item.id === session.moduleId);
    if (!module) return session.moduleId;
    const code = module.code ?? module.id;
    const name = module.name ?? module.title;
    return name ? `${code} · ${name}` : code;
  };

  const getCohortName = (id: string) =>
    cohorts.find((item) => item.id === id)?.name ?? id;
  const getLecturerName = (id: string) =>
    lecturers.find((item) => item.id === id)?.name ?? id;
  const getRoomName = (id: string | null) =>
    id ? rooms.find((item) => item.id === id)?.name ?? id : "Unknown room";


  const roomWasteChanges = impact.objectives.room_waste.affected;
  const gapChanges = impact.objectives.cohort_gaps.affected;
  const idleChanges = impact.objectives.lecturer_idle.affected;
  const roomChangeChanges = impact.objectives.cohort_room_changes.affected;

  type StakeholderSummaryItem = {
    key: string;
    label: string;
  };

  const dedupeStakeholders = (items: StakeholderSummaryItem[]) =>
    Array.from(
      new Map(items.map((item) => [item.key, item])).values(),
    );

  const improvedStakeholders = dedupeStakeholders([
    ...roomWasteChanges
      .filter((change) => change.delta < 0)
      .map((change) => ({
        key: `session:${change.id}`,
        label: getSessionLabel(change.id),
      })),
    ...roomChangeChanges
      .filter((change) => change.delta < 0)
      .map((change) => ({
        key: `cohort:${change.id}`,
        label: getCohortName(change.id),
      })),
    ...gapChanges
      .filter((change) => change.delta < 0)
      .map((change) => ({
        key: `cohort:${change.id}`,
        label: getCohortName(change.id),
      })),
    ...idleChanges
      .filter((change) => change.delta < 0)
      .map((change) => ({
        key: `lecturer:${change.id}`,
        label: getLecturerName(change.id),
      })),
  ]);

  const worsenedStakeholders = dedupeStakeholders([
    ...roomWasteChanges
      .filter((change) => change.delta > 0)
      .map((change) => ({
        key: `session:${change.id}`,
        label: getSessionLabel(change.id),
      })),
    ...roomChangeChanges
      .filter((change) => change.delta > 0)
      .map((change) => ({
        key: `cohort:${change.id}`,
        label: getCohortName(change.id),
      })),
    ...gapChanges
      .filter((change) => change.delta > 0)
      .map((change) => ({
        key: `cohort:${change.id}`,
        label: getCohortName(change.id),
      })),
    ...idleChanges
      .filter((change) => change.delta > 0)
      .map((change) => ({
        key: `lecturer:${change.id}`,
        label: getLecturerName(change.id),
      })),
  ]);

  return (
    <>
          <div
            style={{
              padding: "16px 18px",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              background: "#ffffff",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#334155",
                marginBottom: 9,
              }}
            >
              Affected stakeholders
            </div>

            <div
              style={{
                marginBottom: 9,
                fontSize: 12,
                lineHeight: 1.5,
                color: "#64748b",
              }}
            >
              This recovery has positive and negative impacts on the timetable.
            </div>

            <div style={{ fontSize: 13, lineHeight: 1.6, color: "#475569" }}>
              <div>
                <strong style={{ color: "#0f172a" }}>Positive impacts:</strong>{" "}
                {improvedStakeholders.length > 0
                  ? improvedStakeholders.map((item) => item.label).join(", ")
                  : "None"}
              </div>
              <div style={{ marginTop: 3 }}>
                <strong style={{ color: "#0f172a" }}>Negative impacts:</strong>{" "}
                {worsenedStakeholders.length > 0
                  ? worsenedStakeholders.map((item) => item.label).join(", ")
                  : "None"}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
              Group impacts by
            </span>

            <div
              role="group"
              aria-label="Group impacts by"
              style={{
                display: "inline-flex",
                padding: 3,
                border: "1px solid #cbd5e1",
                borderRadius: 9,
                background: "#f8fafc",
              }}
            >
              {(["stakeholder", "objective"] as const).map((option) => {
                const active = groupBy === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setGroupBy(option)}
                    aria-pressed={active}
                    style={{
                      border: 0,
                      borderRadius: 6,
                      padding: "7px 12px",
                      background: active ? "#ffffff" : "transparent",
                      boxShadow: active ? "0 1px 3px rgba(15, 23, 42, 0.12)" : "none",
                      color: active ? "#0f172a" : "#64748b",
                      fontSize: 13,
                      fontWeight: active ? 700 : 600,
                      cursor: "pointer",
                    }}
                  >
                    {option === "stakeholder" ? "Stakeholder" : "Objective"}
                  </button>
                );
              })}
            </div>
          </div>

          <section style={{ marginTop: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <ArrowDown size={18} color="#15803d" />
              <h3 style={{ margin: 0, color: "#166534" }}>Improved for</h3>
            </div>

            {groupBy === "stakeholder" ? (
              <>
                {roomWasteChanges.filter((c) => c.delta < 0).map((change) => {
                  const before = change.before_details;
                  const after = change.after_details;
                  if (!before || !after) return null;

                  return (
                    <StakeholderGroup
                      tone="improved"
                      key={`stakeholder-room-waste-${change.id}`}
                      title={getSessionLabel(change.id)}
                    >
                      <StakeholderImpactItem title="Better room capacity match">
                        <BeforeAfterComparison
                          before={
                            <>
                              <DetailLine
                                primary={`${formatDay(before.day)} · ${before.start_time}–${before.end_time}`}
                                secondary={getRoomName(before.room_id)}
                              />
                              <div style={{ marginTop: 8 }}>
                                {before.room_capacity} seats · {before.unused_capacity} unused
                              </div>
                            </>
                          }
                          after={
                            <>
                              <DetailLine
                                primary={`${formatDay(after.day)} · ${after.start_time}–${after.end_time}`}
                                secondary={getRoomName(after.room_id)}
                              />
                              <div style={{ marginTop: 8 }}>
                                {after.room_capacity} seats · {after.unused_capacity} unused
                              </div>
                            </>
                          }
                        />
                        <div style={{ marginTop: 7, fontSize: 11, color: "#64748b" }}>
                          Class size: {after.required_capacity}
                        </div>
                      </StakeholderImpactItem>
                    </StakeholderGroup>
                  );
                })}

                {roomChangeChanges.filter((c) => c.delta < 0).map((change) => (
                  <StakeholderGroup
                      tone="improved"
                    key={`stakeholder-room-change-${change.id}`}
                    title={getCohortName(change.id)}
                  >
                    {(change.before_details?.room_changes ?? []).map((rc, index) => (
                      <StakeholderImpactItem
                        key={`stakeholder-room-change-item-${change.id}-${index}`}
                        title="Room change removed"
                      >
                        <BeforeAfterComparison
                          before={
                            <>
                              <DetailLine
                                primary={`${formatDay(rc.day)} · ${rc.first_session.start_time}–${rc.second_session.end_time}`}
                              />
                              <div style={{ marginTop: 8 }}>
                                <DetailLine
                                  primary={getSessionLabel(rc.first_session.session_id)}
                                  secondary={`${rc.first_session.start_time}–${rc.first_session.end_time} · ${getRoomName(rc.first_session.room_id)}`}
                                />
                                <div style={{ margin: "5px 0", color: "#64748b" }}>↓ room change</div>
                                <DetailLine
                                  primary={getSessionLabel(rc.second_session.session_id)}
                                  secondary={`${rc.second_session.start_time}–${rc.second_session.end_time} · ${getRoomName(rc.second_session.room_id)}`}
                                />
                              </div>
                            </>
                          }
                          after={
                            <DetailLine
                              primary="No consecutive room change"
                              secondary="These classes are no longer consecutive in different rooms."
                            />
                          }
                        />
                      </StakeholderImpactItem>
                    ))}
                  </StakeholderGroup>
                ))}
              </>            ) : (
              <>
                {roomWasteChanges.some((c) => c.delta < 0) && (
                  <ObjectiveGroup tone="improved" title="Room capacity match">
                    {roomWasteChanges.filter((c) => c.delta < 0).map((change) => {
                      const before = change.before_details;
                      const after = change.after_details;
                      if (!before || !after) return null;
                      return (
                        <ObjectiveItem key={`objective-room-waste-${change.id}`} title={getSessionLabel(change.id)}>
                          <BeforeAfterComparison
                            before={
                              <>
                                <DetailLine
                                  primary={`${formatDay(before.day)} · ${before.start_time}–${before.end_time}`}
                                  secondary={getRoomName(before.room_id)}
                                />
                                <div style={{ marginTop: 8 }}>
                                  {before.room_capacity} seats · {before.unused_capacity} unused
                                </div>
                              </>
                            }
                            after={
                              <>
                                <DetailLine
                                  primary={`${formatDay(after.day)} · ${after.start_time}–${after.end_time}`}
                                  secondary={getRoomName(after.room_id)}
                                />
                                <div style={{ marginTop: 8 }}>
                                  {after.room_capacity} seats · {after.unused_capacity} unused
                                </div>
                              </>
                            }
                          />
                          <div style={{ marginTop: 7, fontSize: 11, color: "#64748b" }}>
                            Class size: {after.required_capacity}
                          </div>
                        </ObjectiveItem>
                      );
                    })}
                  </ObjectiveGroup>
                )}

                {roomChangeChanges.some((c) => c.delta < 0) && (
                  <ObjectiveGroup tone="improved" title="Cohort room changes">
                    {roomChangeChanges.filter((c) => c.delta < 0).flatMap((change) =>
                      (change.before_details?.room_changes ?? []).map((rc, index) => (
                        <ObjectiveItem
                          key={`objective-room-change-${change.id}-${index}`}
                          title={getCohortName(change.id)}
                        >
                          <BeforeAfterComparison
                            before={
                              <>
                                <DetailLine
                                  primary={`${formatDay(rc.day)} · ${rc.first_session.start_time}–${rc.second_session.end_time}`}
                                />
                                <div style={{ marginTop: 8 }}>
                                  <DetailLine
                                    primary={getSessionLabel(rc.first_session.session_id)}
                                    secondary={`${rc.first_session.start_time}–${rc.first_session.end_time} · ${getRoomName(rc.first_session.room_id)}`}
                                  />
                                  <div style={{ margin: "5px 0", color: "#64748b" }}>↓ room change</div>
                                  <DetailLine
                                    primary={getSessionLabel(rc.second_session.session_id)}
                                    secondary={`${rc.second_session.start_time}–${rc.second_session.end_time} · ${getRoomName(rc.second_session.room_id)}`}
                                  />
                                </div>
                              </>
                            }
                            after={
                              <DetailLine
                                primary="No consecutive room change"
                                secondary="These classes are no longer consecutive in different rooms."
                              />
                            }
                          />
                        </ObjectiveItem>
                      ))
                    )}
                  </ObjectiveGroup>
                )}
              </>
            )}
          </section>

          <section style={{ marginTop: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <ArrowUp size={18} color="#b91c1c" />
              <h3 style={{ margin: 0, color: "#991b1b" }}>Worsened for</h3>
            </div>

            {groupBy === "stakeholder" ? (
              <>
                {gapChanges.filter((c) => c.delta > 0).map((change) => (
                  <StakeholderGroup
                      tone="worsened"
                    key={`stakeholder-gap-${change.id}`}
                    title={getCohortName(change.id)}
                  >
                    {(change.after_details?.periods ?? []).map((period, index) => (
                      <StakeholderImpactItem
                        key={`stakeholder-gap-item-${change.id}-${index}`}
                        title="New timetable gap"
                      >
                        <BeforeAfterComparison
                          before={<DetailLine primary="No timetable gap" />}
                          after={
                            <>
                              <DetailLine
                                primary={`${period.slots.length}-hour gap`}
                                secondary={`${formatDay(period.day)} · ${period.start_time}–${period.end_time}`}
                              />
                              {period.session_before && period.session_after && (
                                <div style={{ marginTop: 8 }}>
                                  <DetailLine
                                    primary={getSessionLabel(period.session_before.session_id)}
                                    secondary={`${period.session_before.start_time}–${period.session_before.end_time} · ${getRoomName(period.session_before.room_id)}`}
                                  />
                                  <div style={{ margin: "5px 0", color: "#64748b" }}>↓ gap</div>
                                  <DetailLine
                                    primary={getSessionLabel(period.session_after.session_id)}
                                    secondary={`${period.session_after.start_time}–${period.session_after.end_time} · ${getRoomName(period.session_after.room_id)}`}
                                  />
                                </div>
                              )}
                            </>
                          }
                        />
                      </StakeholderImpactItem>
                    ))}
                  </StakeholderGroup>
                ))}

                {idleChanges.filter((c) => c.delta > 0).map((change) => (
                  <StakeholderGroup
                      tone="worsened"
                    key={`stakeholder-idle-${change.id}`}
                    title={getLecturerName(change.id)}
                  >
                    {(change.after_details?.periods ?? []).map((period, index) => (
                      <StakeholderImpactItem
                        key={`stakeholder-idle-item-${change.id}-${index}`}
                        title="New idle period"
                      >
                        <BeforeAfterComparison
                          before={<DetailLine primary="No idle period" />}
                          after={
                            <>
                              <DetailLine
                                primary={`${period.slots.length}-hour idle period`}
                                secondary={`${formatDay(period.day)} · ${period.start_time}–${period.end_time}`}
                              />
                              {period.session_before && period.session_after && (
                                <div style={{ marginTop: 8 }}>
                                  <DetailLine
                                    primary={getSessionLabel(period.session_before.session_id)}
                                    secondary={`${period.session_before.start_time}–${period.session_before.end_time} · ${getRoomName(period.session_before.room_id)}`}
                                  />
                                  <div style={{ margin: "5px 0", color: "#64748b" }}>↓ idle</div>
                                  <DetailLine
                                    primary={getSessionLabel(period.session_after.session_id)}
                                    secondary={`${period.session_after.start_time}–${period.session_after.end_time} · ${getRoomName(period.session_after.room_id)}`}
                                  />
                                </div>
                              )}
                            </>
                          }
                        />
                      </StakeholderImpactItem>
                    ))}
                  </StakeholderGroup>
                ))}
              </>            ) : (
              <>
                {gapChanges.some((c) => c.delta > 0) && (
                  <ObjectiveGroup tone="worsened" title="Cohort timetable gaps">
                    {gapChanges.filter((c) => c.delta > 0).flatMap((change) =>
                      (change.after_details?.periods ?? []).map((period, index) => (
                        <ObjectiveItem
                          key={`objective-gap-${change.id}-${index}`}
                          title={getCohortName(change.id)}
                        >
                          <BeforeAfterComparison
                            before={<DetailLine primary="No timetable gap" />}
                            after={
                              <>
                                <DetailLine
                                  primary={`${period.slots.length}-hour gap`}
                                  secondary={`${formatDay(period.day)} · ${period.start_time}–${period.end_time}`}
                                />
                                {period.session_before && period.session_after && (
                                  <div style={{ marginTop: 8 }}>
                                    <DetailLine
                                      primary={getSessionLabel(period.session_before.session_id)}
                                      secondary={`${period.session_before.start_time}–${period.session_before.end_time} · ${getRoomName(period.session_before.room_id)}`}
                                    />
                                    <div style={{ margin: "5px 0", color: "#64748b" }}>↓ gap</div>
                                    <DetailLine
                                      primary={getSessionLabel(period.session_after.session_id)}
                                      secondary={`${period.session_after.start_time}–${period.session_after.end_time} · ${getRoomName(period.session_after.room_id)}`}
                                    />
                                  </div>
                                )}
                              </>
                            }
                          />
                        </ObjectiveItem>
                      ))
                    )}
                  </ObjectiveGroup>
                )}

                {idleChanges.some((c) => c.delta > 0) && (
                  <ObjectiveGroup tone="worsened" title="Lecturer idle time">
                    {idleChanges.filter((c) => c.delta > 0).flatMap((change) =>
                      (change.after_details?.periods ?? []).map((period, index) => (
                        <ObjectiveItem
                          key={`objective-idle-${change.id}-${index}`}
                          title={getLecturerName(change.id)}
                        >
                          <BeforeAfterComparison
                            before={<DetailLine primary="No idle period" />}
                            after={
                              <>
                                <DetailLine
                                  primary={`${period.slots.length}-hour idle period`}
                                  secondary={`${formatDay(period.day)} · ${period.start_time}–${period.end_time}`}
                                />
                                {period.session_before && period.session_after && (
                                  <div style={{ marginTop: 8 }}>
                                    <DetailLine
                                      primary={getSessionLabel(period.session_before.session_id)}
                                      secondary={`${period.session_before.start_time}–${period.session_before.end_time} · ${getRoomName(period.session_before.room_id)}`}
                                    />
                                    <div style={{ margin: "5px 0", color: "#64748b" }}>↓ idle</div>
                                    <DetailLine
                                      primary={getSessionLabel(period.session_after.session_id)}
                                      secondary={`${period.session_after.start_time}–${period.session_after.end_time} · ${getRoomName(period.session_after.room_id)}`}
                                    />
                                  </div>
                                )}
                              </>
                            }
                          />
                        </ObjectiveItem>
                      ))
                    )}
                  </ObjectiveGroup>
                )}
              </>
            )}
          </section>

          <ObjectiveValuesPanel
            objectives={impact.objectives}
            baselineScore={impact.baseline_score}
            proposedScore={impact.proposed_score}
            scoreDelta={impact.score_delta}
          />
    </>
  );
}

export function PerturbationImpactModal({
  impact, sessions, modules, cohorts, lecturers, rooms, onClose,
}: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="perturbation-impact-title"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(760px, 100%)", maxHeight: "85vh", overflowY: "auto",
          background: "#fff", borderRadius: 14,
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
        }}
      >
        <div style={{
          padding: "22px 24px", borderBottom: "1px solid #e2e8f0",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20,
        }}>
          <div>
            <div style={{
              fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "#64748b",
            }}>
              TIMETABLE IMPACT
            </div>
            <h2 id="perturbation-impact-title" style={{ margin: "5px 0 0", fontSize: 21 }}>
              Impact of this recovery
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close impact details"
            style={{ border: 0, background: "transparent", cursor: "pointer", padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          <PerturbationImpactContent
            impact={impact}
            sessions={sessions}
            modules={modules}
            cohorts={cohorts}
            lecturers={lecturers}
            rooms={rooms}
          />
        </div>


        <div style={{
          padding: "16px 24px", borderTop: "1px solid #e2e8f0",
          display: "flex", justifyContent: "flex-end",
        }}>
          <button type="button" onClick={onClose}
            style={{
              padding: "9px 16px", border: "1px solid #cbd5e1",
              borderRadius: 8, background: "#fff", cursor: "pointer", fontWeight: 600,
            }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}




function BeforeAfterComparison({
  before,
  after,
}: {
  before: React.ReactNode;
  after: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 28px minmax(0, 1fr)",
        gap: 8,
        alignItems: "stretch",
        marginTop: 9,
      }}
    >
      <ComparisonSide label="Before">{before}</ComparisonSide>
      <div
        aria-hidden="true"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748b",
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        →
      </div>
      <ComparisonSide label="After">{after}</ComparisonSide>
    </div>
  );
}

function ComparisonSide({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: "10px 11px",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <div
        style={{
          marginBottom: 7,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "#64748b",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.5, color: "#334155" }}>
        {children}
      </div>
    </div>
  );
}

function DetailLine({
  primary,
  secondary,
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ fontWeight: 700, color: "#0f172a" }}>{primary}</div>
      {secondary && (
        <div style={{ marginTop: 2, color: "#64748b" }}>{secondary}</div>
      )}
    </div>
  );
}

function StakeholderGroup({
  title,
  children,
  tone = "neutral",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "improved" | "worsened" | "neutral";
}) {
  const accent =
    tone === "improved"
      ? { border: "#bbf7d0", background: "#f0fdf4", color: "#166534" }
      : tone === "worsened"
        ? { border: "#fecaca", background: "#fef2f2", color: "#991b1b" }
        : { border: "#e2e8f0", background: "#f8fafc", color: "#334155" };
  return (
    <div
      style={{
        border: `1px solid ${accent.border}`,
        borderRadius: 10,
        marginBottom: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          background: accent.background,
          borderBottom: `1px solid ${accent.border}`,
          fontSize: 13,
          fontWeight: 700,
          color: accent.color,
        }}
      >
        {title}
      </div>
      <div style={{ padding: "2px 14px" }}>{children}</div>
    </div>
  );
}

function StakeholderImpactItem({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "12px 0",
        borderBottom: "1px solid #eef2f7",
        fontSize: 14,
        lineHeight: 1.55,
        color: "#334155",
      }}
    >
      <strong
        style={{
          display: "block",
          fontSize: 13,
          color: "#475569",
          marginBottom: 5,
        }}
      >
        {title}
      </strong>
      {children}
    </div>
  );
}

function ObjectiveGroup({
  title,
  children,
  tone = "neutral",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "improved" | "worsened" | "neutral";
}) {
  const accent =
    tone === "improved"
      ? { border: "#bbf7d0", background: "#f0fdf4", color: "#166534" }
      : tone === "worsened"
        ? { border: "#fecaca", background: "#fef2f2", color: "#991b1b" }
        : { border: "#e2e8f0", background: accent.background, color: "#334155" };
  return (
    <div
      style={{
        border: `1px solid ${accent.border}`,
        borderRadius: 10,
        marginBottom: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          background: "#f8fafc",
          borderBottom: `1px solid ${accent.border}`,
          fontSize: 13,
          fontWeight: 700,
          color: accent.color,
        }}
      >
        {title}
      </div>
      <div style={{ padding: "2px 14px" }}>{children}</div>
    </div>
  );
}

function ObjectiveItem({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "12px 0",
        borderBottom: "1px solid #eef2f7",
        fontSize: 14,
        lineHeight: 1.55,
        color: "#334155",
      }}
    >
      <strong style={{ display: "block", fontSize: 14, color: "#0f172a", marginBottom: 5 }}>
        {title}
      </strong>
      {children}
    </div>
  );
}