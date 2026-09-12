import "./RoomSuitability.css";

type RoomSuitabilityProps = {
  roomName: string;
  roomCapacity: number;
  roomEquipment: string[];
  studentCount: number;
  requiredEquipment: string[];
};

export function RoomSuitability({
  roomName,
  roomCapacity,
  roomEquipment,
  studentCount,
  requiredEquipment,
}: RoomSuitabilityProps) {

  const capacityOk = roomCapacity >= studentCount;

  const missingEquipment = requiredEquipment.filter(
    (equipment) => !roomEquipment.includes(equipment),
  );

  return (
    <div>
      {/* UI here */}
    </div>
  );
}