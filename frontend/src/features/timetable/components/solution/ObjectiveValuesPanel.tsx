import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type ObjectiveValue = {
  before: number;
  after: number;
};

export type ObjectiveValues = {
  room_waste: ObjectiveValue;
  cohort_gaps: ObjectiveValue;
  lecturer_idle: ObjectiveValue;
  cohort_room_changes: ObjectiveValue;
};

type Props = {
  objectives: ObjectiveValues;
  baselineScore: number;
  proposedScore: number;
  scoreDelta: number;
};

const OBJECTIVES: Array<{
  key: keyof ObjectiveValues;
  label: string;
}> = [
  { key: "room_waste", label: "Room capacity waste" },
  { key: "cohort_gaps", label: "Cohort timetable gaps" },
  { key: "lecturer_idle", label: "Lecturer idle time" },
  { key: "cohort_room_changes", label: "Cohort room changes" },
];

export function ObjectiveValuesPanel({
  objectives,
  baselineScore,
  proposedScore,
  scoreDelta,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section
      style={{
        marginTop: 28,
        borderTop: "1px solid #e2e8f0",
        paddingTop: 18,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        style={{
          width: "100%",
          border: 0,
          background: "transparent",
          padding: "4px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          cursor: "pointer",
          textAlign: "left",
          color: "#0f172a",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
            Objective values
          </div>
          <div
            style={{
              marginTop: 4,
              marginLeft: 24,
              fontSize: 12,
              color: "#64748b",
              fontWeight: 400,
            }}
          >
            View the numerical objective magnitudes behind this assessment.
          </div>
        </div>

        <span
          style={{
            fontSize: 12,
            color: "#64748b",
            whiteSpace: "nowrap",
          }}
        >
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div
          style={{
            marginTop: 14,
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
              Before and after
            </div>
            <div style={{ marginTop: 3, fontSize: 12, color: "#64748b" }}>
              Lower values indicate a lower cost for that objective.
            </div>
          </div>

          <div
            style={{
              padding: "14px",
              borderBottom: "1px solid #e2e8f0",
              background: "#ffffff",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
              Overall weighted objective
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginTop: 8,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <strong style={{ fontSize: 18, color: "#334155" }}>
                {baselineScore}
              </strong>
              <span style={{ color: "#64748b" }}>→</span>
              <strong style={{ fontSize: 18, color: "#0f172a" }}>
                {proposedScore}
              </strong>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
                ({scoreDelta > 0 ? "+" : ""}
                {scoreDelta})
              </span>
            </div>

            <div
              style={{
                marginTop: 5,
                fontSize: 11,
                lineHeight: 1.45,
                color: "#64748b",
              }}
            >
              This is the weighted combination of the objective values below.
              Lower values indicate a lower overall timetable cost.
            </div>
          </div>

          <div style={{ padding: "4px 14px" }}>
            {OBJECTIVES.map(({ key, label }) => (
              <ObjectiveValueRow
                key={key}
                label={label}
                before={objectives[key].before}
                after={objectives[key].after}
              />
            ))}
          </div>

          <div
            style={{
              padding: "10px 14px",
              borderTop: "1px solid #e2e8f0",
              background: "#f8fafc",
              fontSize: 11,
              lineHeight: 1.45,
              color: "#64748b",
            }}
          >
            Bars are scaled within each objective to compare its before and after values.
            Bar lengths should not be compared across different objectives.
          </div>
        </div>
      )}
    </section>
  );
}

function ObjectiveValueRow({
  label,
  before,
  after,
}: {
  label: string;
  before: number;
  after: number;
}) {
  const max = Math.max(before, after, 1);
  const beforeWidth = before === 0 ? 0 : Math.max((before / max) * 100, 4);
  const afterWidth = after === 0 ? 0 : Math.max((after / max) * 100, 4);

  return (
    <div
      style={{
        padding: "14px 0",
        borderBottom: "1px solid #eef2f7",
      }}
    >
      <div
        style={{
          marginBottom: 9,
          fontSize: 13,
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        {label}
      </div>

      <ValueBar label="Before" value={before} width={beforeWidth} />
      <ValueBar label="After" value={after} width={afterWidth} />
    </div>
  );
}

function ValueBar({
  label,
  value,
  width,
}: {
  label: string;
  value: number;
  width: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "52px 44px minmax(0, 1fr)",
        alignItems: "center",
        gap: 8,
        marginTop: 6,
      }}
    >
      <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>

      <strong
        style={{
          fontSize: 12,
          color: "#334155",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </strong>

      <div
        aria-hidden="true"
        style={{
          height: 9,
          borderRadius: 999,
          background: "#eef2f7",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${width}%`,
            height: "100%",
            borderRadius: 999,
            background: "#64748b",
            transition: "width 160ms ease",
          }}
        />
      </div>
    </div>
  );
}
