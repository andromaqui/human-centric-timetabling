import { api } from "./client";

// Raw shapes exactly as the backend returns them (snake_case)
export interface ApiSession {
  id: string;
  module_id: string;
  lecturer_id: string;
  room_id: string | null;
  room_name: string | null;
  type: "lecture" | "tutorial" | "lab" | "seminar";
  start: string;
  end: string;
  program_ids: string[];
  cohort_ids: string[];
}

export interface ApiModule {
  id: string;
  code: string;
  title: string;
  required_capacity: number | null;
  required_equipment: string | null;
}

export interface ApiLecturer {
  id: string;
  name: string;
}

export interface ApiCohort {
  id: string;
  name: string;
  program_id: string;
}

export interface ApiProgram {
  id: string;
  code: string;
  name: string;
}

export interface ApiRoom {
  id: string;
  name: string;
  capacity: number | null;
  equipment: string | null;
}

export function getSessions() {
  return api.get<ApiSession[]>("/sessions/");
}

export function getModules() {
  return api.get<ApiModule[]>("/modules/");
}

export function getLecturers() {
  return api.get<ApiLecturer[]>("/lecturers/");
}

export function getCohorts() {
  return api.get<ApiCohort[]>("/cohorts/");
}

export function getPrograms() {
  return api.get<ApiProgram[]>("/programs/");
}

export function getRooms() {
  return api.get<ApiRoom[]>("/rooms/");
}