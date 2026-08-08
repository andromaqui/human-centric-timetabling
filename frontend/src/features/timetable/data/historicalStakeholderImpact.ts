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

const SEMESTER = "Summer Semester 2025";

function lunchBreakImpact(
  id: string,
  date: string,
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
      semester: SEMESTER,
      changes,
    },
  };
}

function consecutiveTeachingImpact(
  id: string,
  date: string,
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
      semester: SEMESTER,
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
      semester: SEMESTER,
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
      semester: SEMESTER,
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
      semester: SEMESTER,
      day,
      preferredFinish,
      actualFinish,
      additionalMinutes,
    },
  };
}

export const historicalStakeholderImpacts: HistoricalStakeholderImpact[] = [
  {
    stakeholderType: "lecturer",
    stakeholderId: "lecturer-2",
    stakeholderName: "Prof. James O'Connor",
    lastAffectedAt: "2026-07-18",
    impacts: [
      lunchBreakImpact(
        "impact-joc-1",
        "2026-07-18",
        "Move CS204",
        "CS204",
        [
          {
            day: "Monday",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
          {
            day: "Tuesday",
            after: "12:20–13:00",
            lostMinutes: 20,
          },
        ],
        "solution-cs204-reschedule-1",
      ),
      lunchBreakImpact(
        "impact-joc-2",
        "2026-07-10",
        "Move CS315",
        "CS315",
        [
          {
            day: "Wednesday",
            after: "12:45–13:00",
            lostMinutes: 45,
          },
        ],
      ),
      consecutiveTeachingImpact(
        "impact-joc-3",
        "2026-06-27",
        "Move CS220",
        "CS220",
        "Thursday",
        4,
        6,
        "09:00–13:00",
        "09:00–15:00",
      ),
      lunchBreakImpact(
        "impact-joc-4",
        "2026-06-15",
        "Move CS101",
        "CS101",
        [
          {
            day: "Friday",
            after: "No uninterrupted break",
            lostMinutes: 60,
          },
        ],
      ),
      lateTeachingImpact(
        "impact-joc-5",
        "2026-05-29",
        "Move CS330",
        "CS330",
        "Tuesday",
        "17:00",
        "18:00",
        60,
      ),
    ],
  },
  {
    stakeholderType: "lecturer",
    stakeholderId: "lecturer-3",
    stakeholderName: "Dr. Emma Walsh",
    lastAffectedAt: "2026-07-12",
    impacts: [
      consecutiveTeachingImpact(
        "impact-ew-1",
        "2026-07-12",
        "Move DS110",
        "DS110",
        "Wednesday",
        4,
        5,
        "09:00–13:00",
        "09:00–14:00",
      ),
      lunchBreakImpact(
        "impact-ew-2",
        "2026-06-30",
        "Move CS220",
        "CS220",
        [
          {
            day: "Monday",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
        ],
      ),
      lateTeachingImpact(
        "impact-ew-3",
        "2026-06-08",
        "Move DS210",
        "DS210",
        "Thursday",
        "17:00",
        "18:30",
        90,
      ),
    ],
  },
  {
    stakeholderType: "lecturer",
    stakeholderId: "lecturer-4",
    stakeholderName: "Prof. Michael Ryan",
    lastAffectedAt: "2026-06-21",
    impacts: [
      consecutiveTeachingImpact(
        "impact-mr-1",
        "2026-06-21",
        "Move SE310",
        "SE310",
        "Monday",
        3,
        5,
        "10:00–13:00",
        "10:00–15:00",
      ),
      lunchBreakImpact(
        "impact-mr-2",
        "2026-05-18",
        "Move CS310",
        "CS310",
        [
          {
            day: "Thursday",
            after: "12:40–13:00",
            lostMinutes: 40,
          },
        ],
      ),
    ],
  },
  {
    stakeholderType: "cohort",
    stakeholderId: "cs-y2",
    stakeholderName: "CS Year 2",
    lastAffectedAt: "2026-07-18",
    impacts: [
      dailyTeachingHoursImpact(
        "impact-csy2-1",
        "2026-07-18",
        "Move CS204",
        "CS204",
        "Friday",
        4,
        7,
        "solution-cs204-reschedule-1",
      ),
      lunchBreakImpact(
        "impact-csy2-lunch-1",
        "2026-07-14",
        "Move CS230",
        "CS230",
        [
          {
            day: "Tuesday",
            after: "12:30–13:00",
            lostMinutes: 30,
          },
        ],
      ),
      lunchBreakImpact(
        "impact-csy2-lunch-2",
        "2026-06-11",
        "Move CS220",
        "CS220",
        [
          {
            day: "Thursday",
            after: "No uninterrupted break",
            lostMinutes: 60,
          },
        ],
      ),
      largeGapImpact(
        "impact-csy2-2",
        "2026-07-06",
        "Move CS240",
        "CS240",
        "Tuesday",
        60,
        180,
        "11:00–12:00",
        "11:00–14:00",
      ),
      dailyTeachingHoursImpact(
        "impact-csy2-3",
        "2026-06-29",
        "Move CS230",
        "CS230",
        "Monday",
        4,
        6,
      ),
      lateTeachingImpact(
        "impact-csy2-4",
        "2026-06-14",
        "Move CS205",
        "CS205",
        "Wednesday",
        "17:00",
        "18:00",
        60,
      ),
      largeGapImpact(
        "impact-csy2-5",
        "2026-06-02",
        "Move CS220",
        "CS220",
        "Friday",
        60,
        240,
        "11:00–12:00",
        "11:00–15:00",
      ),
    ],
  },
  {
    stakeholderType: "cohort",
    stakeholderId: "cs-y1",
    stakeholderName: "CS Year 1",
    lastAffectedAt: "2026-07-03",
    impacts: [
      largeGapImpact(
        "impact-csy1-1",
        "2026-07-03",
        "Move CS101",
        "CS101",
        "Monday",
        30,
        150,
        "11:00–11:30",
        "11:00–13:30",
      ),
      lunchBreakImpact(
        "impact-csy1-lunch-1",
        "2026-06-24",
        "Move CS150",
        "CS150",
        [
          {
            day: "Monday",
            after: "12:20–13:00",
            lostMinutes: 20,
          },
        ],
      ),
      dailyTeachingHoursImpact(
        "impact-csy1-2",
        "2026-06-16",
        "Move CS150",
        "CS150",
        "Monday",
        4,
        5,
      ),
      lateTeachingImpact(
        "impact-csy1-3",
        "2026-05-22",
        "Move CS102",
        "CS102",
        "Tuesday",
        "17:00",
        "18:00",
        60,
      ),
    ],
  },
  {
    stakeholderType: "cohort",
    stakeholderId: "ds-y1",
    stakeholderName: "Data Science Year 1",
    lastAffectedAt: "2026-06-25",
    impacts: [
      largeGapImpact(
        "impact-dsy1-1",
        "2026-06-25",
        "Move DS110",
        "DS110",
        "Wednesday",
        60,
        180,
        "12:00–13:00",
        "12:00–15:00",
      ),
      lunchBreakImpact(
        "impact-dsy1-lunch-1",
        "2026-06-09",
        "Move DS101",
        "DS101",
        [
          {
            day: "Friday",
            after: "12:40–13:00",
            lostMinutes: 40,
          },
        ],
      ),
      dailyTeachingHoursImpact(
        "impact-dsy1-2",
        "2026-05-31",
        "Move DS101",
        "DS101",
        "Thursday",
        4,
        6,
      ),
    ],
  },
];

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
