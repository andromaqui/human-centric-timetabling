import type { ConstraintDefinition } from "../types";

export const constraints: ConstraintDefinition[] = [
  {
    id: "lecturer-one-class-at-time",
    name: "Lecturer cannot teach more than 1 class at a time",
    stakeholder: "Lecturer",
    type: "unrelaxable",
  },
  {
    id: "lecturer-unavailability",
    name: "Lecturer unavailability",
    stakeholder: "Lecturer",
    type: "unrelaxable",
  },
  {
    id: "room-one-booking-at-time",
    name: "A room can have maximum one booking at a time",
    stakeholder: "Class",
    type: "unrelaxable",
  },
  {
    id: "lecturer-lunch-break",
    name: "Lecturer lunch break",
    stakeholder: "Lecturer",
    type: "relaxable",
  },
  {
    id: "lecturer-max-one-hour-per-day",
    name: "Lecturer shall teach maximum 1 hour per day",
    stakeholder: "Lecturer",
    type: "relaxable",
  },
  {
    id: "cohort-max-teaching-hours-per-day",
    name: "Cohort's maximum teaching hours per day",
    stakeholder: "Cohort",
    type: "relaxable",
  },
  {
    id: "class-equipment",
    name: "Class equipment",
    stakeholder: "Class",
    type: "relaxable",
  },
  {
    id: "class-capacity",
    name: "Class capacity",
    stakeholder: "Class",
    type: "relaxable",
  },
];