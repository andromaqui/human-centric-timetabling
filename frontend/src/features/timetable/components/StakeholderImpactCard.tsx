import {
  ArrowRight,
  CalendarDays,
  GraduationCap,
  UserRound,
} from "lucide-react";

import type {
  HistoricalStakeholderImpact,
  HistoricalStakeholderType,
} from "../data/historicalStakeholderImpact";

import "./StakeholderImpactCard.css";

type StakeholderImpactCardProps = {
  stakeholder: HistoricalStakeholderImpact;
  isSelected?: boolean;
  onSelect: (stakeholderId: string) => void;
};

function getStakeholderTypeLabel(
  stakeholderType: HistoricalStakeholderType,
) {
  return stakeholderType === "lecturer"
    ? "Lecturer"
    : "Cohort";
}

function formatDate(date?: string) {
  if (!date) {
    return "Never";
  }

  return new Date(`${date}T00:00:00`).toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );
}

function getImpactSummary(
  stakeholder: HistoricalStakeholderImpact,
) {
  const counts = new Map<string, number>();

  stakeholder.impacts.forEach((impact) => {
    counts.set(
      impact.title,
      (counts.get(impact.title) ?? 0) + 1,
    );
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);
}

export function StakeholderImpactCard({
  stakeholder,
  isSelected = false,
  onSelect,
}: StakeholderImpactCardProps) {
  const summaryItems = getImpactSummary(stakeholder);

  return (
    <button
      type="button"
      className={[
        "stakeholder-summary-card",
        isSelected ? "is-selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() =>
        onSelect(stakeholder.stakeholderId)
      }
      aria-pressed={isSelected}
    >
      <div className="stakeholder-summary-card-header">
        <div className="stakeholder-summary-identity">
          <span className="stakeholder-summary-icon">
            {stakeholder.stakeholderType === "lecturer" ? (
              <UserRound size={20} aria-hidden="true" />
            ) : (
              <GraduationCap
                size={20}
                aria-hidden="true"
              />
            )}
          </span>

          <div>
            <span className="stakeholder-summary-type">
              {getStakeholderTypeLabel(
                stakeholder.stakeholderType,
              )}
            </span>

            <h3>{stakeholder.stakeholderName}</h3>
          </div>
        </div>

        <span className="stakeholder-summary-total">
          {stakeholder.totalImpacts}{" "}
          {stakeholder.totalImpacts === 1
            ? "impact"
            : "impacts"}
        </span>
      </div>

      <div className="stakeholder-summary-metrics">
        {summaryItems.length > 0 ? (
          summaryItems.map(([label, count]) => (
            <div
              key={label}
              className="stakeholder-summary-metric"
            >
              <strong>{count}</strong>
              <span>{label}</span>
            </div>
          ))
        ) : (
          <div className="stakeholder-summary-no-impact">
            No historical impacts recorded
          </div>
        )}
      </div>

      <div className="stakeholder-summary-footer">
        <span>
          <CalendarDays size={15} aria-hidden="true" />
          Last affected{" "}
          {formatDate(stakeholder.lastAffectedAt)}
        </span>

        <span className="stakeholder-summary-view">
          View history
          <ArrowRight size={16} aria-hidden="true" />
        </span>
      </div>
    </button>
  );
}
