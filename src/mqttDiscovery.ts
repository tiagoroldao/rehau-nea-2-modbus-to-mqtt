import { mqttTopic } from "./config.js";
import { RehauConnection, RehauRoom } from "./RehauData.js";

export const TOPIC_CURRENT_TEMPERATURE  = "current_temperature";
export const TOPIC_TARGET_TEMPERATURE   = "target_temperature";
export const TOPIC_TEMPERATURE_COMMAND  = "temperature_command";
export const TOPIC_CURRENT_HUMIDITY     = "current_humidity";
export const TOPIC_MODE                 = "mode";
export const TOPIC_MODE_COMMAND         = "mode_command";
export const TOPIC_PRESET               = "preset";
export const TOPIC_PRESET_COMMAND       = "preset_command";
export const TOPIC_AVAILABILITY         = "availability";
export const TOPIC_CONFIG               = "config";

export function getRoomBaseTopic(room: RehauRoom, connection: RehauConnection): string {
    return `${mqttTopic}/${connection.mqttPrefix}_room_${room.id}`;
}

export interface RoomMqttConfig {
  name: string;
  unique_id: string;
  object_id: string;
  device: {
    identifiers: string[];
    manufacturer: string;
    model: string;
  };
  current_temperature_topic: string;
  temperature_state_topic: string;
  temperature_command_topic: string;
  current_humidity_topic: string;
  mode_state_topic: string;
  mode_command_topic: string;
  modes: string[];
  preset_mode_state_topic: string;
  preset_mode_command_topic: string;
  preset_modes: string[];
  availability_topic: string;
  payload_available: "online";
  payload_not_available: "offline";
  temperature_unit: "C" | "F";
  temp_step: number;
  min_temp: number;
  max_temp: number;
  precision: number;
  optimistic: boolean;
}

export function parseRoomTopic(topic: string, connection: RehauConnection): { roomId: number; subtopic: string } | null {
    const prefix = `${mqttTopic}/${connection.mqttPrefix}_room_`;
    if (!topic.startsWith(prefix)) return null;

    const rest = topic.slice(prefix.length);
    const slashIdx = rest.indexOf("/");
    if (slashIdx === -1) return null;

    const roomId = parseInt(rest.slice(0, slashIdx), 10);
    if (isNaN(roomId)) return null;

    return { roomId, subtopic: rest.slice(slashIdx + 1) };
}

export function createRoomMqttConfig(
  room: RehauRoom,
  connection: RehauConnection,
): RoomMqttConfig {
  const entityId = `${connection.mqttPrefix}_room_${room.id}`;
  const baseTopic = getRoomBaseTopic(room, connection);

  return {
    name: `Room ${room.id}`,
    unique_id: entityId,
    object_id: entityId,
    device: {
      identifiers: [connection.mqttPrefix],
      manufacturer: "REHAU",
      model: "NEA SMART 2.0",
    },
    current_temperature_topic: `${baseTopic}/${TOPIC_CURRENT_TEMPERATURE}`,
    temperature_state_topic:   `${baseTopic}/${TOPIC_TARGET_TEMPERATURE}`,
    temperature_command_topic: `${baseTopic}/${TOPIC_TEMPERATURE_COMMAND}`,
    current_humidity_topic:    `${baseTopic}/${TOPIC_CURRENT_HUMIDITY}`,
    mode_state_topic:          `${baseTopic}/${TOPIC_MODE}`,
    mode_command_topic:        `${baseTopic}/${TOPIC_MODE_COMMAND}`,
    modes: ["off", "auto", "heat"],
    preset_mode_state_topic:   `${baseTopic}/${TOPIC_PRESET}`,
    preset_mode_command_topic: `${baseTopic}/${TOPIC_PRESET_COMMAND}`,
    preset_modes: [
      "Normal",
      "Reduced",
      "Standby",
      "Timed",
      "Party",
      "HolidayAbsence",
    ],
    availability_topic:        `${baseTopic}/${TOPIC_AVAILABILITY}`,
    payload_available: "online",
    payload_not_available: "offline",
    temperature_unit: "C",
    temp_step: 0.5,
    min_temp: 5,
    max_temp: 30,
    precision: 0.1,
    optimistic: true,
  };
}
