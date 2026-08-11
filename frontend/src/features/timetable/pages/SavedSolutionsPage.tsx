import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronRight,
  Clock,
  MapPin,
  Trash2,
  UserRound,
} from "lucide-react";

import {
  savedSolutions,
  type SavedRequestType,
  type SavedSolution,
} from "../data/savedSolutionsData";

import {
  discardSolution,
  getDiscardedSolutionIds,
  getSavedSolutions,
} from "../data/savedSolutionsStore";

import "./SavedSolutionsPage.css";

type SavedRequestGroup = {
  requestId: string;
  requestType: SavedRequestType;
  requestCreatedAt: string;
  moduleCode: string;
  moduleTitle: string;
  requestSummary: string;
  original: SavedSolution["original"];
  solutions: SavedSolution[];
};

const requestTypeOrder: SavedRequestType[] = [
  "reschedule-class",
  "change-room",
  "change-lecturer",
];

function getRequestTypeLabel(type: SavedRequestType) {
  switch (type) {
    case "reschedule-class":
      return "Reschedule class";

    case "change-room":
      return "Change room";

    case "change-lecturer":
      return "Change lecturer";
  }
}

function getRequestTypeDescription(type: SavedRequestType) {
  switch (type) {
    case "reschedule-class":
      return "Requests that move a class to another day or time.";

    case "change-room":
      return "Requests that retain the class time but assign another room.";

    case "change-lecturer":
      return "Requests that retain the class time but assign another lecturer.";
  }
}

function groupSolutionsByRequest(
  solutions: SavedSolution[],
): SavedRequestGroup[] {
  const groups = new Map<string, SavedRequestGroup>();

  for (const solution of solutions) {
    const existingGroup = groups.get(solution.requestId);

    if (existingGroup) {
      existingGroup.solutions.push(solution);
      continue;
    }

    groups.set(solution.requestId, {
      requestId: solution.requestId,
      requestType: solution.requestType,
      requestCreatedAt: solution.requestCreatedAt,
      moduleCode: solution.moduleCode,
      moduleTitle: solution.moduleTitle,
      requestSummary: solution.requestSummary,
      original: solution.original,
      solutions: [solution],
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,

      solutions: [...group.solutions].sort(
        (a, b) =>
          new Date(b.savedAt).getTime() -
          new Date(a.savedAt).getTime(),
      ),
    }))
    .sort(
      (a, b) =>
        new Date(b.requestCreatedAt).getTime() -
        new Date(a.requestCreatedAt).getTime(),
    );
}

function CandidateRow({
  solution,
  candidateNumber,
  onDiscard,
}: {
  solution: SavedSolution;
  candidateNumber: number;
  onDiscard: (solution: SavedSolution) => void;
}) {
  return (
    <article className="saved-candidate-row">
      <div className="saved-candidate-number">
        Candidate {candidateNumber}
      </div>

      <div className="saved-candidate-result">
        <strong>{solution.result.day}</strong>

        <span>
          <Clock size={15} aria-hidden="true" />
          {solution.result.time}
        </span>

        <span>
          <MapPin size={15} aria-hidden="true" />
          {solution.result.room}
        </span>

        {solution.requestType === "change-lecturer" && (
          <span>
            <UserRound size={15} aria-hidden="true" />
            {solution.result.lecturer}
          </span>
        )}
      </div>

      <div className="saved-candidate-meta">
        <span>
          {solution.additionalChanges.length} additional{" "}
          {solution.additionalChanges.length === 1
            ? "change"
            : "changes"}
        </span>

        <span>
          Saved{" "}
          {new Date(solution.savedAt).toLocaleDateString()}
        </span>
      </div>

      <div className="saved-candidate-actions">
        <button
          type="button"
          className="discard-candidate-button"
          onClick={() => onDiscard(solution)}
          title="Discard this candidate"
          aria-label={`Discard candidate for ${solution.moduleCode}`}
        >
          <Trash2 size={17} aria-hidden="true" />
        </button>

        <Link
          to={`/saved-solutions/${solution.id}`}
          className="saved-solution-link"
        >
          View
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function SavedRequestCard({
  group,
  onDiscard,
}: {
  group: SavedRequestGroup;
  onDiscard: (solution: SavedSolution) => void;
}) {
  return (
    <article className="saved-request-card">
      <div className="saved-request-card-header">
        <div>
          <span className="saved-solution-module">
            {group.moduleCode}
          </span>

          <h3>{group.moduleTitle}</h3>

          <p>{group.requestSummary}</p>
        </div>

        <span className="saved-candidate-count">
          {group.solutions.length}{" "}
          {group.solutions.length === 1
            ? "candidate"
            : "candidates"}
        </span>
      </div>

      <div className="saved-request-original">
        <span className="saved-request-original-label">
          Original session
        </span>

        <strong>{group.original.day}</strong>

        <span>
          <Clock size={15} aria-hidden="true" />
          {group.original.time}
        </span>

        <span>
          <MapPin size={15} aria-hidden="true" />
          {group.original.room}
        </span>

        {group.requestType === "change-lecturer" && (
          <span>
            <UserRound size={15} aria-hidden="true" />
            {group.original.lecturer}
          </span>
        )}
      </div>

      <div className="saved-candidate-list">
        {group.solutions.map((solution, index) => (
          <CandidateRow
            key={solution.id}
            solution={solution}
            candidateNumber={index + 1}
            onDiscard={onDiscard}
          />
        ))}
      </div>

      {group.solutions.length > 1 && (
        <div className="saved-request-card-footer">
          <span>
            These candidates answer the same request and can be
            compared directly.
          </span>

          <button
            type="button"
            className="compare-candidates-button"
            disabled
            title="Candidate comparison will be added next"
          >
            Compare candidates
          </button>
        </div>
      )}
    </article>
  );
}

export function SavedSolutionsPage() {
  const [allSavedSolutions, setAllSavedSolutions] =
    useState<SavedSolution[]>(() => {
      const discardedIds = new Set(
        getDiscardedSolutionIds(),
      );

      return [
        ...getSavedSolutions(),
        ...savedSolutions,
      ].filter(
        (solution) => !discardedIds.has(solution.id),
      );
    });

  function handleDiscardSolution(
    solution: SavedSolution,
  ) {
    const candidatesForRequest =
      allSavedSolutions.filter(
        (candidate) =>
          candidate.requestId === solution.requestId,
      );

    const isLastCandidate =
      candidatesForRequest.length === 1;

    const confirmationMessage = isLastCandidate
      ? `Discard the only candidate for ${solution.moduleCode}? The request will disappear because it will have no saved candidates.`
      : `Discard this candidate for ${solution.moduleCode}?`;

    const confirmed = window.confirm(
      confirmationMessage,
    );

    if (!confirmed) {
      return;
    }

    discardSolution(solution.id);

    setAllSavedSolutions((currentSolutions) =>
      currentSolutions.filter(
        (candidate) =>
          candidate.id !== solution.id,
      ),
    );
  }

  const requestGroups = groupSolutionsByRequest(
    allSavedSolutions,
  );

  const groupsByType = requestGroups.reduce(
    (result, group) => {
      result[group.requestType].push(group);
      return result;
    },
    {
      "reschedule-class": [],
      "change-room": [],
      "change-lecturer": [],
    } as Record<SavedRequestType, SavedRequestGroup[]>,
  );

  return (
    <section className="saved-solutions-page">
      <header className="saved-solutions-header">
        <div>
          <h1>Open requests</h1>

          <p>
            Review timetable repair requests and the candidate
            solutions saved for each request.
          </p>
        </div>

        <span className="saved-solution-count">
          {requestGroups.length}{" "}
          {requestGroups.length === 1
            ? "request"
            : "requests"}
        </span>
      </header>

      {requestGroups.length === 0 ? (
        <div className="saved-solutions-empty">
          <h2>No open requests yet</h2>

          <p>
            Saved candidate solutions will appear here, grouped by
            the request that produced them.
          </p>
        </div>
      ) : (
        <div className="saved-request-type-list">
          {requestTypeOrder.map((requestType) => {
            const groups = groupsByType[requestType];

            if (groups.length === 0) {
              return null;
            }

            return (
              <details
                key={requestType}
                className="saved-request-type-section"
                open
              >
                <summary className="saved-request-type-summary">
                  <div className="saved-request-type-summary-main">
                    <span
                      className="saved-request-type-chevron"
                      aria-hidden="true"
                    >
                      <ChevronRight size={21} />
                    </span>

                    <div className="saved-request-type-copy">
                      <h2>
                        {getRequestTypeLabel(requestType)}
                      </h2>

                      <p>
                        {getRequestTypeDescription(
                          requestType,
                        )}
                      </p>
                    </div>
                  </div>

                  <span className="saved-request-type-count">
                    {groups.length}{" "}
                    {groups.length === 1
                      ? "request"
                      : "requests"}
                  </span>
                </summary>

                <div className="saved-request-type-content">
                  <div className="saved-solutions-list">
                    {groups.map((group) => (
                      <SavedRequestCard
                        key={group.requestId}
                        group={group}
                        onDiscard={
                          handleDiscardSolution
                        }
                      />
                    ))}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}