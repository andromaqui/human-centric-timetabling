import type { Cohort, Module, Program, Room, Session } from "../types";
import type {
  ApiCohort,
  ApiModule,
  ApiProgram,
  ApiRoom,
  ApiSession,
} from "../../../shared/api/timetableApi";

export function mapApiSessionToSession(s: ApiSession): Session {
  return {
    id: s.id,
    moduleId: s.module_id,
    lecturerId: s.lecturer_id,
    programIds: s.program_ids,
    cohortIds: s.cohort_ids,
    start: s.start,
    end: s.end,
    room: s.room_name ?? undefined,
    type: s.type,
  };
}

export function mapApiModuleToModule(m: ApiModule): Module {
  return {
    id: m.id,
    code: m.code,
    title: m.title,
  };
}

export function mapApiCohortToCohort(c: ApiCohort): Cohort {
  return {
    id: c.id,
    name: c.name,
    programId: c.program_id,
  };
}

export function mapApiProgramToProgram(p: ApiProgram): Program {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
  };
}

export function mapApiRoomToRoom(r: ApiRoom): Room {
  return {
    id: r.id,
    name: r.name,
    capacity: r.capacity ?? undefined,
    equipment: r.equipment ?? undefined,
  };
}