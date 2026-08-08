import type { Cohort, Lecturer, Module, Program, Session } from "../types"
const dayAbbrev = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function sessionToSlotIds(session: Session): string[] {
  const start = new Date(session.start);
  const end = new Date(session.end);
  const day = dayAbbrev[start.getDay()];

  const slots: string[] = [];
  for (let hour = start.getHours(); hour < end.getHours(); hour++) {
    slots.push(`${day}-${String(hour).padStart(2, "0")}`);
  }
  return slots;
}

// TODO:: export cohort, lecturer slots
export function lecturerUnavailableSlots(lecturer?: Lecturer): string[] {
  if (!lecturer?.unavailable) return [];
  return lecturer.unavailable.flatMap(({ day, hours }) =>
    hours.map((hour) => `${day}-${String(hour).padStart(2, "0")}`)
  );
}

export function getBusySlots(
  sessions: Session[],
  filter: (session: Session) => boolean,
  excludeSessionId?: string
): string[] {
  return sessions
    .filter((s) => filter(s) && s.id !== excludeSessionId)
    .flatMap(sessionToSlotIds);
}

export type TimetableData = {
  programs: Program[];
  lecturers: Lecturer[];
  cohorts: Cohort[];
  modules: Module[];
  sessions: Session[];
  requiredEquipment?: string[];
  requiredCapacity?: number;
};

export const timetableData: TimetableData = {
  programs: [
    { id: "cs", code: "CS", name: "Computer Science" },
    { id: "ds", code: "DS", name: "Data Science" },
    { id: "se", code: "SE", name: "Software Engineering" },
  ],

  cohorts: [
    { id: "cs-y1", name: "CS Year 1", programId: "cs" },
    { id: "cs-y2", name: "CS Year 2", programId: "cs" },
    { id: "ds-y1", name: "DS Year 1", programId: "ds" },
    { id: "se-y1", name: "SE Year 1", programId: "se" },
  ],


 lecturers: [
      {
        id: "lecturer-1",
        name: "Dr. Maria Chen",
        unavailable: [
          { day: "fri", hours: [9, 10, 11, 12, 13] },
          { day: "tue", hours: [9, 10, 11, 12, 13, 14, 15, 16, 17] },
        ],
      },
      { id: "lecturer-2", name: "Prof. James O'Connor" },
      { id: "lecturer-3", name: "Dr. Aisha Khan" },
    ],

  modules: [
  {
    id: "module-1",
    code: "CS101",
    title: "Programming Fundamentals",
    requiredEquipment: ["Projector", "Linux lab"],
    requiredCapacity: 50,
  },
  {
    id: "module-2",
    code: "CS204",
    title: "Data Structures",
    requiredEquipment: ["Whiteboard"],
    requiredCapacity: 40,
  },
  {
    id: "module-3",
    code: "DS110",
    title: "Intro to Data Science",
    requiredEquipment: ["Projector"],
    requiredCapacity: 60,
  },
  {
    id: "module-4",
    code: "SE120",
    title: "Software Design",
    requiredEquipment: ["Whiteboard", "Projector"],
    requiredCapacity: 35,
  },
],

  sessions: [
  {
    id: "session-1",
    moduleId: "module-1",
    lecturerId: "lecturer-1",
    programIds: ["cs", "ds"],
    cohortIds: ["cs-y1", "ds-y1"],
    start: "2026-09-21T09:00:00",
    end: "2026-09-21T11:00:00",
    room: "Room B204",
    type: "lecture",
  },
  {
    id: "session-2",
    moduleId: "module-2",
    lecturerId: "lecturer-2",
    programIds: ["cs"],
    cohortIds: ["cs-y2"],
    start: "2026-09-22T13:00:00",
    end: "2026-09-22T15:00:00",
    room: "Lab 3",
    type: "lab",
  },
  {
    id: "session-3",
    moduleId: "module-3",
    lecturerId: "lecturer-3",
    programIds: ["ds"],
    cohortIds: ["ds-y1"],
    start: "2026-09-23T10:00:00",
    end: "2026-09-23T12:00:00",
    room: "Room A101",
    type: "seminar",
  },
  {
    id: "session-4",
    moduleId: "module-4",
    lecturerId: "lecturer-1",
    programIds: ["se"],
    cohortIds: ["se-y1"],
    start: "2026-09-24T14:00:00",
    end: "2026-09-24T16:00:00",
    room: "Room C302",
    type: "tutorial",
  },
],
};
