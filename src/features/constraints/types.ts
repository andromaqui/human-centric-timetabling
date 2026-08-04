export type ConstraintStakeholder = "Lecturer" | "Cohort" | "Class";

export type ConstraintType = "unrelaxable" | "relaxable";

export interface ConstraintDefinition {
  id: string;
  name: string;
  stakeholder: ConstraintStakeholder;
  type: ConstraintType;
}