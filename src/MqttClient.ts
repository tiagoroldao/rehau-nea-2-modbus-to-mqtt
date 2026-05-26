import mqtt from "mqtt";
import { mqttHost, mqttPort, mqttProtocol, mqttUsername, mqttPassword, mqttRejectUnauthorized, mqttTopic } from "./config.js";
import { RehauConnection, RehauOperationStatus, RehauRoom, RoomUpdate, EMPTY_TEMP_VALUE, EMPTY_HUMIDITY_VALUE } from "./RehauData.js";
import {
    TOPIC_TEMPERATURE_COMMAND, TOPIC_MODE_COMMAND, TOPIC_PRESET_COMMAND,
    TOPIC_CURRENT_TEMPERATURE, TOPIC_TARGET_TEMPERATURE, TOPIC_CURRENT_HUMIDITY,
    TOPIC_MODE, TOPIC_PRESET, TOPIC_AVAILABILITY, TOPIC_CONFIG,
    parseRoomTopic, getRoomBaseTopic, createRoomMqttConfig,
} from "./mqttDiscovery.js";
import { log } from "./logger.js";

function roomModeToHaMode(mode: RehauOperationStatus): string {
    switch (mode) {
        case RehauOperationStatus.Standby:
        case RehauOperationStatus.HolidayAbsence:
            return "off";
        case RehauOperationStatus.Timed:
            return "auto";
        default:
            return "heat";
    }
}

function publishRoom(client: mqtt.MqttClient, update: RoomUpdate, connection: RehauConnection): void {
    const room = connection.data.rooms.find(r => r.id === update.roomId);
    if (!room) return;

    const base = getRoomBaseTopic(room, connection);

    switch (update.kind) {
        case 'created':
            client.publish(`${base}/${TOPIC_CONFIG}`, JSON.stringify(createRoomMqttConfig(room, connection)), { retain: true });
            client.publish(`${base}/${TOPIC_AVAILABILITY}`, "online", { retain: true });
            break;
        case 'temperature':
            if (room.temperature !== EMPTY_TEMP_VALUE)
                client.publish(`${base}/${TOPIC_CURRENT_TEMPERATURE}`, room.temperature.toFixed(1));
            break;
        case 'setpoint':
            if (room.setpoint !== EMPTY_TEMP_VALUE)
                client.publish(`${base}/${TOPIC_TARGET_TEMPERATURE}`, room.setpoint.toFixed(1));
            break;
        case 'humidity':
            if (room.humidity !== EMPTY_HUMIDITY_VALUE)
                client.publish(`${base}/${TOPIC_CURRENT_HUMIDITY}`, room.humidity.toString());
            break;
        case 'mode':
            if (room.mode !== RehauOperationStatus.Null) {
                client.publish(`${base}/${TOPIC_MODE}`,   roomModeToHaMode(room.mode));
                client.publish(`${base}/${TOPIC_PRESET}`, RehauOperationStatus[room.mode]);
            }
            break;
    }
}

export function startMqttClient(connection: RehauConnection): { stop: () => void; onRoomUpdate: (update: RoomUpdate) => void } {
    const opts: mqtt.IClientOptions = {
        host: mqttHost,
        port: mqttPort,
        protocol: mqttProtocol,
        rejectUnauthorized: mqttRejectUnauthorized,
    };
    if (mqttUsername) opts.username = mqttUsername;
    if (mqttPassword) opts.password = mqttPassword;

    const client = mqtt.connect(opts);

    client.on("connect", () => {
        log("MQTT connected");
        client.subscribe(`${mqttTopic}/#`, (err) => {
            if (err) console.error("MQTT subscribe error:", err);
        });
    });

    client.on("message", (topic, message) => {
        const parsed = parseRoomTopic(topic, connection);
        if (!parsed) return;

        const { roomId, subtopic } = parsed;
        const room = connection.data.rooms.find((r: RehauRoom) => r.id === roomId);
        if (!room) return;

        const payload = message.toString();

        switch (subtopic) {
            case TOPIC_TEMPERATURE_COMMAND: {
                if (room.setpoint === EMPTY_TEMP_VALUE) return;
                const temp = parseFloat(payload);
                if (!isNaN(temp)) room.setpoint = temp;
                break;
            }
            case TOPIC_MODE_COMMAND: {
                if (room.mode === RehauOperationStatus.Null) return;
                switch (payload) {
                    case "off":  room.mode = RehauOperationStatus.Standby; break;
                    default:     room.mode = RehauOperationStatus.Normal;  break;
                }
                break;
            }
            case TOPIC_PRESET_COMMAND: {
                if (room.mode === RehauOperationStatus.Null) return;
                const status = RehauOperationStatus[payload as keyof typeof RehauOperationStatus];
                if (status !== undefined) room.mode = status;
                break;
            }
        }
    });

    client.on("error", (err) => console.error("MQTT error:", err));

    return {
        stop: () => client.end(),
        onRoomUpdate: (update) => publishRoom(client, update, connection),
    };
}
