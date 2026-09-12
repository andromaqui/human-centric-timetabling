import { api } from "../../../shared/api/client";

export type WorkingSessionMove = {
  session_id: string;
  new_start: string;
  new_end: string;
};

export type WorkingDayViolation = {
  type: string;

  session_ids?: string[];

  lecturer_id?: string;
  room_id?: string;
  cohort_id?: string;

  day?: string;
  hour?: number;

  total_hours?: number;
  limit?: number;

  blocking_12_13?: string[];
  blocking_13_14?: string[];
};

export type WorkingDayRequest = {
  day: string;
  moves: WorkingSessionMove[];
};

export type WorkingDayResponse = {
  violations: WorkingDayViolation[];
};

export async function diagnoseWorkingDay(
  request: WorkingDayRequest,
): Promise<WorkingDayResponse> {
  return api.post<WorkingDayResponse>(
    "/sessions/day/working",
    request,
  );
}