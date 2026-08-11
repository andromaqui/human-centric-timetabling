import { useEffect, useState } from "react";
import {
  getCohorts,
  getLecturers,
  getModules,
  getPrograms,
  getRooms,
  getSessions,
} from "../../../shared/api/timetableApi";
import {
  mapApiCohortToCohort,
  mapApiModuleToModule,
  mapApiProgramToProgram,
  mapApiRoomToRoom,
  mapApiSessionToSession,
} from "../utils/apiMappers";
import type { TimetableData } from "../data/timetableData";

export function useTimetableData() {
  const [data, setData] = useState<TimetableData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getSessions(),
      getModules(),
      getLecturers(),
      getCohorts(),
      getPrograms(),
      getRooms(),
    ])
      .then(([sessions, modules, lecturers, cohorts, programs, rooms]) => {
        if (cancelled) return;
        setData({
          sessions: sessions.map(mapApiSessionToSession),
          modules: modules.map(mapApiModuleToModule),
          lecturers,
          cohorts: cohorts.map(mapApiCohortToCohort),
          programs: programs.map(mapApiProgramToProgram),
          rooms: rooms.map(mapApiRoomToRoom),
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error };
}