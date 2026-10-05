import { useEffect, useMemo, useState, type ReactNode } from "react";
import { StakeholderViolationsPanel } from "./StakeholderViolationsPanel";

type Mode = "keep" | "specific" | "find";
type FindExplanationView = "summary" | "explore" | "overview";

type Violation = { type: string; [key: string]: any };
type Diagnostics = { violations: Violation[]; overlapping_sessions: string[] };

export type SearchSpaceDiagnosis = {
  key: string;
  day: string;
  time: string;
  roomId: string;
  roomName: string;
  lecturerId: string;
  lecturerName: string;
  diagnostics: Diagnostics | null;
  error: string | null;
};

type Props = {
  originalModes: { time: Mode; room: Mode; lecturer: Mode };
  searchSpaceResults: SearchSpaceDiagnosis[];
  searchSpaceLoading: boolean;
  searchSpaceError: string | null;
  loadSearchSpaceDiagnosis: () => void | Promise<void>;

  days: string[];
  timeSlots: string[];
  lecturers: any[];
  rooms: any[];
  cohorts: any[];
  sessions: any[];
  lecturerUnavailableSlotMap: Record<string, string[]>;
  excludeSessionId: string;
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

  formatViolationNice: (v: Violation) => string;
  isRelaxableViolation: (type: string) => boolean;
  renderRoomSuitability?: (violations: Violation[]) => ReactNode;
  getRoomName: (id: string) => string;
  getLecturerName: (id: string) => string;
};

type RankingItem = {
  key: string;
  label: string;
  sublabel?: string;
  count: number;
  slots: string[];
};

const constraintLabel = (type: string) => {
  const labels: Record<string, string> = {
    lecturer_overlap: "Lecturer overlap",
    room_overlap: "Room overlap",
    cohort_overlap: "Cohort overlap",
    lecturer_unavailable: "Lecturer unavailable",
    class_capacity: "Room capacity",
    class_equipment: "Room equipment",
    cohort_daily_hours: "Cohort daily hours",
    lecturer_daily_hours: "Lecturer daily hours",
    lecturer_lunch_break: "Lecturer lunch break",
  };
  return labels[type] ?? type.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
};

function RankingRow({
  item,
  max,
  total,
  searchSpaceResults,
  formatViolationNice,
}: {
  item: RankingItem;
  max: number;
  total: number;
  searchSpaceResults: SearchSpaceDiagnosis[];
  formatViolationNice: (v: Violation) => string;
}) {
  const [open, setOpen] = useState(false);
  const [showAllSlots, setShowAllSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const width = max > 0 ? Math.max(5, (item.count / max) * 100) : 0;

  const visibleSlots = showAllSlots ? item.slots : item.slots.slice(0, 18);

  const selectedSlotSummary = useMemo(() => {
    if (!selectedSlot) return null;

    const matchingCandidates = searchSpaceResults.filter(
      (candidate) => `${candidate.day} ${candidate.time}` === selectedSlot,
    );

    const otherProblems = new Set<string>();

    for (const candidate of matchingCandidates) {
      for (const violation of candidate.diagnostics?.violations ?? []) {
        const label = formatViolationNice(violation);
        const sameConstraint = constraintLabel(violation.type) === item.sublabel;
        const sameStakeholder = label.includes(item.label);

        if (sameConstraint && sameStakeholder) continue;
        otherProblems.add(label);
      }
    }

    return [...otherProblems];
  }, [
    selectedSlot,
    searchSpaceResults,
    formatViolationNice,
    item.label,
    item.sublabel,
  ]);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (open) {
            setSelectedSlot(null);
            setShowAllSlots(false);
          }
        }}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns:
            "minmax(170px, 0.9fr) minmax(120px, 1.15fr) 76px",
          gap: 14,
          alignItems: "center",
          padding: "10px 0",
          border: 0,
          background: "transparent",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
            {item.label}
          </div>
          {item.sublabel && (
            <div style={{ marginTop: 2, fontSize: 12, color: "#64748b" }}>
              {item.sublabel}
            </div>
          )}
        </div>

        <div
          style={{
            height: 9,
            borderRadius: 999,
            background: "#e2e8f0",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${width}%`,
              height: "100%",
              borderRadius: 999,
              background: "#64748b",
            }}
          />
        </div>

        <span
          style={{ fontSize: 12, color: "#64748b", textAlign: "right" }}
        >
          {item.count} / {total}
        </span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 30,
            top: "calc(100% + 4px)",
            left: 0,
            width: 390,
            maxWidth: "min(390px, 92vw)",
            padding: 14,
            border: "1px solid #cbd5e1",
            borderRadius: 10,
            background: "#fff",
            boxShadow: "0 10px 28px rgba(15,23,42,.14)",
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "start",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#172033",
                  marginBottom: 2,
                }}
              >
                {item.label}
              </div>
              {item.sublabel && (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#475569",
                    marginBottom: 7,
                  }}
                >
                  {item.sublabel}
                </div>
              )}
            </div>

            <button
              type="button"
              aria-label="Close details"
              onClick={() => {
                setOpen(false);
                setSelectedSlot(null);
                setShowAllSlots(false);
              }}
              style={{
                border: 0,
                background: "transparent",
                padding: "0 2px",
                color: "#64748b",
                cursor: "pointer",
                fontSize: 17,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              fontSize: 12,
              color: "#64748b",
              marginBottom: 10,
            }}
          >
            Involved in {item.count} failed candidate placement
            {item.count === 1 ? "" : "s"}.
          </div>

          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: ".04em",
              marginBottom: 6,
            }}
          >
            Related slots
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {visibleSlots.map((slot) => {
              const selected = selectedSlot === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() =>
                    setSelectedSlot((current) =>
                      current === slot ? null : slot,
                    )
                  }
                  style={{
                    fontSize: 11,
                    padding: "4px 7px",
                    borderRadius: 6,
                    border: selected
                      ? "1px solid #64748b"
                      : "1px solid transparent",
                    background: selected ? "#e2e8f0" : "#f1f5f9",
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  {slot}
                </button>
              );
            })}

            {item.slots.length > 18 && (
              <button
                type="button"
                onClick={() => setShowAllSlots((value) => !value)}
                style={{
                  fontSize: 11,
                  padding: "4px 6px",
                  border: 0,
                  borderRadius: 6,
                  background: "transparent",
                  color: "#475569",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {showAllSlots
                  ? "Show fewer"
                  : `+${item.slots.length - 18} more`}
              </button>
            )}
          </div>

          {selectedSlot && selectedSlotSummary && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <strong style={{ display: "block", marginBottom: 3, fontSize: 12, color: "#334155" }}>
                {selectedSlot}
              </strong>

              <div
                style={{
                  marginBottom: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: ".04em",
                }}
              >
                What else is not possible at this time?
              </div>

              {selectedSlotSummary.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
                  {selectedSlotSummary.map((label) => (
                    <div key={label} style={{ fontSize: 11, lineHeight: 1.4, color: "#475569" }}>
                      {label}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  No other constraint violations were found at this time.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CompactViolationLabels({ result }: { result: SearchSpaceDiagnosis }) {
  if (result.error) return <span style={{ color: "#b91c1c" }}>{result.error}</span>;
  const types = [...new Set((result.diagnostics?.violations ?? []).map((v) => v.type))];
  if (!types.length) return <span style={{ color: "#64748b" }}>No violation returned</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {types.map((type) => (
        <span key={type} style={{ padding: "4px 8px", borderRadius: 999, background: "#f1f5f9", color: "#334155", fontSize: 12, fontWeight: 600 }}>
          {constraintLabel(type)}
        </span>
      ))}
    </div>
  );
}

export function AnyRequestExplanation(props: Props) {
  const [view, setView] = useState<FindExplanationView>("summary");
  const [overviewConstraint, setOverviewConstraint] = useState("all");
  const [overviewRelaxability, setOverviewRelaxability] = useState<"all" | "relaxable-only" | "contains-non-relaxable">("all");
  const [overviewQuery, setOverviewQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if ((view === "summary" || view === "overview") && props.searchSpaceResults.length === 0 && !props.searchSpaceLoading) {
      void props.loadSearchSpaceDiagnosis();
    }
  }, [view, props.searchSpaceResults.length, props.searchSpaceLoading]);

  const blockerRanking = useMemo(() => {
    const blockerMap = new Map<
      string,
      {
        stakeholder: string;
        constraint: string;
        candidates: Set<string>;
        slots: Set<string>;
      }
    >();

    const cohortName = (id: string) =>
      props.cohorts.find((c) => c.id === id)?.name ?? id;

    for (const candidate of props.searchSpaceResults) {
      const slot = `${candidate.day} ${candidate.time}`;

      for (const v of candidate.diagnostics?.violations ?? []) {
        const stakeholders: Array<{ key: string; label: string }> = [];

        if (v.lecturer_id) {
          stakeholders.push({
            key: `lecturer:${v.lecturer_id}`,
            label: props.getLecturerName(v.lecturer_id),
          });
        }
        if (v.room_id) {
          stakeholders.push({
            key: `room:${v.room_id}`,
            label: props.getRoomName(v.room_id),
          });
        }
        if (v.cohort_id) {
          stakeholders.push({
            key: `cohort:${v.cohort_id}`,
            label: cohortName(v.cohort_id),
          });
        }

        // Some violations may not carry a stakeholder id.
        if (stakeholders.length === 0) {
          stakeholders.push({
            key: "timetable",
            label: "Timetable",
          });
        }

        for (const stakeholder of stakeholders) {
          const key = `${stakeholder.key}::${v.type}`;
          const entry = blockerMap.get(key) ?? {
            stakeholder: stakeholder.label,
            constraint: constraintLabel(v.type),
            candidates: new Set<string>(),
            slots: new Set<string>(),
          };

          entry.candidates.add(candidate.key);
          entry.slots.add(slot);
          blockerMap.set(key, entry);
        }
      }
    }

    return [...blockerMap.entries()]
      .map(([key, entry]): RankingItem => ({
        key,
        label: entry.stakeholder,
        sublabel: entry.constraint,
        count: entry.candidates.size,
        slots: [...entry.slots],
      }))
      .sort((a, b) => b.count - a.count);
  }, [
    props.searchSpaceResults,
    props.cohorts,
    props.getLecturerName,
    props.getRoomName,
  ]);

  const maxBlocker = blockerRanking[0]?.count ?? 1;

  const overviewConstraintTypes = useMemo(() => {
    const types = new Set<string>();
    for (const result of props.searchSpaceResults) {
      for (const violation of result.diagnostics?.violations ?? []) {
        types.add(violation.type);
      }
    }
    return [...types].sort((a, b) =>
      constraintLabel(a).localeCompare(constraintLabel(b)),
    );
  }, [props.searchSpaceResults]);

  const overviewGroups = useMemo(() => {
    const query = overviewQuery.trim().toLowerCase();
    const filtered = props.searchSpaceResults.filter((result) => {
      const violations = result.diagnostics?.violations ?? [];
      if (overviewConstraint !== "all" && !violations.some((v) => v.type === overviewConstraint)) return false;
      const allRelaxable = violations.length > 0 && violations.every((v) => props.isRelaxableViolation(v.type));
      const containsNonRelaxable = violations.some((v) => !props.isRelaxableViolation(v.type));
      if (overviewRelaxability === "relaxable-only" && !allRelaxable) return false;
      if (overviewRelaxability === "contains-non-relaxable" && !containsNonRelaxable) return false;
      if (!query) return true;
      return [result.day, result.time, result.roomName, result.lecturerName, ...violations.map((v) => constraintLabel(v.type)), ...violations.map(props.formatViolationNice)]
        .join(" ").toLowerCase().includes(query);
    });

    const map = new Map<string, { key: string; day: string; time: string; results: SearchSpaceDiagnosis[]; constraints: Array<{type:string;count:number}> }>();
    for (const result of filtered) {
      const key = `${result.day}__${result.time}`;
      const group = map.get(key) ?? { key, day: result.day, time: result.time, results: [], constraints: [] };
      group.results.push(result);
      map.set(key, group);
    }
    return [...map.values()].map((group) => {
      const counts = new Map<string, number>();
      for (const result of group.results) {
        const seen = new Set<string>();
        for (const v of result.diagnostics?.violations ?? []) {
          if (!seen.has(v.type)) { seen.add(v.type); counts.set(v.type, (counts.get(v.type) ?? 0) + 1); }
        }
      }
      group.constraints = [...counts.entries()].map(([type,count]) => ({type,count})).sort((a,b) => b.count-a.count);
      return group;
    });
  }, [props.searchSpaceResults, props.formatViolationNice, props.isRelaxableViolation, overviewConstraint, overviewRelaxability, overviewQuery]);

  const filteredCandidateCount = overviewGroups.reduce((n, g) => n + g.results.length, 0);
  const toggleOverviewGroup = (key: string) => setExpandedGroups((current) => {
    const next = new Set(current);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const totalCandidates = props.searchSpaceResults.length;
  const [showAllBlockers, setShowAllBlockers] = useState(false);
  const visibleBlockers = showAllBlockers ? blockerRanking : blockerRanking.slice(0, 7);

  return (
    <div className="interactive-diagnosis">
      <div role="group" aria-label="Explanation view" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginBottom: 18, paddingTop: 4 }}>
        {(["summary", "explore", "overview"] as const).map((value, index) => {
          const selected = view === value;
          return <button key={value} type="button" onClick={() => setView(value)} aria-label={`View ${index + 1}`} aria-pressed={selected} title={`View ${index + 1}`} style={{ width: 14, height: 14, padding: 0, borderRadius: 999, border: selected ? "2px solid #64748b" : "2px solid #94a3b8", background: selected ? "#64748b" : "#fff", cursor: "pointer", boxShadow: selected ? "0 0 0 3px rgba(100,116,139,.14)" : "none" }} />;
        })}
      </div>

      {view === "summary" && (
        <div className="diagnostics-section">
          <h4 style={{ marginTop: 0, marginBottom: 6 }}>Why was no placement found?</h4>
          <p className="step-description" style={{ marginTop: 0 }}>
            Every candidate placement violated at least one active timetable constraint. The ranking shows the specific stakeholder–constraint combinations most frequently involved across the failed search.
          </p>
          {props.searchSpaceLoading && <p className="diagnosis-status">Analysing the search space…</p>}
          {props.searchSpaceError && <p className="diagnosis-error">{props.searchSpaceError}</p>}
          {!props.searchSpaceLoading && props.searchSpaceResults.length > 0 && (
            <div style={{ marginTop: 24, maxWidth: 1180 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
                Most frequently involved constraints
              </div>

              {visibleBlockers.map((item) => (
                <RankingRow
                  key={item.key}
                  item={item}
                  max={maxBlocker}
                  total={totalCandidates}
                  searchSpaceResults={props.searchSpaceResults}
                  formatViolationNice={props.formatViolationNice}
                />
              ))}

              {blockerRanking.length > 7 && (
                <button
                  type="button"
                  onClick={() => setShowAllBlockers((value) => !value)}
                  style={{ marginTop: 10, padding: 0, border: 0, background: "transparent", color: "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  {showAllBlockers
                    ? "Show fewer"
                    : `Show ${blockerRanking.length - 7} more`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {view === "explore" && (
        <>
          <p className="step-description" style={{ marginBottom: 16 }}>
            Pick a concrete option below to see exactly why that candidate fails.
          </p>

          <div
            className="diag-dropdowns"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              alignItems: "end",
              padding: 16,
              marginBottom: 18,
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              background: "#f8fafc",
            }}
          >
            {props.originalModes.lecturer === "find" && (
              <div style={{ minWidth: 0 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#475569",
                  }}
                >
                  Lecturer
                </label>
                <select
                  value={props.diagLecturer ?? ""}
                  onChange={(e) =>
                    props.onDiagLecturerChange(e.target.value || null)
                  }
                  style={{
                    width: "100%",
                    height: 42,
                    padding: "0 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    background: "#ffffff",
                    color: "#172033",
                    fontSize: 13,
                  }}
                >
                  <option value="">Select lecturer…</option>
                  {props.lecturers.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {props.originalModes.time === "find" && (
              <>
                <div style={{ minWidth: 0 }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#475569",
                    }}
                  >
                    Day
                  </label>
                  <select
                    value={props.diagDay ?? ""}
                    onChange={(e) =>
                      props.onDiagDayChange(e.target.value || null)
                    }
                    style={{
                      width: "100%",
                      height: 42,
                      padding: "0 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      background: "#ffffff",
                      color: "#172033",
                      fontSize: 13,
                    }}
                  >
                    <option value="">Select day…</option>
                    {props.days.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ minWidth: 0 }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#475569",
                    }}
                  >
                    Time
                  </label>
                  <select
                    value={props.diagTime ?? ""}
                    onChange={(e) =>
                      props.onDiagTimeChange(e.target.value || null)
                    }
                    style={{
                      width: "100%",
                      height: 42,
                      padding: "0 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      background: "#ffffff",
                      color: "#172033",
                      fontSize: 13,
                    }}
                  >
                    <option value="">Select time…</option>
                    {props.timeSlots.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {props.originalModes.room === "find" && (
              <div style={{ minWidth: 0 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#475569",
                  }}
                >
                  Room
                </label>
                <select
                  value={props.diagRoom ?? ""}
                  onChange={(e) =>
                    props.onDiagRoomChange(e.target.value || null)
                  }
                  style={{
                    width: "100%",
                    height: 42,
                    padding: "0 12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    background: "#ffffff",
                    color: "#172033",
                    fontSize: 13,
                  }}
                >
                  <option value="">Select room…</option>
                  {props.rooms.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {props.diagLoading && (
            <p className="diagnosis-status">Checking this combination…</p>
          )}
          {props.diagError && (
            <p className="diagnosis-error">{props.diagError}</p>
          )}
          {props.diagResult && (
            <div className="diagnostics-section diagnostics-section-spaced">
              <StakeholderViolationsPanel
                violations={props.diagResult.violations}
                proposedSlots={props.caseBProposedSlots}
                excludeSessionId={props.excludeSessionId}
                lecturers={props.lecturers}
                rooms={props.rooms}
                cohorts={props.cohorts}
                sessions={props.sessions}
                lecturerUnavailableSlotMap={props.lecturerUnavailableSlotMap}
                formatViolationNice={props.formatViolationNice}
                isRelaxableViolation={props.isRelaxableViolation}
                renderRoomSuitability={props.renderRoomSuitability}
              />
            </div>
          )}
        </>
      )}

      {view === "overview" && (
        <div>
          <p className="step-description" style={{ marginBottom: 16 }}>
            Failed placements are grouped by day and time. Filter by constraint type, relaxability, or search the failed search space.
          </p>
          {props.searchSpaceLoading && <p className="diagnosis-status">Checking all candidate options…</p>}
          {props.searchSpaceError && <p className="diagnosis-error">{props.searchSpaceError}</p>}

          {!props.searchSpaceLoading && props.searchSpaceResults.length > 0 && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end", marginBottom: 18 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 240, fontSize: 12, fontWeight: 700, color: "#64748b" }}>
                  FILTER BY CONSTRAINT
                  <select value={overviewConstraint} onChange={(e) => setOverviewConstraint(e.target.value)}
                    style={{ height: 38, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff" }}>
                    <option value="all">All constraints</option>
                    {overviewConstraintTypes.map((type) => (
                      <option key={type} value={type}>{constraintLabel(type)}</option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 230, fontSize: 12, fontWeight: 700, color: "#64748b" }}>
                  FILTER BY RELAXABILITY
                  <select value={overviewRelaxability} onChange={(e) => setOverviewRelaxability(e.target.value as "all" | "relaxable-only" | "contains-non-relaxable")}
                    style={{ height: 38, padding: "0 10px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff" }}>
                    <option value="all">All failed placements</option>
                    <option value="relaxable-only">Relaxable constraints only</option>
                    <option value="contains-non-relaxable">Contains non-relaxable constraints</option>
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 280px", fontSize: 12, fontWeight: 700, color: "#64748b" }}>
                  SEARCH
                  <input type="search" value={overviewQuery} onChange={(e) => setOverviewQuery(e.target.value)}
                    placeholder="Room, stakeholder, time, constraint…"
                    style={{ height: 38, padding: "0 11px", border: "1px solid #cbd5e1", borderRadius: 8 }} />
                </label>

                <div style={{ paddingBottom: 9, fontSize: 12, color: "#64748b" }}>
                  {filteredCandidateCount} of {props.searchSpaceResults.length} candidates
                </div>
              </div>

              {overviewGroups.length === 0 ? (
                <div style={{ padding: 18, border: "1px solid #e2e8f0", borderRadius: 10, color: "#64748b" }}>No candidates match the current filters.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {overviewGroups.map((group) => {
                    const expanded = expandedGroups.has(group.key);
                    return (
                      <section key={group.key} style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
                        <button type="button" onClick={() => toggleOverviewGroup(group.key)} aria-expanded={expanded}
                          style={{ width: "100%", border: 0, background: "#f8fafc", padding: "14px 16px", cursor: "pointer", textAlign: "left", color: "#172033" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ color: "#64748b", transform: expanded ? "rotate(90deg)" : "none" }}>▶</span>
                              <strong>{group.day} {group.time}</strong>
                              <span style={{ fontSize: 12, color: "#64748b" }}>{group.results.length} candidate{group.results.length === 1 ? "" : "s"}</span>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 6 }}>
                              {group.constraints.slice(0,3).map((x) => (
                                <span key={x.type} style={{ padding: "4px 7px", borderRadius: 999, background: "#e2e8f0", color: "#475569", fontSize: 11, fontWeight: 600 }}>
                                  {constraintLabel(x.type)} {x.count}/{group.results.length}
                                </span>
                              ))}
                              {group.constraints.length > 3 && <span style={{ fontSize: 11, color: "#64748b" }}>+{group.constraints.length - 3} more</span>}
                            </div>
                          </div>
                        </button>

                        {expanded && (
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                              <thead><tr style={{ textAlign: "left", color: "#64748b", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
                                {props.originalModes.room === "find" && <th style={{ padding: "10px 16px" }}>Room</th>}
                                {props.originalModes.lecturer === "find" && <th style={{ padding: "10px 16px" }}>Lecturer</th>}
                                <th style={{ padding: "10px 16px" }}>Constraint violations</th>
                              </tr></thead>
                              <tbody>
                                {group.results.map((result) => (
                                  <tr key={result.key} style={{ borderBottom: "1px solid #edf0f4", verticalAlign: "top" }}>
                                    {props.originalModes.room === "find" && <td style={{ padding: "11px 16px", fontWeight: 600, whiteSpace: "nowrap" }}>{result.roomName}</td>}
                                    {props.originalModes.lecturer === "find" && <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}>{result.lecturerName}</td>}
                                    <td style={{ padding: "11px 16px" }}><CompactViolationLabels result={result} /></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}




