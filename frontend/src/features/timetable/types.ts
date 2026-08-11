export interface Program {
  id: string;
  code: string;
  name: string;
}

export interface Lecturer {
  id: string;
  name: string;
}

export interface Cohort {
  id: string;
  name: string;
  programId: string;
}

export interface Module {
  id: string;
  code: string;
  title: string;
}

export interface Room {
  id: string;
  name: string;
  capacity?: number;
  equipment?: string;
}

export interface Session {
  id: string;
  moduleId: string;
  lecturerId: string;
  programIds: string[];
  cohortIds: string[];
  start: string;
  end: string;
  room?: string;
  type: "lecture" | "tutorial" | "lab" | "seminar";
}

export type Lecturer = {
  id: string;
  name: string;
  unavailable?: { day: string; hours: number[] }[];
};