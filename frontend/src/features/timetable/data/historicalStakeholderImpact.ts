export type HistoricalStakeholderType =
  | "lecturer"
  | "cohort";

export type HistoricalImpactType =
  | "lunch-break-reduced"
  | "consecutive-teaching"
  | "daily-teaching-hours-exceeded"
  | "large-timetable-gap"
  | "late-teaching";


export type LunchBreakChange = {
  day: string;
  before: string;
  after: string;
  lostMinutes: number;
};


export type LunchBreakImpactDetails = {
  kind: "lunch-break";
  semester: string;
  changes: LunchBreakChange[];
};


export type ConsecutiveTeachingImpactDetails = {
  kind: "consecutive-teaching";
  semester: string;
  day: string;
  allowedHours: number;
  beforeHours: number;
  afterHours: number;
  beforeWindow: string;
  afterWindow: string;
};


export type DailyTeachingHoursImpactDetails = {
  kind: "daily-teaching-hours";
  semester: string;
  day: string;
  allowedHours: number;
  beforeHours: number;
  afterHours: number;
};


export type LargeTimetableGapImpactDetails = {
  kind: "large-timetable-gap";
  semester: string;
  day: string;
  beforeGapMinutes: number;
  afterGapMinutes: number;
  beforeWindow: string;
  afterWindow: string;
};


export type LateTeachingImpactDetails = {
  kind: "late-teaching";
  semester: string;
  day: string;
  preferredFinish: string;
  actualFinish: string;
  additionalMinutes: number;
};


export type HistoricalImpactDetails =
  | LunchBreakImpactDetails
  | ConsecutiveTeachingImpactDetails
  | DailyTeachingHoursImpactDetails
  | LargeTimetableGapImpactDetails
  | LateTeachingImpactDetails;


export type HistoricalImpactRecord = {
  id: string;
  date: string;
  impactType: HistoricalImpactType;
  title: string;
  requestLabel: string;
  moduleCode?: string;
  solutionId?: string;
  details: HistoricalImpactDetails;
};


export type HistoricalStakeholderImpact = {
  stakeholderType: HistoricalStakeholderType;
  stakeholderId: string;
  stakeholderName: string;
  lastAffectedAt?: string;
  impacts: HistoricalImpactRecord[];
};


/* =========================================================
   Semesters
   ========================================================= */

export const SEMESTERS = {
  WS21: "Winter Semester 2021/22",
  SS22: "Summer Semester 2022",
  WS22: "Winter Semester 2022/23",
  SS23: "Summer Semester 2023",
  WS23: "Winter Semester 2023/24",
  SS24: "Summer Semester 2024",
  WS24: "Winter Semester 2024/25",
  SS25: "Summer Semester 2025",
  WS25: "Winter Semester 2025/26",
} as const;


/* =========================================================
   Helpers
   ========================================================= */

function lunchBreakImpact(
  id: string,
  date: string,
  semester: string,
  requestLabel: string,
  moduleCode: string,
  changes: LunchBreakChange[],
  solutionId?: string,
): HistoricalImpactRecord {
  return {
    id,
    date,
    impactType: "lunch-break-reduced",
    title: "Lunch break reduced",
    requestLabel,
    moduleCode,
    solutionId,
    details: {
      kind: "lunch-break",
      semester,
      changes,
    },
  };
}


function consecutiveTeachingImpact(
  id: string,
  date: string,
  semester: string,
  requestLabel: string,
  moduleCode: string,
  day: string,
  beforeHours: number,
  afterHours: number,
  beforeWindow: string,
  afterWindow: string,
  solutionId?: string,
): HistoricalImpactRecord {
  return {
    id,
    date,
    impactType: "consecutive-teaching",
    title: "Consecutive teaching limit exceeded",
    requestLabel,
    moduleCode,
    solutionId,
    details: {
      kind: "consecutive-teaching",
      semester,
      day,
      allowedHours: 4,
      beforeHours,
      afterHours,
      beforeWindow,
      afterWindow,
    },
  };
}


function dailyTeachingHoursImpact(
  id: string,
  date: string,
  semester: string,
  requestLabel: string,
  moduleCode: string,
  day: string,
  beforeHours: number,
  afterHours: number,
  solutionId?: string,
): HistoricalImpactRecord {
  return {
    id,
    date,
    impactType: "daily-teaching-hours-exceeded",
    title: "Daily teaching-hours limit exceeded",
    requestLabel,
    moduleCode,
    solutionId,
    details: {
      kind: "daily-teaching-hours",
      semester,
      day,
      allowedHours: 4,
      beforeHours,
      afterHours,
    },
  };
}


function largeGapImpact(
  id: string,
  date: string,
  semester: string,
  requestLabel: string,
  moduleCode: string,
  day: string,
  beforeGapMinutes: number,
  afterGapMinutes: number,
  beforeWindow: string,
  afterWindow: string,
): HistoricalImpactRecord {
  return {
    id,
    date,
    impactType: "large-timetable-gap",
    title: "Large timetable gap introduced",
    requestLabel,
    moduleCode,
    details: {
      kind: "large-timetable-gap",
      semester,
      day,
      beforeGapMinutes,
      afterGapMinutes,
      beforeWindow,
      afterWindow,
    },
  };
}


function lateTeachingImpact(
  id: string,
  date: string,
  semester: string,
  requestLabel: string,
  moduleCode: string,
  day: string,
  preferredFinish: string,
  actualFinish: string,
  additionalMinutes: number,
): HistoricalImpactRecord {
  return {
    id,
    date,
    impactType: "late-teaching",
    title: "Late teaching introduced",
    requestLabel,
    moduleCode,
    details: {
      kind: "late-teaching",
      semester,
      day,
      preferredFinish,
      actualFinish,
      additionalMinutes,
    },
  };
}


/* =========================================================
   Dummy historical data
   ========================================================= */

export const historicalStakeholderImpacts: HistoricalStakeholderImpact[] = [

  /* =======================================================
     Lecturer — Maria Chen
     ======================================================= */

  {
    stakeholderType: "lecturer",
    stakeholderId: "lecturer-1",
    stakeholderName: "Dr. Maria Chen",
    lastAffectedAt: "2025-12-02",

    impacts: [
      lunchBreakImpact(
        "mc-lunch-1",
        "2022-01-18",
        SEMESTERS.WS21,
        "Move CS101",
        "CS101",
        [
          {
            day: "Monday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
        ],
      ),

      lunchBreakImpact(
        "mc-lunch-2",
        "2023-04-17",
        SEMESTERS.SS23,
        "Move CS204",
        "CS204",
        [
          {
            day: "Tuesday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
          {
            day: "Thursday",
            before: "12:00–13:00",
            after: "12:20–13:00",
            lostMinutes: 40,
          },
        ],
      ),

      lunchBreakImpact(
        "mc-lunch-3",
        "2023-11-20",
        SEMESTERS.WS23,
        "Move CS220",
        "CS220",
        [
          {
            day: "Wednesday",
            before: "12:00–13:00",
            after: "No uninterrupted break",
            lostMinutes: 60,
          },
        ],
      ),

      lunchBreakImpact(
        "mc-lunch-4",
        "2025-01-13",
        SEMESTERS.WS24,
        "Move CS310",
        "CS310",
        [
          {
            day: "Monday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
          {
            day: "Tuesday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
        ],
      ),

      lunchBreakImpact(
        "mc-lunch-5",
        "2025-05-12",
        SEMESTERS.SS25,
        "Move CS330",
        "CS330",
        [
          {
            day: "Friday",
            before: "12:00–13:00",
            after: "12:40–13:00",
            lostMinutes: 40,
          },
        ],
      ),

      lunchBreakImpact(
        "mc-lunch-6",
        "2025-12-02",
        SEMESTERS.WS25,
        "Move CS315",
        "CS315",
        [
          {
            day: "Monday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
          {
            day: "Tuesday",
            before: "12:00–13:00",
            after: "12:20–13:00",
            lostMinutes: 40,
          },
          {
            day: "Thursday",
            before: "12:00–13:00",
            after: "No uninterrupted break",
            lostMinutes: 60,
          },
        ],
      ),

      consecutiveTeachingImpact(
        "mc-consecutive-1",
        "2022-11-14",
        SEMESTERS.WS22,
        "Move CS150",
        "CS150",
        "Monday",
        4,
        5,
        "09:00–13:00",
        "09:00–14:00",
      ),

      consecutiveTeachingImpact(
        "mc-consecutive-2",
        "2024-04-18",
        SEMESTERS.SS24,
        "Move CS310",
        "CS310",
        "Wednesday",
        4,
        6,
        "10:00–14:00",
        "10:00–16:00",
      ),

      consecutiveTeachingImpact(
        "mc-consecutive-3",
        "2024-05-02",
        SEMESTERS.SS24,
        "Move CS315",
        "CS315",
        "Friday",
        4,
        5,
        "09:00–13:00",
        "09:00–14:00",
      ),
    ],
  },


  /* =======================================================
     Lecturer — James O'Connor
     ======================================================= */

  {
    stakeholderType: "lecturer",
    stakeholderId: "lecturer-2",
    stakeholderName: "Prof. James O'Connor",
    lastAffectedAt: "2025-11-18",

    impacts: [
      lunchBreakImpact(
        "joc-lunch-1",
        "2022-01-18",
        SEMESTERS.WS21,
        "Move CS204",
        "CS204",
        [
          {
            day: "Monday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
          {
            day: "Thursday",
            before: "12:00–13:00",
            after: "12:45–13:00",
            lostMinutes: 45,
          },
        ],
      ),

      lunchBreakImpact(
        "joc-lunch-2",
        "2022-05-10",
        SEMESTERS.SS22,
        "Move CS315",
        "CS315",
        [
          {
            day: "Wednesday",
            before: "12:00–13:00",
            after: "12:45–13:00",
            lostMinutes: 45,
          },
        ],
      ),

      lunchBreakImpact(
        "joc-lunch-3",
        "2023-11-15",
        SEMESTERS.WS23,
        "Move CS220",
        "CS220",
        [
          {
            day: "Tuesday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
        ],
      ),

      lunchBreakImpact(
        "joc-lunch-4",
        "2024-04-22",
        SEMESTERS.SS24,
        "Move CS101",
        "CS101",
        [
          {
            day: "Friday",
            before: "12:00–13:00",
            after: "No uninterrupted break",
            lostMinutes: 60,
          },
        ],
      ),

      lunchBreakImpact(
        "joc-lunch-5",
        "2025-01-20",
        SEMESTERS.WS24,
        "Move CS330",
        "CS330",
        [
          {
            day: "Monday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
          {
            day: "Tuesday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
          {
            day: "Thursday",
            before: "12:00–13:00",
            after: "12:45–13:00",
            lostMinutes: 45,
          },
        ],
      ),

      lunchBreakImpact(
        "joc-lunch-6",
        "2025-05-29",
        SEMESTERS.SS25,
        "Move CS204",
        "CS204",
        [
          {
            day: "Thursday",
            before: "12:00–13:00",
            after: "12:40–13:00",
            lostMinutes: 40,
          },
        ],
      ),

      lunchBreakImpact(
        "joc-lunch-7",
        "2025-11-18",
        SEMESTERS.WS25,
        "Move CS315",
        "CS315",
        [
          {
            day: "Monday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
          {
            day: "Wednesday",
            before: "12:00–13:00",
            after: "No uninterrupted break",
            lostMinutes: 60,
          },
        ],
      ),

      consecutiveTeachingImpact(
        "joc-consecutive-1",
        "2023-04-12",
        SEMESTERS.SS23,
        "Move CS220",
        "CS220",
        "Thursday",
        4,
        6,
        "09:00–13:00",
        "09:00–15:00",
      ),

      consecutiveTeachingImpact(
        "joc-consecutive-2",
        "2024-11-20",
        SEMESTERS.WS24,
        "Move CS315",
        "CS315",
        "Tuesday",
        4,
        5,
        "10:00–14:00",
        "10:00–15:00",
      ),

      consecutiveTeachingImpact(
        "joc-consecutive-3",
        "2024-12-03",
        SEMESTERS.WS24,
        "Move CS330",
        "CS330",
        "Thursday",
        4,
        6,
        "09:00–13:00",
        "09:00–15:00",
      ),
    ],
  },


  /* =======================================================
     Lecturer — Emma Walsh
     ======================================================= */

  {
    stakeholderType: "lecturer",
    stakeholderId: "lecturer-3",
    stakeholderName: "Dr. Emma Walsh",
    lastAffectedAt: "2025-10-14",

    impacts: [
      lunchBreakImpact(
        "ew-lunch-1",
        "2022-11-08",
        SEMESTERS.WS22,
        "Move DS110",
        "DS110",
        [
          {
            day: "Monday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
        ],
      ),

      lunchBreakImpact(
        "ew-lunch-2",
        "2024-05-07",
        SEMESTERS.SS24,
        "Move CS220",
        "CS220",
        [
          {
            day: "Wednesday",
            before: "12:00–13:00",
            after: "12:40–13:00",
            lostMinutes: 40,
          },
          {
            day: "Thursday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
        ],
      ),

      lunchBreakImpact(
        "ew-lunch-3",
        "2025-06-30",
        SEMESTERS.SS25,
        "Move DS210",
        "DS210",
        [
          {
            day: "Monday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
        ],
      ),

      consecutiveTeachingImpact(
        "ew-consecutive-1",
        "2022-05-17",
        SEMESTERS.SS22,
        "Move DS101",
        "DS101",
        "Tuesday",
        4,
        5,
        "09:00–13:00",
        "09:00–14:00",
      ),

      consecutiveTeachingImpact(
        "ew-consecutive-2",
        "2023-11-21",
        SEMESTERS.WS23,
        "Move DS210",
        "DS210",
        "Thursday",
        4,
        6,
        "09:00–13:00",
        "09:00–15:00",
      ),

      consecutiveTeachingImpact(
        "ew-consecutive-3",
        "2023-12-05",
        SEMESTERS.WS23,
        "Move DS220",
        "DS220",
        "Friday",
        4,
        5,
        "10:00–14:00",
        "10:00–15:00",
      ),

      consecutiveTeachingImpact(
        "ew-consecutive-4",
        "2025-10-14",
        SEMESTERS.WS25,
        "Move DS310",
        "DS310",
        "Wednesday",
        4,
        5,
        "10:00–14:00",
        "10:00–15:00",
      ),
    ],
  },


  /* =======================================================
     Lecturer — Michael Ryan
     ======================================================= */

  {
    stakeholderType: "lecturer",
    stakeholderId: "lecturer-4",
    stakeholderName: "Prof. Michael Ryan",
    lastAffectedAt: "2025-11-03",

    impacts: [
      lunchBreakImpact(
        "mr-lunch-1",
        "2022-06-03",
        SEMESTERS.SS22,
        "Move CS120",
        "CS120",
        [
          {
            day: "Thursday",
            before: "12:00–13:00",
            after: "12:40–13:00",
            lostMinutes: 40,
          },
        ],
      ),

      lunchBreakImpact(
        "mr-lunch-2",
        "2023-04-25",
        SEMESTERS.SS23,
        "Move CS230",
        "CS230",
        [
          {
            day: "Tuesday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
          {
            day: "Friday",
            before: "12:00–13:00",
            after: "12:40–13:00",
            lostMinutes: 40,
          },
        ],
      ),

      lunchBreakImpact(
        "mr-lunch-3",
        "2025-01-29",
        SEMESTERS.WS24,
        "Move CS310",
        "CS310",
        [
          {
            day: "Monday",
            before: "12:00–13:00",
            after: "12:45–13:00",
            lostMinutes: 45,
          },
        ],
      ),

      lunchBreakImpact(
        "mr-lunch-4",
        "2025-11-03",
        SEMESTERS.WS25,
        "Move SE310",
        "SE310",
        [
          {
            day: "Friday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
        ],
      ),

      consecutiveTeachingImpact(
        "mr-consecutive-1",
        "2022-12-05",
        SEMESTERS.WS22,
        "Move SE210",
        "SE210",
        "Monday",
        3,
        5,
        "10:00–13:00",
        "10:00–15:00",
      ),

      consecutiveTeachingImpact(
        "mr-consecutive-2",
        "2024-11-11",
        SEMESTERS.WS24,
        "Move SE310",
        "SE310",
        "Tuesday",
        4,
        6,
        "09:00–13:00",
        "09:00–15:00",
      ),
    ],
  },


  /* =======================================================
     Cohort — CS Year 2
     ======================================================= */

  {
    stakeholderType: "cohort",
    stakeholderId: "cs-y2",
    stakeholderName: "CS Year 2",
    lastAffectedAt: "2025-11-20",

    impacts: [
      lunchBreakImpact(
        "csy2-lunch-1",
        "2023-04-11",
        SEMESTERS.SS23,
        "Move CS230",
        "CS230",
        [
          {
            day: "Tuesday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
          {
            day: "Thursday",
            before: "12:00–13:00",
            after: "12:20–13:00",
            lostMinutes: 40,
          },
        ],
      ),

      lunchBreakImpact(
        "csy2-lunch-2",
        "2024-11-19",
        SEMESTERS.WS24,
        "Move CS220",
        "CS220",
        [
          {
            day: "Monday",
            before: "12:00–13:00",
            after: "No uninterrupted break",
            lostMinutes: 60,
          },
          {
            day: "Wednesday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
          {
            day: "Friday",
            before: "12:00–13:00",
            after: "12:40–13:00",
            lostMinutes: 40,
          },
        ],
      ),

      lunchBreakImpact(
        "csy2-lunch-3",
        "2025-11-20",
        SEMESTERS.WS25,
        "Move CS240",
        "CS240",
        [
          {
            day: "Monday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
        ],
      ),

      consecutiveTeachingImpact(
        "csy2-consecutive-1",
        "2022-05-18",
        SEMESTERS.SS22,
        "Move CS201",
        "CS201",
        "Monday",
        4,
        5,
        "09:00–13:00",
        "09:00–14:00",
      ),

      consecutiveTeachingImpact(
        "csy2-consecutive-2",
        "2024-11-12",
        SEMESTERS.WS24,
        "Move CS220",
        "CS220",
        "Tuesday",
        4,
        6,
        "09:00–13:00",
        "09:00–15:00",
      ),

      consecutiveTeachingImpact(
        "csy2-consecutive-3",
        "2024-12-03",
        SEMESTERS.WS24,
        "Move CS230",
        "CS230",
        "Thursday",
        4,
        5,
        "10:00–14:00",
        "10:00–15:00",
      ),

      consecutiveTeachingImpact(
        "csy2-consecutive-4",
        "2025-05-21",
        SEMESTERS.SS25,
        "Move CS240",
        "CS240",
        "Wednesday",
        4,
        6,
        "09:00–13:00",
        "09:00–15:00",
      ),

      consecutiveTeachingImpact(
        "csy2-consecutive-5",
        "2025-06-02",
        SEMESTERS.SS25,
        "Move CS250",
        "CS250",
        "Friday",
        4,
        5,
        "10:00–14:00",
        "10:00–15:00",
      ),
    ],
  },


  /* =======================================================
     Cohort — CS Year 1
     ======================================================= */

  {
    stakeholderType: "cohort",
    stakeholderId: "cs-y1",
    stakeholderName: "CS Year 1",
    lastAffectedAt: "2025-10-28",

    impacts: [
      lunchBreakImpact(
        "csy1-lunch-1",
        "2022-05-13",
        SEMESTERS.SS22,
        "Move CS101",
        "CS101",
        [
          {
            day: "Monday",
            before: "12:00–13:00",
            after: "12:20–13:00",
            lostMinutes: 20,
          },
        ],
      ),

      lunchBreakImpact(
        "csy1-lunch-2",
        "2023-11-15",
        SEMESTERS.WS23,
        "Move CS110",
        "CS110",
        [
          {
            day: "Tuesday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
          {
            day: "Thursday",
            before: "12:00–13:00",
            after: "12:40–13:00",
            lostMinutes: 40,
          },
        ],
      ),

      lunchBreakImpact(
        "csy1-lunch-3",
        "2025-06-24",
        SEMESTERS.SS25,
        "Move CS150",
        "CS150",
        [
          {
            day: "Monday",
            before: "12:00–13:00",
            after: "12:20–13:00",
            lostMinutes: 20,
          },
          {
            day: "Wednesday",
            before: "12:00–13:00",
            after: "No uninterrupted break",
            lostMinutes: 60,
          },
        ],
      ),

      consecutiveTeachingImpact(
        "csy1-consecutive-1",
        "2022-11-09",
        SEMESTERS.WS22,
        "Move CS102",
        "CS102",
        "Tuesday",
        4,
        5,
        "09:00–13:00",
        "09:00–14:00",
      ),

      consecutiveTeachingImpact(
        "csy1-consecutive-2",
        "2023-11-17",
        SEMESTERS.WS23,
        "Move CS110",
        "CS110",
        "Monday",
        4,
        6,
        "10:00–14:00",
        "10:00–16:00",
      ),

      consecutiveTeachingImpact(
        "csy1-consecutive-3",
        "2023-12-01",
        SEMESTERS.WS23,
        "Move CS120",
        "CS120",
        "Friday",
        4,
        5,
        "09:00–13:00",
        "09:00–14:00",
      ),

      consecutiveTeachingImpact(
        "csy1-consecutive-4",
        "2025-10-28",
        SEMESTERS.WS25,
        "Move CS150",
        "CS150",
        "Wednesday",
        4,
        6,
        "09:00–13:00",
        "09:00–15:00",
      ),

      consecutiveTeachingImpact(
        "csy1-consecutive-5",
        "2025-11-07",
        SEMESTERS.WS25,
        "Move CS160",
        "CS160",
        "Thursday",
        4,
        5,
        "10:00–14:00",
        "10:00–15:00",
      ),
    ],
  },


  /* =======================================================
     Cohort — Data Science Year 1
     ======================================================= */

  {
    stakeholderType: "cohort",
    stakeholderId: "ds-y1",
    stakeholderName: "Data Science Year 1",
    lastAffectedAt: "2025-05-31",

    impacts: [
      lunchBreakImpact(
        "dsy1-lunch-1",
        "2023-05-09",
        SEMESTERS.SS23,
        "Move DS101",
        "DS101",
        [
          {
            day: "Friday",
            before: "12:00–13:00",
            after: "12:40–13:00",
            lostMinutes: 40,
          },
        ],
      ),

      lunchBreakImpact(
        "dsy1-lunch-2",
        "2024-05-14",
        SEMESTERS.SS24,
        "Move DS110",
        "DS110",
        [
          {
            day: "Wednesday",
            before: "12:00–13:00",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
          {
            day: "Thursday",
            before: "12:00–13:00",
            after: "12:45–13:00",
            lostMinutes: 45,
          },
        ],
      ),

      consecutiveTeachingImpact(
        "dsy1-consecutive-1",
        "2024-05-22",
        SEMESTERS.SS24,
        "Move DS110",
        "DS110",
        "Tuesday",
        4,
        5,
        "09:00–13:00",
        "09:00–14:00",
      ),

      consecutiveTeachingImpact(
        "dsy1-consecutive-2",
        "2025-05-31",
        SEMESTERS.SS25,
        "Move DS210",
        "DS210",
        "Thursday",
        4,
        6,
        "10:00–14:00",
        "10:00–16:00",
      ),

      consecutiveTeachingImpact(
        "dsy1-consecutive-3",
        "2025-06-12",
        SEMESTERS.SS25,
        "Move DS220",
        "DS220",
        "Friday",
        4,
        5,
        "09:00–13:00",
        "09:00–14:00",
      ),
    ],
  },
];


/* =========================================================
   Query helpers
   ========================================================= */

export function getHistoricalImpactsByType(
  stakeholderType: HistoricalStakeholderType,
) {
  return historicalStakeholderImpacts.filter(
    (stakeholder) =>
      stakeholder.stakeholderType === stakeholderType,
  );
}


export function getHistoricalStakeholderImpact(
  stakeholderId: string,
) {
  return historicalStakeholderImpacts.find(
    (stakeholder) =>
      stakeholder.stakeholderId === stakeholderId,
  );
}