import type {
  HistoricalImpact,
  HistoricalImpactType,
  HistoricalStakeholderType,
} from "../../timetable/pages/historicalImpacts";

import { ImpactBarChart } from "../../timetable/components/ImpactBarChart";

import "./HistoricalImpactSummary.css";

type HistoricalImpactSummaryProps = {
  impactType: HistoricalImpactType;
  stakeholderType: HistoricalStakeholderType;
  impacts: HistoricalImpact[];
  highlightStakeholderId?: string;
};

export function HistoricalImpactSummary({
  impactType,
  stakeholderType,
  impacts,
  highlightStakeholderId,
}: HistoricalImpactSummaryProps) {
  return (
    <section className="historical-impact-summary">
      <div className="historical-impact-summary-header">
        <h3>Historical impact</h3>

        <p>
          Previous accepted timetable changes affecting this constraint.
        </p>
      </div>

      <ImpactBarChart
        impactType={impactType}
        stakeholderType={stakeholderType}
        impacts={impacts}
        highlightStakeholderId={highlightStakeholderId}
      />

      <a
        className="historical-impact-summary-link"
        href="/historical-impact"
      >
        View full historical impact →
      </a>
    </section>
  );
}