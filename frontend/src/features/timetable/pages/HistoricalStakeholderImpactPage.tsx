import { useMemo, useState } from "react";
import {
  ArrowRight,
  Clock3,
  GraduationCap,
  Search,
  UserRound,
  Utensils,
  UsersRound,
} from "lucide-react";

import {
  historicalStakeholderImpacts,
  type HistoricalImpactRecord,
  type HistoricalImpactType,
  type HistoricalStakeholderImpact,
  type HistoricalStakeholderType,
} from "../data/historicalStakeholderImpact";

import "./HistoricalStakeholderImpactPage.css";

type ImpactOption = {
  value: HistoricalImpactType;
  label: string;
  description: string;
};

const lecturerImpactOptions: ImpactOption[] = [
  {
    value: "lunch-break-reduced",
    label: "Lunch breaks",
    description:
      "Lecturers should receive one uninterrupted hour each day between 12:00 and 14:00. This history shows accepted rescheduling decisions that reduced or removed that break.",
  },
  {
    value: "consecutive-teaching",
    label: "Consecutive teaching",
    description:
      "Lecturers should not teach for more than four consecutive hours in one day. This history shows accepted rescheduling decisions that exceeded that limit.",
  },

];

const cohortImpactOptions: ImpactOption[] = [
  {
    value: "lunch-break-reduced",
    label: "Lunch breaks",
    description:
      "Cohorts should receive one uninterrupted hour each day between 12:00 and 14:00. This history shows accepted rescheduling decisions that reduced or removed that break.",
  },
  {
    value: "consecutive-teaching",
    label: "Consecutive teaching",
    description:
      "Cohorts should not receive more than four consecutive teaching hours in one day. This history shows accepted rescheduling decisions that exceeded that limit.",
  },
  {
    value: "large-timetable-gap",
    label: "Large timetable gaps",
    description:
      "Accepted rescheduling decisions that introduced long idle periods between classes.",
  },
];

function getOccurrenceCount(
  impacts: HistoricalImpactRecord[],
) {
  return impacts.reduce((total, impact) => {
    if (impact.details.kind === "lunch-break") {
      return total + impact.details.changes.length;
    }

    return total + 1;
  }, 0);
}

function formatDate(date?: string) {
  if (!date) {
    return "Never";
  }

  return new Date(`${date}T00:00:00`).toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );
}

function getInitials(name: string) {
  return name
    .replace(/\b(Prof\.|Dr\.)\b/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getFilteredImpacts(
  stakeholder: HistoricalStakeholderImpact,
  impactType: HistoricalImpactType,
) {
  return stakeholder.impacts
    .filter((impact) => impact.impactType === impactType)
    .sort(
      (a, b) =>
        new Date(b.date).getTime() -
        new Date(a.date).getTime(),
    );
}

function getDistinctModuleCount(
  impacts: HistoricalImpactRecord[],
) {
  return new Set(
    impacts
      .map((impact) => impact.moduleCode)
      .filter(Boolean),
  ).size;
}

function getMostRecentRequest(
  impacts: HistoricalImpactRecord[],
) {
  return impacts[0]?.requestLabel ?? "None";
}

function formatMinutes(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = minutes / 60;

  return Number.isInteger(hours)
    ? `${hours} ${hours === 1 ? "hour" : "hours"}`
    : `${hours.toFixed(1)} hours`;
}

function renderImpactDetails(
  impact: HistoricalImpactRecord,
) {
  const { details } = impact;

  if (details.kind === "lunch-break") {
    return (
      <div className="historical-impact-structured-details">
        <span className="historical-impact-semester">
          {details.semester}
        </span>

        {details.changes.map((change) => (
          <div
            key={`${impact.id}-${change.day}`}
            className="historical-impact-detail-change-row"
          >
            <strong>{change.day}</strong>

            <span>
              {change.after}
            </span>

            <em>
              {formatMinutes(change.lostMinutes)} shorter
            </em>
          </div>
        ))}
      </div>
    );
  }

  if (details.kind === "consecutive-teaching") {
    return (
      <div className="historical-impact-structured-details">
        <span className="historical-impact-semester">
          {details.semester}
        </span>

        <div className="historical-impact-detail-change-row">
          <strong>{details.day}</strong>

          <span>
            {details.afterWindow} ({details.afterHours} h)
          </span>

          <em>
            Limit: {details.allowedHours} consecutive hours
          </em>
        </div>
      </div>
    );
  }

  if (details.kind === "daily-teaching-hours") {
    return (
      <div className="historical-impact-structured-details">
        <span className="historical-impact-semester">
          {details.semester}
        </span>

        <div className="historical-impact-detail-change-row">
          <strong>{details.day}</strong>

          <span>
            {details.beforeHours} h → {details.afterHours} h
          </span>

          <em>
            Preferred maximum: {details.allowedHours} hours
          </em>
        </div>
      </div>
    );
  }

  if (details.kind === "large-timetable-gap") {
    return (
      <div className="historical-impact-structured-details">
        <span className="historical-impact-semester">
          {details.semester}
        </span>

        <div className="historical-impact-detail-change-row">
          <strong>{details.day}</strong>

          <span>
            {details.afterWindow}
          </span>

          <em>
            Gap increased from{" "}
            {formatMinutes(details.beforeGapMinutes)} to{" "}
            {formatMinutes(details.afterGapMinutes)}
          </em>
        </div>
      </div>
    );
  }

  return (
    <div className="historical-impact-structured-details">
      <span className="historical-impact-semester">
        {details.semester}
      </span>

      <div className="historical-impact-detail-change-row">
        <strong>{details.day}</strong>

        <span>
          {details.preferredFinish} → {details.actualFinish}
        </span>

        <em>
          {formatMinutes(details.additionalMinutes)} later
        </em>
      </div>
    </div>
  );
}

function getImpactIcon(impactType: HistoricalImpactType) {
  if (impactType === "lunch-break-reduced") {
    return <Utensils size={18} aria-hidden="true" />;
  }

  return <Clock3 size={18} aria-hidden="true" />;
}

export function HistoricalStakeholderImpactPage() {
  const [stakeholderType, setStakeholderType] =
    useState<HistoricalStakeholderType>("lecturer");

  const [impactType, setImpactType] =
    useState<HistoricalImpactType>(
      "lunch-break-reduced",
    );

  const [searchQuery, setSearchQuery] = useState("");

  const impactOptions =
    stakeholderType === "lecturer"
      ? lecturerImpactOptions
      : cohortImpactOptions;

  const matchingStakeholders = useMemo(() => {
    const normalizedQuery = searchQuery
      .trim()
      .toLowerCase();

    return historicalStakeholderImpacts
      .filter(
        (stakeholder) =>
          stakeholder.stakeholderType === stakeholderType,
      )
      .map((stakeholder) => ({
        stakeholder,
        matchingImpacts: getFilteredImpacts(
          stakeholder,
          impactType,
        ),
      }))
      .filter(
        ({ stakeholder, matchingImpacts }) =>
          matchingImpacts.length > 0 &&
          (!normalizedQuery ||
            stakeholder.stakeholderName
              .toLowerCase()
              .includes(normalizedQuery)),
      )
      .sort(
        (a, b) =>
          b.matchingImpacts.length -
          a.matchingImpacts.length,
      );
  }, [impactType, searchQuery, stakeholderType]);

  const [selectedStakeholderId, setSelectedStakeholderId] =
    useState<string | null>("lecturer-2");

  const selectedEntry =
    matchingStakeholders.find(
      ({ stakeholder }) =>
        stakeholder.stakeholderId ===
        selectedStakeholderId,
    ) ??
    matchingStakeholders[0] ??
    null;

  function handleStakeholderTypeChange(
    nextType: HistoricalStakeholderType,
  ) {
    setStakeholderType(nextType);
    setSearchQuery("");

    const nextDefaultImpact =
      nextType === "lecturer"
        ? "lunch-break-reduced"
        : "lunch-break-reduced";

    setImpactType(nextDefaultImpact);

    const firstMatchingStakeholder =
      historicalStakeholderImpacts.find(
        (stakeholder) =>
          stakeholder.stakeholderType === nextType &&
          stakeholder.impacts.some(
            (impact) =>
              impact.impactType === nextDefaultImpact,
          ),
      );

    setSelectedStakeholderId(
      firstMatchingStakeholder?.stakeholderId ?? null,
    );
  }

  function handleImpactTypeChange(
    nextImpactType: HistoricalImpactType,
  ) {
    setImpactType(nextImpactType);
    setSearchQuery("");

    const firstMatchingStakeholder =
      historicalStakeholderImpacts.find(
        (stakeholder) =>
          stakeholder.stakeholderType ===
            stakeholderType &&
          stakeholder.impacts.some(
            (impact) =>
              impact.impactType === nextImpactType,
          ),
      );

    setSelectedStakeholderId(
      firstMatchingStakeholder?.stakeholderId ?? null,
    );
  }

  const activeImpactOption =
    impactOptions.find(
      (option) => option.value === impactType,
    ) ?? impactOptions[0];

  const affectedStakeholderCount =
    matchingStakeholders.length;

  const totalMatchingImpacts =
    matchingStakeholders.reduce(
      (total, entry) =>
        total + entry.matchingImpacts.length,
      0,
    );

  const selectedStakeholder =
    selectedEntry?.stakeholder ?? null;

  const selectedImpacts =
    selectedEntry?.matchingImpacts ?? [];

  return (
    <section className="historical-impact-page historical-impact-page-focused">
      <header className="historical-impact-header historical-impact-header-focused">
        <div>
          <span className="historical-impact-eyebrow">
            Rescheduling history
          </span>

          <h1>Historical Stakeholder Impact</h1>

          <p>
            Focus on one type of impact at a time to identify
            lecturers and cohorts that have repeatedly absorbed
            similar timetable consequences.
          </p>
        </div>
      </header>

      <section className="historical-impact-query-panel">
        <fieldset className="historical-impact-query-group">
          <legend>Impact type</legend>

          <div className="historical-impact-query-options">
            {impactOptions.map((option) => (
              <label
                key={option.value}
                className={[
                  "historical-impact-query-option",
                  impactType === option.value
                    ? "is-selected"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <input
                  type="radio"
                  name="historical-impact-type"
                  value={option.value}
                  checked={impactType === option.value}
                  onChange={() =>
                    handleImpactTypeChange(option.value)
                  }
                />

                {getImpactIcon(option.value)}
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="historical-impact-query-group">
          <legend>Stakeholder type</legend>

          <div className="historical-impact-query-options">
            <label
              className={[
                "historical-impact-query-option",
                stakeholderType === "lecturer"
                  ? "is-selected"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                type="radio"
                name="historical-stakeholder-type"
                checked={stakeholderType === "lecturer"}
                onChange={() =>
                  handleStakeholderTypeChange("lecturer")
                }
              />

              <UserRound size={18} aria-hidden="true" />
              <span>Lecturers</span>
            </label>

            <label
              className={[
                "historical-impact-query-option",
                stakeholderType === "cohort"
                  ? "is-selected"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                type="radio"
                name="historical-stakeholder-type"
                checked={stakeholderType === "cohort"}
                onChange={() =>
                  handleStakeholderTypeChange("cohort")
                }
              />

              <GraduationCap
                size={18}
                aria-hidden="true"
              />
              <span>Cohorts</span>
            </label>
          </div>
        </fieldset>
      </section>

      <section className="historical-impact-context-banner">
        <UsersRound size={24} aria-hidden="true" />

        <div>
          <strong>
            {affectedStakeholderCount}{" "}
            {stakeholderType === "lecturer"
              ? affectedStakeholderCount === 1
                ? "lecturer has"
                : "lecturers have"
              : affectedStakeholderCount === 1
                ? "cohort has"
                : "cohorts have"}{" "}
            experienced {activeImpactOption.label.toLowerCase()}
          </strong>

          <span>
            {totalMatchingImpacts} recorded{" "}
            {totalMatchingImpacts === 1
              ? "occurrence"
              : "occurrences"}{" "}
            across previous accepted timetable changes.
          </span>
        </div>
      </section>

      <div className="historical-impact-focused-layout">
        <section className="historical-impact-stakeholder-list">
          <header className="historical-impact-list-header">
            <div>
              <h2>
                {stakeholderType === "lecturer"
                  ? "Lecturers"
                  : "Cohorts"}
              </h2>

              <p>Sorted by most affected.</p>
            </div>
          </header>

          <label className="historical-impact-focused-search">
            <Search size={18} aria-hidden="true" />

            <input
              type="search"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              placeholder={`Search ${
                stakeholderType === "lecturer"
                  ? "lecturers"
                  : "cohorts"
              }`}
            />
          </label>

          <div className="historical-impact-stakeholder-rows">
            {matchingStakeholders.map(
              ({ stakeholder, matchingImpacts }) => (
                <button
                  key={stakeholder.stakeholderId}
                  type="button"
                  className={[
                    "historical-impact-stakeholder-row",
                    selectedStakeholder
                      ?.stakeholderId ===
                    stakeholder.stakeholderId
                      ? "is-selected"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() =>
                    setSelectedStakeholderId(
                      stakeholder.stakeholderId,
                    )
                  }
                >
                  <span className="historical-impact-avatar">
                    {getInitials(
                      stakeholder.stakeholderName,
                    )}
                  </span>

                  <span className="historical-impact-row-name">
                    {stakeholder.stakeholderName}
                  </span>

                  <span className="historical-impact-row-count">
                    <strong>
                      {matchingImpacts.length}
                    </strong>
                    affected
                  </span>

                  <ArrowRight
                    size={17}
                    aria-hidden="true"
                  />
                </button>
              ),
            )}
          </div>

          {matchingStakeholders.length === 0 && (
            <div className="historical-impact-empty">
              <h3>No matching stakeholders</h3>
              <p>
                No recorded impacts match the selected filters.
              </p>
            </div>
          )}
        </section>

        <section className="historical-impact-focused-detail">
          {selectedStakeholder ? (
            <>
              <header className="historical-impact-focused-detail-header">
                <div className="historical-impact-focused-identity">
                  <span className="historical-impact-large-avatar">
                    {getInitials(
                      selectedStakeholder.stakeholderName,
                    )}
                  </span>

                  <div>
                    <small>
                      {selectedStakeholder.stakeholderType ===
                      "lecturer"
                        ? "Lecturer"
                        : "Cohort"}
                    </small>

                    <h2>
                      {
                        selectedStakeholder.stakeholderName
                      }
                    </h2>
                  </div>
                </div>

                <div className="historical-impact-last-occurrence">
                  <span>Last occurrence</span>
                  <strong>
                    {formatDate(
                      selectedImpacts[0]?.date,
                    )}
                  </strong>
                </div>
              </header>

              <section className="historical-impact-focused-summary">
                <h3>{activeImpactOption.label} impacted</h3>

                <div className="historical-impact-focused-metrics">
                  <article>
                      <span>Times affected</span>
                      <strong>
                        {getOccurrenceCount(selectedImpacts)}
                      </strong>
                    </article>

                  <article>
                    <span>Distinct modules</span>
                    <strong>
                      {getDistinctModuleCount(
                        selectedImpacts,
                      )}
                    </strong>
                  </article>
                </div>
              </section>

              <section className="historical-impact-focused-history">
                <header>
                  <div>
                    <h3>History</h3>
                    <p>
                      {activeImpactOption.description}
                    </p>
                  </div>
                </header>

                <div className="historical-impact-focused-timeline">
                  {selectedImpacts.map((impact) => (
                    <article
                      key={impact.id}
                      className="historical-impact-focused-timeline-row"
                    >
                      <time dateTime={impact.date}>
                        {formatDate(impact.date)}
                      </time>

                      <div>
                        <h4>{impact.requestLabel}</h4>
                        {renderImpactDetails(impact)}

                        {impact.moduleCode && (
                          <span>
                            {impact.moduleCode}
                          </span>
                        )}
                      </div>

                      <span className="historical-impact-accepted-badge">
                        Accepted
                      </span>
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <div className="historical-impact-detail-empty">
              <h2>Select a stakeholder</h2>
              <p>
                Choose a stakeholder to review their history for
                the selected impact type.
              </p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
