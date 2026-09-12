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
  requiredCapacity?: number;
  requiredEquipment?: string[];
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

type ConflictViolation =
  | {
      type: "room_overlap";
      room_id: string;
      blocking_session_id: string;
    }
  | {
      type: "lecturer_overlap";
      lecturer_id: string;
      blocking_session_id: string;
    }
  | {
      type: "class_equipment";
      session_id: string;
      room_id: string;
      missing_equipment: string[];
    }
  | {
      type: "class_capacity";
      session_id: string;
      room_id: string;
      required_capacity: number;
      room_capacity: number;
    }
  | {
      type: string;
      [key: string]: unknown;
    };

type ConflictPreviewResponse = {
  status: "ok" | "not_concrete" | "invalid";
  reason: string | null;
  violations: ConflictViolation[];
  overlapping_sessions?: string[];
};

const [previewConflicts, setPreviewConflicts] = useState<
  ConflictViolation[]
>([]);

const [previewConflictsLoading, setPreviewConflictsLoading] =
  useState(false);

export type Lecturer = {
  id: string;
  name: string;
  unavailable?: { day: string; hours: number[] }[];
};