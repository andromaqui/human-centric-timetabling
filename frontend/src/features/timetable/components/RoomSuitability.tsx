import "./RoomSuitability.css";

type RoomSuitabilityProps = {
  roomName: string;
  roomCapacity: number;
  roomEquipment?: string[];
  studentCount: number;
  requiredEquipment?: string[];
};

export function RoomSuitability({
  roomName,
  roomCapacity,
  roomEquipment = [],
  studentCount,
  requiredEquipment = [],
}: RoomSuitabilityProps) {
  const capacityOk = roomCapacity >= studentCount;

  const missingEquipment = requiredEquipment.filter(
    (equipment) => !roomEquipment.includes(equipment),
  );

  return (
    <div className="room-suitability">
      <div className="room-suitability-header">
          <strong>Room: {roomName}</strong>

          <button
            type="button"
            className="room-suitability-link">
            Open room data ↗
          </button>
       </div>

      <div className="room-suitability-section">
        <span className="room-suitability-label">
          Capacity
        </span>

        <div className="room-suitability-capacity">
          <div>
            <span>Room</span>
            <strong>{roomCapacity} seats</strong>
          </div>

          <div>
            <span>Required</span>
            <strong>{studentCount} seats</strong>
          </div>
        </div>

        <div
          className={
            capacityOk
              ? "room-suitability-result is-ok"
              : "room-suitability-result is-conflict"
          }
        >
          {capacityOk
            ? "✓ Sufficient capacity"
            : `✕ ${studentCount - roomCapacity} seats short`}
        </div>
      </div>

      <div className="room-suitability-section">
        <span className="room-suitability-label">
          Equipment
        </span>

        <div className="room-suitability-equipment">
          {requiredEquipment.map((equipment) => {
            const available =
              roomEquipment.includes(equipment);

            return (
              <div
                key={equipment}
                className="room-suitability-equipment-row"
              >
                <span>{equipment}</span>

                <span
                  className={
                    available
                      ? "room-suitability-equipment-status is-ok"
                      : "room-suitability-equipment-status is-missing"
                  }
                >
                  {available ? "✓ Available" : "✕ Missing"}
                </span>
              </div>
            );
          })}
        </div>

        {requiredEquipment.length === 0 && (
          <div className="room-suitability-result is-ok">
            No special equipment required
          </div>
        )}

        {requiredEquipment.length > 0 &&
          missingEquipment.length === 0 && (
            <div className="room-suitability-result is-ok">
              ✓ All required equipment available
            </div>
          )}
      </div>
    </div>
  );
}