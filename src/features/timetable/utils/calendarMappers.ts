import type { EventInput } from "@fullcalendar/core";
import type { Cohort, Lecturer, Module, Program, Session } from "../types";

export function mapSessionsToCalendarEvents(
  sessions: Session[],
  modules: Module[],
  lecturers: Lecturer[],
  programs: Program[],
  cohorts: Cohort[]
): EventInput[] {
  return sessions.map((session) => {
    const module = modules.find((item) => item.id === session.moduleId);
    const lecturer = lecturers.find((item) => item.id === session.lecturerId);

    const sessionPrograms = programs.filter((program) =>
      session.programIds.includes(program.id)
    );

    const sessionCohorts = cohorts.filter((cohort) =>
      session.cohortIds.includes(cohort.id)
    );

    return {
      id: session.id,
      title: module ? `${module.code} · ${module.title}` : "Untitled class",
      start: session.start,
      end: session.end,
      extendedProps: {
        session,
        module,
        lecturer,
        programs: sessionPrograms,
        cohorts: sessionCohorts,
      },
    };
  });
}