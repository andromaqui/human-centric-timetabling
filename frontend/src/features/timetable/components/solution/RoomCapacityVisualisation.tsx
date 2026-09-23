import { useMemo, useState } from "react";
import "./ObjectiveVisualisations.css";

export type RoomCapacityRoom = {
  id: string;
  name: string;
  capacity: number;
};

export type RoomCapacitySession = {
  id: string;
  moduleCode: string;
  moduleName?: string;
  day: string;
  time: string;
  roomId: string;
  requiredCapacity: number;
};

type RoomCapacityVisualisationProps = {
  rooms: RoomCapacityRoom[];
  sessions: RoomCapacitySession[];
  initialRoomId?: string | null;
  proposedSessionId?: string | null;
};

export function RoomCapacityVisualisation({
  rooms,
  sessions,
  initialRoomId,
  proposedSessionId,
}: RoomCapacityVisualisationProps) {
  const [selectedRoomId, setSelectedRoomId] = useState(
    initialRoomId ?? rooms[0]?.id ?? "",
  );

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId),
    [rooms, selectedRoomId],
  );

  const roomSessions = useMemo(
    () =>
      sessions.filter(
        (session) => session.roomId === selectedRoomId,
      ),
    [sessions, selectedRoomId],
  );

  if (rooms.length === 0) {
    return (
      <div className="objective-visualisation">
        <p>No room information is available.</p>
      </div>
    );
  }

  return (
    <section className="objective-visualisation">
      <div className="objective-visualisation-header">
        <div>
          <span className="objective-eyebrow">
            ROOM OBJECTIVE
          </span>
          <h3>Room capacity</h3>
          <p>
            See how closely each class matches the capacity of
            the selected room.
          </p>
        </div>

        <div className="objective-selector">
          <label htmlFor="room-capacity-room">
            Room
          </label>

          <select
            id="room-capacity-room"
            value={selectedRoomId}
            onChange={(event) =>
              setSelectedRoomId(event.target.value)
            }
          >
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedRoom && (
        <div className="objective-summary">
          <span>Room capacity</span>
          <strong>{selectedRoom.capacity} seats</strong>
        </div>
      )}

      <div className="objective-session-list">
        {roomSessions.length === 0 ? (
          <p className="objective-empty">
            No classes are scheduled in this room.
          </p>
        ) : (
          roomSessions.map((session) => {
            const roomCapacity =
              selectedRoom?.capacity ?? 0;

            const unusedSeats =
              roomCapacity - session.requiredCapacity;

            const utilisation =
              roomCapacity > 0
                ? Math.min(
                    100,
                    Math.round(
                      (session.requiredCapacity /
                        roomCapacity) *
                        100,
                    ),
                  )
                : 0;

            const isProposed =
              session.id === proposedSessionId;

            return (
              <article
                key={session.id}
                className={`objective-session ${
                  isProposed ? "proposed" : ""
                }`}
              >
                <div className="objective-session-heading">
                  <div>
                    <strong>{session.moduleCode}</strong>

                    {session.moduleName && (
                      <span>{session.moduleName}</span>
                    )}
                  </div>

                  {isProposed && (
                    <span className="objective-proposed-badge">
                      Proposed
                    </span>
                  )}
                </div>

                <div className="objective-session-meta">
                  {session.day} · {session.time}
                </div>

                <div className="capacity-values">
                  <span>
                    {session.requiredCapacity} required
                  </span>

                  <span>
                    {roomCapacity} seats
                  </span>
                </div>

                <div
                  className="capacity-track"
                  aria-label={`${utilisation}% room utilisation`}
                >
                  <div
                    className="capacity-fill"
                    style={{ width: `${utilisation}%` }}
                  />
                </div>

                <div className="capacity-result">
                  {unusedSeats >= 0 ? (
                    <>
                      <strong>{unusedSeats}</strong>{" "}
                      {unusedSeats === 1
                        ? "unused seat"
                        : "unused seats"}
                    </>
                  ) : (
                    <span className="capacity-shortage">
                      <strong>
                        {Math.abs(unusedSeats)}
                      </strong>{" "}
                      {Math.abs(unusedSeats) === 1
                        ? "seat short"
                        : "seats short"}
                    </span>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}