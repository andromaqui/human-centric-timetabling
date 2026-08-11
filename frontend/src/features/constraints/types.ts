export type ConstraintStakeholder = "Lecturer" | "Cohort" | "Session" | "Room";

export type ConstraintType = "unrelaxable" | "relaxable";

export interface ConstraintDefinition {
  id: string;
  name: string;
  description: string;
  stakeholder: ConstraintStakeholder;
  type: ConstraintType;
}