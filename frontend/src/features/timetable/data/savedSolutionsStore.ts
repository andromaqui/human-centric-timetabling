import type { SavedSolution } from "./savedSolutionsData";

const SAVED_SOLUTIONS_KEY = "timetable-saved-solutions";
const DISCARDED_SOLUTION_IDS_KEY =
  "timetable-discarded-solution-ids";

function readSavedSolutions(): SavedSolution[] {
  try {
    const storedValue = localStorage.getItem(
      SAVED_SOLUTIONS_KEY,
    );

    if (!storedValue) return [];

    const parsedValue = JSON.parse(storedValue);

    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function writeSavedSolutions(solutions: SavedSolution[]) {
  localStorage.setItem(
    SAVED_SOLUTIONS_KEY,
    JSON.stringify(solutions),
  );
}

function readDiscardedSolutionIds(): string[] {
  try {
    const storedValue = localStorage.getItem(
      DISCARDED_SOLUTION_IDS_KEY,
    );

    if (!storedValue) return [];

    const parsedValue = JSON.parse(storedValue);

    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function writeDiscardedSolutionIds(ids: string[]) {
  localStorage.setItem(
    DISCARDED_SOLUTION_IDS_KEY,
    JSON.stringify(ids),
  );
}

export function saveSolution(solution: SavedSolution) {
  const currentSolutions = readSavedSolutions();

  writeSavedSolutions([
    ...currentSolutions.filter(
      (existingSolution) =>
        existingSolution.id !== solution.id,
    ),
    solution,
  ]);

  // If an ID is reused, make it visible again.
  const discardedIds = readDiscardedSolutionIds();

  writeDiscardedSolutionIds(
    discardedIds.filter((id) => id !== solution.id),
  );
}

export function getSavedSolutions() {
  return readSavedSolutions();
}

export function getSavedSolutionById(id: string) {
  return readSavedSolutions().find(
    (solution) => solution.id === id,
  );
}

export function getDiscardedSolutionIds() {
  return readDiscardedSolutionIds();
}

export function discardSolution(id: string) {
  const currentSolutions = readSavedSolutions();

  // Removes dynamically saved candidates.
  writeSavedSolutions(
    currentSolutions.filter(
      (solution) => solution.id !== id,
    ),
  );

  // Also hides hardcoded prototype candidates.
  const discardedIds = readDiscardedSolutionIds();

  if (!discardedIds.includes(id)) {
    writeDiscardedSolutionIds([
      ...discardedIds,
      id,
    ]);
  }
}