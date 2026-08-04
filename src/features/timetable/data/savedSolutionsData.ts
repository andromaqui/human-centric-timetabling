import type { Session } from "../types";

export type SavedObjective = {
  id: string;
  label: string;
  stakeholder: "Lecturer" | "Cohort" | "Room" | "General";
  weight: number;
  enabled: boolean;
};

export type SavedConstraint = {
  group: "Lecturer" | "Cohorts" | "Rooms / class";
  rule: string;
  state: string;
  relaxable: boolean;
};

export type SavedSessionChange = {
  moduleCode: string;
  before: {
    day: string;
    time: string;
    room: string;
  };
  after: {
    day: string;
    time: string;
    room: string;
  };
};

export type SavedStakeholder = {
  type: "lecturer" | "cohort" | "room";
  id: string;
  label: string;
};

export type SavedRequestType =
  | "reschedule-class"
  | "change-room"
  | "change-lecturer";

export type SavedSolution = {
  id: string;
  requestId: string;
  requestCreatedAt: string;
  savedAt: string;

  moduleCode: string;
  moduleTitle: string;

  requestType: SavedRequestType;

  requestSummary: string;

  original: {
    day: string;
    time: string;
    room: string;
    lecturer: string;
  };

  result: {
    day: string;
    time: string;
    room: string;
    lecturer: string;
  };

  additionalChanges: SavedSessionChange[];
  affectedStakeholders: SavedStakeholder[];

  constraints: SavedConstraint[];
  objectives: SavedObjective[];

  resultingSessions: Session[];
};


import { timetableData } from "./timetableData";

export const savedSolutions: SavedSolution[] = [
  {
    id: "solution-1",
    requestId: "reschedule-class-session-1-find-any-time",
    requestCreatedAt: "2026-07-17T10:00:00",
    savedAt: "2026-07-17T10:30:00",

    moduleCode: "CS101",
    moduleTitle: "Programming Fundamentals",

    requestType: "reschedule-class",

    requestSummary:
      "Move CS101 to a new time and room.",

    original: {
      day: "Monday 21 September",
      time: "09:00–11:00",
      room: "Room B204",
      lecturer: "Dr. Maria Chen",
    },

    result: {
      day: "Thursday 24 September",
      time: "10:00–12:00",
      room: "Room C105",
      lecturer: "Dr. Maria Chen",
    },

    additionalChanges: [
      {
        moduleCode: "CS204",
        before: {
          day: "Tuesday 22 September",
          time: "13:00–15:00",
          room: "Room 1004",
        },
        after: {
          day: "Thursday 24 September",
          time: "10:00–12:00",
          room: "Room 1004",
        },
      },
    ],

    affectedStakeholders: [
      {
        type: "lecturer",
        id: "lecturer-1",
        label: "Dr. Maria Chen",
      },
      {
        type: "cohort",
        id: "cs-y1",
        label: "CS Year 1",
      },
      {
        type: "cohort",
        id: "ds-y1",
        label: "DS Year 1",
      },
      {
        type: "room",
        id: "Room C105",
        label: "Room C105",
      },
    ],

    constraints: [
      {
        group: "Lecturer",
        rule: "Lecturers cannot teach more than one class at a time",
        state: "Active",
        relaxable: false,
      },
      {
        group: "Lecturer",
        rule: "Dr. Maria Chen must have a lunch break",
        state: "Relaxed for Thursday",
        relaxable: true,
      },
      {
        group: "Cohorts",
        rule: "CS Year 1 can have maximum 3 teaching hours per day",
        state: "Active",
        relaxable: true,
      },
      {
        group: "Rooms / class",
        rule: "A room can have maximum one booking at a time",
        state: "Active",
        relaxable: false,
      },
    ],

    objectives: [
      {
        id: "lecturer-pref",
        label: "Minimize lecturer preference violations",
        stakeholder: "Lecturer",
        weight: 80,
        enabled: true,
      },
      {
        id: "cohort-gaps",
        label: "Minimize cohort timetable gaps",
        stakeholder: "Cohort",
        weight: 70,
        enabled: true,
      },
      {
        id: "room-changes",
        label: "Minimize back-to-back room changes",
        stakeholder: "Room",
        weight: 40,
        enabled: true,
      },
      {
        id: "num-changes",
        label: "Minimize the number of timetable changes",
        stakeholder: "General",
        weight: 100,
        enabled: true,
      },
    ],

    // TODO: HARDCODED PROTOTYPE SNAPSHOT
    // Later this should be the actual timetable returned by the solver.
    resultingSessions: timetableData.sessions,
  },

  {
  id: "solution-cs204-reschedule-1",

  // Different requestId = separate request card
  requestId: "request-cs204-reschedule-1",

  requestType: "reschedule-class",
  requestCreatedAt: "2026-07-18T09:00:00.000Z",
  savedAt: "2026-07-18T09:15:00.000Z",

  moduleCode: "CS204",
  moduleTitle: "Algorithms and Data Structures",

  requestSummary:
    "Move CS204 to a new day and time.",

  original: {
    day: "Tuesday 22 September",
    time: "13:00–15:00",
    room: "Room B302",
    lecturer: "Prof. James O'Connor",
  },

  result: {
    day: "Friday 25 September",
    time: "11:00–13:00",
    room: "Room A210",
    lecturer: "Prof. James O'Connor",
  },

  additionalChanges: [],

  affectedStakeholders: [
    {
      type: "lecturer",
      id: "lecturer-2",
      label: "Prof. James O'Connor",
    },
    {
      type: "cohort",
      id: "cs-y2",
      label: "CS Year 2",
    },
    {
      type: "room",
      id: "Room A210",
      label: "Room A210",
    },
  ],

  constraints: [
    {
      group: "Lecturer",
      rule: "Lecturers cannot teach more than one class at a time",
      state: "Active",
      relaxable: false,
    },
    {
      group: "Cohorts",
      rule: "CS Year 2 cannot attend two classes at the same time",
      state: "Active",
      relaxable: false,
    },
    {
      group: "Rooms / class",
      rule: "A room can have maximum one booking at a time",
      state: "Active",
      relaxable: false,
    },
  ],

  objectives: [
    {
      id: "num-changes",
      label: "Minimize the number of timetable changes",
      stakeholder: "General",
      weight: 80,
      enabled: true,
    },
    {
      id: "cohort-gaps",
      label: "Minimize cohort timetable gaps",
      stakeholder: "Cohort",
      weight: 70,
      enabled: true,
    },
  ],

 resultingSessions: [
  {
    moduleCode: "CS101",
    moduleTitle: "Programming Fundamentals",
    day: "Monday",
    startTime: "09:00",
    endTime: "11:00",
    room: "Room B204",
    lecturer: "Prof. Sarah Murphy",
  },
  {
    moduleCode: "CS205",
    moduleTitle: "Computer Architecture",
    day: "Monday",
    startTime: "11:00",
    endTime: "13:00",
    room: "Room A110",
    lecturer: "Dr. Liam Byrne",
  },
  {
    moduleCode: "CS310",
    moduleTitle: "Operating Systems",
    day: "Monday",
    startTime: "14:00",
    endTime: "16:00",
    room: "Room C204",
    lecturer: "Prof. Michael Ryan",
  },
  {
    moduleCode: "CS150",
    moduleTitle: "Discrete Mathematics",
    day: "Monday",
    startTime: "16:00",
    endTime: "18:00",
    room: "Room B108",
    lecturer: "Dr. Aisling Murphy",
  },

  {
    moduleCode: "CS220",
    moduleTitle: "Database Systems",
    day: "Tuesday",
    startTime: "09:00",
    endTime: "11:00",
    room: "Room A204",
    lecturer: "Dr. Emma Walsh",
  },
  {
    moduleCode: "CS230",
    moduleTitle: "Web Development",
    day: "Tuesday",
    startTime: "11:00",
    endTime: "13:00",
    room: "Room C112",
    lecturer: "Dr. Kevin O'Shea",
  },
  {
    moduleCode: "CS240",
    moduleTitle: "Human-Computer Interaction",
    day: "Tuesday",
    startTime: "13:00",
    endTime: "15:00",
    room: "Room A203",
    lecturer: "Prof. Fiona Gallagher",
  },
  {
    moduleCode: "CS315",
    moduleTitle: "Machine Learning",
    day: "Tuesday",
    startTime: "15:00",
    endTime: "17:00",
    room: "Room C301",
    lecturer: "Prof. David Collins",
  },

  {
    moduleCode: "CS325",
    moduleTitle: "Compiler Construction",
    day: "Wednesday",
    startTime: "09:00",
    endTime: "11:00",
    room: "Room C208",
    lecturer: "Dr. Mark O'Brien",
  },
  {
    moduleCode: "DS110",
    moduleTitle: "Introduction to Data Science",
    day: "Wednesday",
    startTime: "10:00",
    endTime: "12:00",
    room: "Room A101",
    lecturer: "Dr. Emma Walsh",
  },
  {
    moduleCode: "CS330",
    moduleTitle: "Artificial Intelligence",
    day: "Wednesday",
    startTime: "13:00",
    endTime: "15:00",
    room: "Room C105",
    lecturer: "Prof. James O'Connor",
  },
  {
    moduleCode: "CS335",
    moduleTitle: "Cyber Security",
    day: "Wednesday",
    startTime: "15:00",
    endTime: "17:00",
    room: "Room B310",
    lecturer: "Prof. John Fitzgerald",
  },

  {
    moduleCode: "CS340",
    moduleTitle: "Computer Networks",
    day: "Thursday",
    startTime: "09:00",
    endTime: "11:00",
    room: "Room B110",
    lecturer: "Dr. Niamh O'Sullivan",
  },
  {
    moduleCode: "CS350",
    moduleTitle: "Cloud Computing",
    day: "Thursday",
    startTime: "11:00",
    endTime: "13:00",
    room: "Room C301",
    lecturer: "Dr. Michelle Hayes",
  },
  {
    moduleCode: "CS360",
    moduleTitle: "Mobile Application Development",
    day: "Thursday",
    startTime: "13:00",
    endTime: "15:00",
    room: "Room B206",
    lecturer: "Dr. Alan Murphy",
  },
  {
    moduleCode: "SE310",
    moduleTitle: "Software Engineering",
    day: "Thursday",
    startTime: "15:00",
    endTime: "17:00",
    room: "Room C105",
    lecturer: "Prof. Michael Ryan",
  },

  {
    moduleCode: "CS420",
    moduleTitle: "Advanced Artificial Intelligence",
    day: "Friday",
    startTime: "09:00",
    endTime: "11:00",
    room: "Room C302",
    lecturer: "Prof. Laura Brennan",
  },
  {
    moduleCode: "CS204",
    moduleTitle: "Algorithms and Data Structures",
    day: "Friday",
    startTime: "11:00",
    endTime: "13:00",
    room: "Room A210",
    lecturer: "Prof. James O'Connor",
  },
  {
    moduleCode: "CS430",
    moduleTitle: "Computer Vision",
    day: "Friday",
    startTime: "13:00",
    endTime: "15:00",
    room: "Room A305",
    lecturer: "Dr. Brian Kelly",
  },
  {
    moduleCode: "CS410",
    moduleTitle: "Distributed Systems",
    day: "Friday",
    startTime: "14:00",
    endTime: "16:00",
    room: "Room C210",
    lecturer: "Dr. Patrick Murphy",
  },
  {
    moduleCode: "CS440",
    moduleTitle: "Information Retrieval",
    day: "Friday",
    startTime: "16:00",
    endTime: "18:00",
    room: "Room C207",
    lecturer: "Prof. Rachel Doyle",
  },
  {
      moduleCode: "DS101",
      moduleTitle: "Foundations of Data Science",
      day: "Monday",
      startTime: "09:00",
      endTime: "11:00",
      room: "Room A101",
      lecturer: "Dr. Emma Walsh",
    },
    {
      moduleCode: "SE105",
      moduleTitle: "Introduction to Software Engineering",
      day: "Monday",
      startTime: "09:00",
      endTime: "11:00",
      room: "Room C112",
      lecturer: "Prof. Michael Ryan",
    },
    {
      moduleCode: "IS110",
      moduleTitle: "Information Systems Fundamentals",
      day: "Monday",
      startTime: "10:00",
      endTime: "12:00",
      room: "Room B110",
      lecturer: "Dr. Niamh O'Sullivan",
    },
    {
      moduleCode: "CS102",
      moduleTitle: "Computer Systems Fundamentals",
      day: "Monday",
      startTime: "09:30",
      endTime: "10:30",
      room: "Room C208",
      lecturer: "Dr. Liam Byrne",
    },
],
},

{
  id: "solution-cs204-reschedule-2",

  // Same requestId = another candidate for the same request
  requestId: "request-cs204-reschedule-1",

  requestType: "reschedule-class",
  requestCreatedAt: "2026-07-18T09:00:00.000Z",
  savedAt: "2026-07-18T09:25:00.000Z",

  moduleCode: "CS204",
  moduleTitle: "Algorithms and Data Structures",

  requestSummary:
    "Move CS204 to a new day and time.",

  original: {
    day: "Tuesday 22 September",
    time: "13:00–15:00",
    room: "Room B302",
    lecturer: "Prof. James O'Connor",
  },

  result: {
    day: "Thursday 24 September",
    time: "15:00–17:00",
    room: "Room C105",
    lecturer: "Prof. James O'Connor",
  },

  additionalChanges: [
    {
      moduleCode: "DS110",
      before: {
        day: "Thursday 24 September",
        time: "15:00–17:00",
        room: "Room C105",
      },
      after: {
        day: "Friday 25 September",
        time: "13:00–15:00",
        room: "Room C105",
      },
    },
  ],

  affectedStakeholders: [
    {
      type: "lecturer",
      id: "lecturer-2",
      label: "Prof. James O'Connor",
    },
    {
      type: "cohort",
      id: "cs-y2",
      label: "CS Year 2",
    },
    {
      type: "room",
      id: "Room C105",
      label: "Room C105",
    },
  ],

  constraints: [
    {
      group: "Lecturer",
      rule: "Lecturers cannot teach more than one class at a time",
      state: "Active",
      relaxable: false,
    },
    {
      group: "Cohorts",
      rule: "CS Year 2 cannot attend two classes at the same time",
      state: "Active",
      relaxable: false,
    },
    {
      group: "Rooms / class",
      rule: "A room can have maximum one booking at a time",
      state: "Active",
      relaxable: false,
    },
  ],

  objectives: [
    {
      id: "num-changes",
      label: "Minimize the number of timetable changes",
      stakeholder: "General",
      weight: 80,
      enabled: true,
    },
    {
      id: "cohort-gaps",
      label: "Minimize cohort timetable gaps",
      stakeholder: "Cohort",
      weight: 70,
      enabled: true,
    },
  ],

  resultingSessions: [],
},


  {
  id: "solution-2",
  requestId: "change-room-session-3-room-a210",
  requestCreatedAt: "2026-07-17T11:00:00",
  savedAt: "2026-07-17T11:15:00",

  moduleCode: "DS110",
  moduleTitle: "Introduction to Data Science",

  requestType: "change-room",

  requestSummary:
    "Change the room for DS110 while keeping the existing day and time.",

  original: {
    day: "Wednesday 23 September",
    time: "10:00–12:00",
    room: "Room A101",
    lecturer: "Dr. Aisha Khan",
  },

  result: {
    day: "Wednesday 23 September",
    time: "10:00–12:00",
    room: "Room A210",
    lecturer: "Dr. Aisha Khan",
  },

  additionalChanges: [],

  affectedStakeholders: [
    {
      type: "lecturer",
      id: "lecturer-3",
      label: "Dr. Aisha Khan",
    },
    {
      type: "cohort",
      id: "ds-y1",
      label: "DS Year 1",
    },
    {
      type: "room",
      id: "Room A101",
      label: "Room A101",
    },
    {
      type: "room",
      id: "Room A210",
      label: "Room A210",
    },
  ],

  constraints: [
    {
      group: "Lecturer",
      rule: "Lecturers cannot teach more than one class at a time",
      state: "Active",
      relaxable: false,
    },
    {
      group: "Cohorts",
      rule: "Cohorts cannot attend more than one class at a time",
      state: "Active",
      relaxable: false,
    },
    {
      group: "Rooms / class",
      rule: "A room can have maximum one booking at a time",
      state: "Active",
      relaxable: false,
    },
    {
      group: "Rooms / class",
      rule: "The room must have sufficient capacity",
      state: "Active",
      relaxable: false,
    },
    {
      group: "Rooms / class",
      rule: "Prefer rooms in the same building",
      state: "Active",
      relaxable: true,
    },
  ],

  objectives: [
    {
      id: "lecturer-room-distance",
      label: "Minimize lecturer travel between rooms",
      stakeholder: "Lecturer",
      weight: 60,
      enabled: true,
    },
    {
      id: "cohort-room-distance",
      label: "Minimize cohort travel between rooms",
      stakeholder: "Cohort",
      weight: 75,
      enabled: true,
    },
    {
      id: "room-utilization",
      label: "Improve room capacity utilization",
      stakeholder: "Room",
      weight: 85,
      enabled: true,
    },
    {
      id: "room-stability",
      label: "Prefer keeping sessions in the same building",
      stakeholder: "Room",
      weight: 55,
      enabled: true,
    },
    {
      id: "num-changes",
      label: "Minimize the number of timetable changes",
      stakeholder: "General",
      weight: 100,
      enabled: true,
    },
  ],

  resultingSessions: timetableData.sessions.map((session) =>
    session.id === "session-3"
      ? {
          ...session,
          room: "Room A210",
        }
      : session,
  ),
},
];