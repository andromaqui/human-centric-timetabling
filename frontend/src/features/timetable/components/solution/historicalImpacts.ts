export type HistoricalStakeholderType =
  | "lecturer"
  | "cohort";

export type HistoricalImpactType =
  | "lunch-break-reduced"
  | "consecutive-teaching";

export type HistoricalImpactDetails = {
  expected_minutes?: number;
  received_minutes?: number;
  limit_minutes?: number;
  actual_minutes?: number;
};

export type HistoricalImpact = {
  id: string;

  semester_id: string;
  semester_name: string;

  stakeholder_type: HistoricalStakeholderType;
  stakeholder_id: string;
  stakeholder_name: string;

  constraint_id: string;
  impact_type: HistoricalImpactType;

  occurred_on: string;
  day: string;

  magnitude_minutes: number;

  details: HistoricalImpactDetails;
};

export async function fetchHistoricalImpacts(
  stakeholderType: HistoricalStakeholderType,
  impactType: HistoricalImpactType,
): Promise<HistoricalImpact[]> {
  const params = new URLSearchParams({
    stakeholder_type: stakeholderType,
    impact_type: impactType,
  });

  const response = await fetch(
    `http://127.0.0.1:8000/historical-impacts/?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch historical impacts: ${response.status}`,
    );
  }

  return response.json();
}