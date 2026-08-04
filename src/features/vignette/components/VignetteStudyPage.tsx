import { useState } from "react";
import "./VignetteStudyPage.css";

type Step = 1 | 2 | 3;

export function VignetteStudyPage() {
  const [step, setStep] = useState<Step>(1);

  return (
    <section className="vignette-page">
      <div className="vignette-hero">
        <p className="eyebrow">Research study</p>
        <h1>Vignette Study</h1>
        <p>
          Evaluating user preferences for infeasibility explanations in
          university timetabling.
        </p>
      </div>

      <div className="vignette-stepper">
        <button className={step === 1 ? "active" : ""} onClick={() => setStep(1)}>
          1. Overview
        </button>
        <button className={step === 2 ? "active" : ""} onClick={() => setStep(2)}>
          2. Vignette
        </button>
        <button className={step === 3 ? "active" : ""} onClick={() => setStep(3)}>
          3. Evaluation
        </button>
      </div>

      {step === 1 && (
        <div className="vignette-grid single">
          <article className="vignette-card">
            <h2>Motivation</h2>
            <p>
              When a timetabling system cannot schedule a class, there may be
              several possible explanations: no suitable room, lecturer
              unavailability, cohort limits, or interacting constraints.
            </p>
            <p>
              This study investigates what information users actually want when
              a scheduling request is infeasible.
            </p>
          </article>

          <article className="vignette-card">
            <h2>Research question</h2>
            <p>
              What characteristics make infeasibility explanations useful for
              university timetablers?
            </p>
            <ul>
              <li>Single reason or multiple reasons?</li>
              <li>Technical or domain-oriented explanations?</li>
              <li>Causes, resolutions, or both?</li>
              <li>How much detail is useful?</li>
            </ul>
          </article>
        </div>
      )}

      {step === 2 && (
        <div className="vignette-grid single">
          <article className="vignette-card">
            <div className="scenario-box">
                  <h3>Scheduling Request</h3>

                  <p className="scenario-description">
                      As a timetabler, you need to reschedule a class to a new time. The following constraints are true:
                  </p>

                  <div className="request-table">
                    <div className="request-row">
                      <span className="request-label">Lecturer</span>
                      <span className="request-value">Lecturer X</span>
                    </div>

                    <div className="request-row">
                      <span className="request-label">Lecturer Availability</span>
                      <span className="request-value">13:00–13:30</span>
                    </div>

                    <div className="request-row">
                      <span className="request-label">Class</span>
                      <span className="request-value">
                        CS101 · Programming Fundamentals
                      </span>
                    </div>

                    <div className="request-row">
                      <span className="request-label">Day</span>
                      <span className="request-value">Today</span>
                    </div>

                    <div className="request-row">
                      <span className="request-label">Required equipment</span>
                      <span className="request-value">
                        Projector, Linux Lab
                      </span>
                    </div>

                    <div className="request-row">
                      <span className="request-label">Cohort Size</span>
                      <span className="request-value">
                        Cohort A (50 students)
                      </span>
                    </div>

                    <div className="request-row">
                      <span className="request-label">Cohort Daily Time Limit</span>
                      <span className="request-value">
                        Max 2 teaching hours
                      </span>
                    </div>
                  </div>

                  <div className="no-solution-message">
                    No feasible schedule found.
                  </div>
                </div>
          </article>

          <article className="vignette-card">
            <h2>Explanation A</h2>
            <p className="explanation-type">Resource-based</p>
            <p>
              No room is available between 13:00 and 13:30 that accommodates 50
              students and contains equipment X, Y and Z.
            </p>
          </article>

          <article className="vignette-card">
            <h2>Explanation B</h2>
            <p className="explanation-type">Multiple reasons</p>
            <p>The class cannot be scheduled because:</p>
            <ul>
              <li>Cohort A would exceed its daily teaching limit.</li>
              <li>No suitable room is available between 13:00 and 13:30.</li>
            </ul>
          </article>

          <article className="vignette-card">
            <h2>Explanation C</h2>
            <p className="explanation-type">Action-oriented</p>
            <p>Possible ways to make it feasible include:</p>
            <ul>
              <li>scheduling it on another day,</li>
              <li>relaxing the cohort teaching limit,</li>
              <li>or selecting another time with a suitable room.</li>
            </ul>
          </article>
        </div>
      )}

      {step === 3 && (
        <div className="vignette-grid single">
          <article className="vignette-card">
            <h2>Evaluation</h2>
            <p>Participants rate each explanation using Likert scales:</p>

            <div className="metric-list">
              <span>Usefulness</span>
              <span>Clarity</span>
              <span>Completeness</span>
              <span>Actionability</span>
              <span>Trust</span>
              <span>Overall preference</span>
            </div>
          </article>

          <article className="vignette-card">
            <h2>Open questions</h2>
            <ul>
              <li>What information is missing?</li>
              <li>Which explanation would you prefer to receive?</li>
              <li>Why?</li>
            </ul>
          </article>

          <article className="vignette-card">
            <h2>Expected outcome</h2>
            <p>
              The study identifies which explanation characteristics users
              value, how much detail they prefer, and whether they want
              explanations, recommendations, or both.
            </p>
            <p>
              These findings can then be used to define the requirements for an
              explanation generation algorithm.
            </p>
          </article>
        </div>
      )}

      <div className="vignette-navigation">
        <button disabled={step === 1} onClick={() => setStep((step - 1) as Step)}>
          ← Previous
        </button>

        <button disabled={step === 3} onClick={() => setStep((step + 1) as Step)}>
          Next →
        </button>
      </div>
    </section>
  );
}