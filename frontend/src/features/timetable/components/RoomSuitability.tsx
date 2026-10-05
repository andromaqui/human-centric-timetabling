import "./RoomSuitability.css";

type RoomSuitabilityProps = {
  roomName: string;
  roomCapacity: number;
  roomEquipment?: string[];
  studentCount: number;
  requiredEquipment?: string[];

  // Which room constraint(s) actually caused this failure?
  capacityViolated?: boolean;
  equipmentViolated?: boolean;
};

const CAPACITY_DOT_COUNT = 20;

export function RoomSuitability({
  roomName,
  roomCapacity,
  roomEquipment = [],
  studentCount,
  requiredEquipment = [],
  capacityViolated = false,
  equipmentViolated = false,
}: RoomSuitabilityProps) {
  const capacityOk = roomCapacity >= studentCount;
  const seatDifference = roomCapacity - studentCount;

  const missingEquipment = requiredEquipment.filter(
    (equipment) => !roomEquipment.includes(equipment),
  );

  const bothViolated =
    capacityViolated && equipmentViolated;

  const requiredRatio =
    roomCapacity > 0
      ? studentCount / roomCapacity
      : 0;

  const requiredDots =
    studentCount > 0
      ? Math.min(
          CAPACITY_DOT_COUNT,
          Math.max(
            1,
            Math.ceil(
              requiredRatio * CAPACITY_DOT_COUNT,
            ),
          ),
        )
      : 0;

  function renderCapacityDetail() {
    return (
      <div className="room-suitability-section">
        <span className="room-suitability-label">
          Capacity
        </span>

        <div className="room-suitability-capacity-summary">
          <div>
            <span>Room</span>
            <strong>{roomCapacity} seats</strong>
          </div>

          <div>
            <span>Required</span>
            <strong>{studentCount} seats</strong>
          </div>
        </div>

        <div className="room-suitability-capacity-visual">
          <div
            className="room-suitability-capacity-dots"
            aria-hidden="true"
          >
            {Array.from(
              { length: CAPACITY_DOT_COUNT },
              (_, index) => {
                const isRequired =
                  index < requiredDots;

                return (
                  <span
                    key={index}
                    className={[
                      "room-suitability-capacity-dot",
                      isRequired
                        ? capacityOk
                          ? "is-required"
                          : "is-over-capacity"
                        : "is-free",
                    ].join(" ")}
                  />
                );
              },
            )}
          </div>

          <div className="room-suitability-capacity-caption">
            <strong>
              {studentCount} required
            </strong>
            <span>
              {" "}
              / {roomCapacity} available
            </span>
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
            ? seatDifference === 0
              ? "✓ Exact capacity"
              : `✓ ${seatDifference} seats spare`
            : `✕ ${Math.abs(
                seatDifference,
              )} seats short`}
        </div>
      </div>
    );
  }

  function renderEquipmentDetail() {
    return (
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
                  {available
                    ? "✓ Available"
                    : "✕ Missing"}
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

        {missingEquipment.length > 0 && (
          <div className="room-suitability-result is-conflict">
            ✕ Missing {missingEquipment.length} required{" "}
            {missingEquipment.length === 1
              ? "item"
              : "items"}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="room-suitability">
      <div className="room-suitability-header">
        <strong>Room: {roomName}</strong>

        <button
          type="button"
          className="room-suitability-link"
        >
          Open room data ↗
        </button>
      </div>

      {/* BOTH constraints failed */}
      {bothViolated && (
        <div className="room-suitability-body">
          {renderCapacityDetail()}
          {renderEquipmentDetail()}
        </div>
      )}

      {/* CAPACITY is the actual problem */}
      {capacityViolated && !equipmentViolated && (
        <>
          <div className="room-suitability-body room-suitability-body--single">
            {renderCapacityDetail()}
          </div>

          <div className="room-suitability-secondary-check">
            <span className="is-ok">
              ✓ Equipment requirements satisfied
            </span>
          </div>
        </>
      )}

      {/* EQUIPMENT is the actual problem */}
      {equipmentViolated && !capacityViolated && (
        <>
          <div className="room-suitability-body room-suitability-body--single">
            {renderEquipmentDetail()}
          </div>

          <div className="room-suitability-secondary-check">
            <span className="is-ok">
              ✓ Capacity suitable
            </span>

            <span>
              {roomCapacity} seats available ·{" "}
              {studentCount} required
            </span>
          </div>
        </>
      )}

      {/* Fallback if no violation type was supplied */}
      {!capacityViolated && !equipmentViolated && (
        <div className="room-suitability-body">
          {renderCapacityDetail()}
          {renderEquipmentDetail()}
        </div>
      )}
    </div>
  );
}