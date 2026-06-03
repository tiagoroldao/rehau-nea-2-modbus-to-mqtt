import { mqttTopic } from "./config";
import { MAX_SETPOINT_CELCIUS, MIN_SETPOINT_CELCIUS } from "./modbusConstants";
import {
  isSystemCooling,
  type RehauConnection,
  type RehauRoom,
} from "./RehauData";

export const TOPIC_STATE = "state";
export const TOPIC_CURRENT_TEMPERATURE = "current_temperature";
export const TOPIC_TARGET_TEMPERATURE = "target_temperature";
export const TOPIC_TEMPERATURE_COMMAND = "temperature_command";
export const TOPIC_CURRENT_HUMIDITY = "current_humidity";
export const TOPIC_MODE = "mode";
export const TOPIC_MODE_COMMAND = "mode_command";
export const TOPIC_PRESET = "preset";
export const TOPIC_PRESET_COMMAND = "preset_command";
export const TOPIC_AVAILABILITY = "availability";
export const TOPIC_CONFIG = "config";

export function getRoomTopic(
  roomId: number | string,
  connection: Pick<RehauConnection, "installationSlug">,
  type: "climate" | "temperature" | "humidity" = "climate",
): string {
  return `${mqttTopic}/${type === "climate" ? "climate" : "sensor"}/${connection.installationSlug}_room_${roomId}_${type === "climate" ? "" : type}`;
}

export function parseRoomTopic(
  topic: string,
  connection: RehauConnection,
): { roomId: number; subtopic: string } | null {
  const prefix = getRoomTopic("", connection);
  if (!topic.startsWith(prefix)) return null;

  const rest = topic.slice(prefix.length);
  const slashIdx = rest.indexOf("/");
  if (slashIdx === -1) return null;

  const roomId = parseInt(rest.slice(0, slashIdx), 10);
  if (isNaN(roomId)) return null;

  return { roomId, subtopic: rest.slice(slashIdx + 1) };
}

function deviceData(connection: RehauConnection) {
  return {
    identifiers: [connection.installationSlug],
    manufacturer: "REHAU",
    model: "Nea Smart 2.0",
    name: connection.installationName,
  };
}

export function createRoomMqttConfig(
  room: RehauRoom,
  connection: RehauConnection,
): Record<string, unknown> {
  const entityId = `${connection.installationSlug}_room_${room.id}`;
  const baseTopic = getRoomTopic(room.id, connection);

  return {
    name: `Room ${room.id}`,
    unique_id: entityId,
    default_entity_id: `climate.${entityId}`,
    object_id: entityId,
    device: deviceData(connection),
    origin: {
      name: "REHAU Modbus-to-MQTT",
    },
    current_temperature_topic: `${baseTopic}/${TOPIC_CURRENT_TEMPERATURE}`,
    temperature_state_topic: `${baseTopic}/${TOPIC_TARGET_TEMPERATURE}`,
    temperature_command_topic: `${baseTopic}/${TOPIC_TEMPERATURE_COMMAND}`,
    current_humidity_topic: `${baseTopic}/${TOPIC_CURRENT_HUMIDITY}`,
    mode_state_topic: `${baseTopic}/${TOPIC_MODE}`,
    mode_command_topic: `${baseTopic}/${TOPIC_MODE_COMMAND}`,
    modes: ["off", isSystemCooling(connection.data) ? "cool" : "heat"],
    preset_mode_state_topic: `${baseTopic}/${TOPIC_PRESET}`,
    preset_mode_command_topic: `${baseTopic}/${TOPIC_PRESET_COMMAND}`,
    preset_modes: [
      "Normal",
      "Reduced",
      "Standby",
      "Timed",
      "Party",
      "HolidayAbsence",
    ],
    availability_topic: `${baseTopic}/${TOPIC_AVAILABILITY}`,
    payload_available: "online",
    payload_not_available: "offline",
    temperature_unit: "C",
    temp_step: 0.5,
    min_temp: MIN_SETPOINT_CELCIUS,
    max_temp: MAX_SETPOINT_CELCIUS,
    precision: 0.1,
    optimistic: true,
  };
}

export function createRoomTempSensorMqttConfig(
  room: RehauRoom,
  connection: RehauConnection,
): Record<string, unknown> {
  const entityId = `${connection.installationName}_room_${room.id}_temperature`;
  const baseTopic = getRoomTopic(room.id, connection, "temperature");
  const baseRoomTopic = getRoomTopic(room.id, connection);

  return {
    name: `Room ${room.id} Temperature`,
    unique_id: entityId,
    default_entity_id: `sensor.${entityId}}`,
    state_topic: `${baseTopic}/${TOPIC_STATE}`,
    object_id: entityId,
    device: deviceData(connection),
    availability_topic: `${baseRoomTopic}/${TOPIC_AVAILABILITY}`,
    payload_available: "online",
    payload_not_available: "offline",
    unit_of_measurement: "°C",
    device_class: "temperature",
    state_class: "measurement",
  };
}

export function createRoomHumiditySensorMqttConfig(
  room: RehauRoom,
  connection: RehauConnection,
): Record<string, unknown> {
  const entityId = `${connection.installationName}_room_${room.id}_humidity`;
  const baseTopic = getRoomTopic(room.id, connection, "humidity");
  const baseRoomTopic = getRoomTopic(room.id, connection);

  return {
    name: `Room ${room.id} Humidity`,
    unique_id: entityId,
    default_entity_id: `sensor.${entityId}}`,
    state_topic: `${baseTopic}/${TOPIC_STATE}`,
    object_id: entityId,
    device: deviceData(connection),
    availability_topic: `${baseRoomTopic}/${TOPIC_AVAILABILITY}`,
    payload_available: "online",
    payload_not_available: "offline",
    state_class: "measurement",
    unit_of_measurement: "%",
    device_class: "humidity",
  };
}
