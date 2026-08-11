import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useTimetableData } from "../hooks/useTimetableData";
import { mapSessionsToCalendarEvents } from "../utils/calendarMappers";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventContentArg } from "@fullcalendar/core";
import "./TimetableCalendar.css";
import { useNavigate } from "react-router-dom";

function EventCard({ eventInfo }: { eventInfo: EventContentArg }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  const { session, lecturer, cohorts } = eventInfo.event.extendedProps as {
    session: { id: string; room?: string };
    lecturer?: { name: string };
    cohorts: { id: string; name: string }[];
  };

  const cohortNames = cohorts.map((c) => c.name).join(", ") || "Unassigned";


// inside EventCard:
const navigate = useNavigate();

function handleReschedule(e: React.MouseEvent) {
  e.stopPropagation();
  navigate(`/sessions/${session.id}/reschedule`);
}

  function openPopover() {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPopoverPos({ top: rect.bottom + 6, left: rect.left });
    setIsOpen(true);
  }

  function closePopover() {
    setIsOpen(false);
    setPopoverPos(null);
  }

  function handleCardClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (isOpen) {
      closePopover();
    } else {
      openPopover();
    }
  }

  useEffect(() => {
    if (!isOpen) return;

    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      closePopover();
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={isOpen ? "timetable-event is-open" : "timetable-event"}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
    >
      <div className="event-time">{eventInfo.timeText}</div>
      <div className="event-title">{eventInfo.event.title}</div>

      {isOpen &&
        popoverPos &&
        createPortal(
          <div
            ref={popoverRef}
            className="event-popover"
            style={{ top: popoverPos.top, left: popoverPos.left }}
          >
            <div className="event-time">{eventInfo.timeText}</div>
            <div className="event-title">{eventInfo.event.title}</div>

            <div className="event-tags">
              <div className="tag-row tag-lecturer">
                <span className="tag-dot" />
                {lecturer?.name ?? "Unassigned"}
              </div>
              <div className="tag-row tag-room">
                <span className="tag-dot" />
                {session.room ?? "TBC"}
              </div>
              <div className="tag-row tag-cohort">
                <span className="tag-dot" />
                {cohortNames}
              </div>
            </div>

            <div className="popover-actions">
              <button
                  type="button"
                  className="popover-reschedule-button"
                  onClick={handleReschedule}
                >
                  Reschedule
                </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export function TimetableCalendar() {
  const { data, error } = useTimetableData();

  if (error) {
    return (
      <section className="timetable-shell">
        <div className="timetable-header">
          <p className="timetable-eyebrow">Timetable</p>
          <h1 className="timetable-title">University Timetable</h1>
        </div>
        <p className="timetable-error">
          Failed to load timetable: {error.message}
        </p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="timetable-shell">
        <div className="timetable-header">
          <p className="timetable-eyebrow">Timetable</p>
          <h1 className="timetable-title">University Timetable</h1>
        </div>
        <p className="timetable-loading">Loading timetable…</p>
      </section>
    );
  }

  const events = mapSessionsToCalendarEvents(
    data.sessions,
    data.modules,
    data.lecturers,
    data.programs,
    data.cohorts
  );

  function renderEventContent(eventInfo: EventContentArg) {
    return <EventCard eventInfo={eventInfo} />;
  }

  return (
    <section className="timetable-shell">
      <div className="timetable-header">
        <p className="timetable-eyebrow">Timetable</p>
        <h1 className="timetable-title">University Timetable</h1>
      </div>

      <div className="timetable-legend">
        <span className="legend-item tag-lecturer">
          <span className="tag-dot" />
          Lecturer
        </span>
        <span className="legend-item tag-room">
          <span className="tag-dot" />
          Room
        </span>
        <span className="legend-item tag-cohort">
          <span className="tag-dot" />
          Cohort
        </span>
      </div>

      <div className="timetable-calendar">
        <FullCalendar
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          initialDate="2026-09-21"
          weekends={false}
          allDaySlot={false}
          slotMinTime="08:00:00"
          slotMaxTime="20:00:00"
          height="auto"
          events={events}
          eventContent={renderEventContent}
        />
      </div>
    </section>
  );
}