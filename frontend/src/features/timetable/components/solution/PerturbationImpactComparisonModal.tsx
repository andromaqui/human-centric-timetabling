import { X } from "lucide-react";
import {
  PerturbationImpactContent,
  type PerturbationImpact,
} from "./PerturbationImpactModal";

type ComparisonSolution = {
  rank: number;
  objective_score: number | null;
  impact?: PerturbationImpact;
};

type Props = {
  solutions: ComparisonSolution[];
  sessions: {
    id: string;
    moduleId?: string;
    lecturerId: string;
    room?: string;
    roomId?: string | null;
    cohortIds: string[];
  }[];
  modules: {
    id: string;
    code?: string;
    name?: string;
    title?: string;
  }[];
  cohorts: {
    id: string;
    name: string;
    capacity?: number;
  }[];
  lecturers: {
    id: string;
    name: string;
    capacity?: number;
  }[];
  rooms: {
    id: string;
    name: string;
    capacity?: number;
  }[];
  onClose: () => void;
};

export function PerturbationImpactComparisonModal({
  solutions,
  sessions,
  modules,
  cohorts,
  lecturers,
  rooms,
  onClose,
}: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="perturbation-impact-comparison-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "98vw",
          height: "94vh",
          background: "#ffffff",
          borderRadius: 14,
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 20,
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "#64748b",
              }}
            >
              PERTURBATION RECOVERY
            </div>
            <h2
              id="perturbation-impact-comparison-title"
              style={{ margin: "4px 0 0", fontSize: 21 }}
            >
              Compare impacts
            </h2>
            <div style={{ marginTop: 5, fontSize: 12, lineHeight: 1.5, color: "#64748b" }}>
              Compare how each feasible rearrangement affects timetable stakeholders and objectives.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close comparison"
            style={{ border: 0, background: "transparent", cursor: "pointer", padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            padding: 18,
            background: "#f8fafc",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.max(solutions.length, 1)}, minmax(360px, 1fr))`,
              gap: 16,
              alignItems: "start",
              minWidth: solutions.length > 1 ? solutions.length * 380 : undefined,
            }}
          >
            {solutions.map((solution, index) => (
              <section
                key={`${solution.rank}-${index}`}
                style={{
                  minWidth: 0,
                  border: "1px solid #dbe3ee",
                  borderRadius: 12,
                  background: "#ffffff",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid #e2e8f0",
                    background: "#ffffff",
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                    Solution {index + 1}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
                    Score: {solution.objective_score ?? "—"}
                  </div>
                </div>

                <div style={{ padding: 16 }}>
                  {solution.impact ? (
                    <PerturbationImpactContent
                      impact={solution.impact}
                      sessions={sessions}
                      modules={modules}
                      cohorts={cohorts}
                      lecturers={lecturers}
                      rooms={rooms}
                    />
                  ) : (
                    <div
                      style={{
                        padding: 16,
                        border: "1px dashed #cbd5e1",
                        borderRadius: 8,
                        fontSize: 13,
                        color: "#64748b",
                      }}
                    >
                      Impact details are not available for this solution.
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
