import mqtt from "mqtt";
import { mqttHost, mqttPort, mqttProtocol, mqttUsername, mqttPassword, mqttRejectUnauthorized, mqttTopic } from "./config.js";
import { RehauConnection, RehauOperationStatus, EMPTY_TEMP_VALUE } from "./RehauData.js";
import { TOPIC_TEMPERATURE_COMMAND, TOPIC_MODE_COMMAND, TOPIC_PRESET_COMMAND, parseRoomTopic } from "./mqttDiscovery.js";
import { log } from "./logger.js";

export function startMqttClient(connection: RehauConnection): () => void {
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
        const room = connection.data.rooms.find(r => r.id === roomId);
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
                    default: room.mode = RehauOperationStatus.Normal;  break;
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

    return () => client.end();
}
