import { NavLink, Route, Routes } from "react-router-dom";
import { SavedSolutionsPage } from "./features/timetable/pages/SavedSolutionsPage";
import { TimetableCalendar } from "./features/timetable/components/TimetableCalendar";
import { ConstraintsPage } from "./features/constraints/components/ConstraintsPage";
import { ReschedulePage } from "./features/timetable/pages/ReschedulePage";
import { StakeholderTimetablePage } from "./features/timetable/pages/StakeholderTimetablePage";
import { SavedSolutionDetailPage } from "./features/timetable/pages/SavedSolutionDetailPage";
import { HistoricalStakeholderImpactPage } from "./features/timetable/pages/HistoricalStakeholderImpactPage";
import "./App.css";

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="topbar-brand">
          <span className="topbar-brand-mark" />
          <span>Timetable</span>
        </NavLink>

        <nav className="topbar-nav">
          <NavLink to="/" className="nav-button">
            <span>Timetable</span>
          </NavLink>

          <NavLink to="/constraints" className="nav-button">
            <span>Constraints</span>
          </NavLink>

          <NavLink to="/saved-solutions" className="nav-button">
            <span>Candidate solutions</span>
          </NavLink>

          <NavLink to="/historical-impact" className="nav-button">
            <span>Historical impact</span>
          </NavLink>
        </nav>
      </header>

      <main className="app-content">
        <Routes>
          <Route path="/" element={<TimetableCalendar />} />
          <Route path="/constraints" element={<ConstraintsPage />} />
          <Route path="/sessions/:sessionId/reschedule" element={<ReschedulePage />} />
          <Route path="/timetable-preview" element={<StakeholderTimetablePage />} />
          <Route path="/saved-solutions" element={<SavedSolutionsPage />} />
          <Route path="/saved-solutions/:solutionId" element={<SavedSolutionDetailPage />} />
          <Route path="/historical-impact" element={<HistoricalStakeholderImpactPage />}/>
        </Routes>
      </main>
    </div>
  );
}

export default App;