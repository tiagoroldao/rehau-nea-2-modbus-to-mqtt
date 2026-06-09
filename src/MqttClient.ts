import mqtt from "mqtt";
import {
  mqttHost,
  mqttPort,
  mqttProtocol,
  mqttUsername,
  mqttPassword,
  mqttTopic,
  logger,
} from "./config";
import {
  type RehauConnection,
  RehauOperationStatus,
  type RehauRoom,
  type RehauUpdate,
  EMPTY_TEMP_VALUE,
  EMPTY_HUMIDITY_VALUE,
  isSystemCooling,
  RehauGlobalOperationMode,
  type RehauRoomUpdate,
  type RehauGlobalUpdate,
  isRoomUpdate,
} from "./RehauData";
import {
  TOPIC_TEMPERATURE_COMMAND,
  TOPIC_MODE_COMMAND,
  TOPIC_PRESET_COMMAND,
  TOPIC_CURRENT_TEMPERATURE,
  TOPIC_TARGET_TEMPERATURE,
  TOPIC_CURRENT_HUMIDITY,
  TOPIC_MODE,
  TOPIC_PRESET,
  TOPIC_AVAILABILITY,
  TOPIC_CONFIG,
  parseRoomTopic,
  getRoomTopic,
  createRoomMqttConfig,
  TOPIC_STATE,
  createRoomHumiditySensorMqttConfig,
  createRoomTempSensorMqttConfig,
  getGlobalAvailabilityTopic,
  getGlobalTopic,
  createOutsideTemperatureSensorConfig,
  createOperationModeSelectConfig,
  createGlobalOperatingStatusSelectConfig,
  TOPIC_COMMAND,
} from "./mqttDiscovery";

function roomModeToHaMode(mode: RehauOperationStatus): string {
  switch (mode) {
    case RehauOperationStatus.Standby:
    case RehauOperationStatus.Holiday:
      return "off";
    case RehauOperationStatus.Timed:
      return "auto";
    default:
      return "heat";
  }
}

function publishGlobalUpdate(
  client: mqtt.MqttClient,
  update: RehauGlobalUpdate,
  connection: RehauConnection,
): void {
  switch (update.kind) {
    case "globalMode":
      if (connection.data.globalMode !== RehauGlobalOperationMode.Null) {
        client.publish(
          `${getGlobalTopic(connection, "operationMode")}/${TOPIC_STATE}`,
          RehauGlobalOperationMode[connection.data.globalMode],
          { retain: true },
        );

        for (const room of connection.data.rooms) {
          publishRoomUpdate(client, { kind: "config", roomId: room.id }, connection);
          publishRoomUpdate(client, { kind: "mode", roomId: room.id }, connection);
        }
      }
      break;
    case "globalOperationStatus":
      if (connection.data.globalOperationStatus !== RehauOperationStatus.Null) {
        client.publish(
          `${getGlobalTopic(connection, "operationStatus")}/${TOPIC_STATE}`,
          RehauOperationStatus[connection.data.globalOperationStatus],
          { retain: true },
        );
      }
      break;
    case "outsideTemperature":
      if (connection.data.outsideTemperature !== EMPTY_TEMP_VALUE) {
        client.publish(
          `${getGlobalTopic(connection, "outsideTemperature")}/${TOPIC_STATE}`,
          connection.data.outsideTemperature.toFixed(1),
        );
      }
      break;
    case "onlineState":
      client.publish(getGlobalAvailabilityTopic(connection), connection.data.online ? "online" : "offline", {
        retain: true,
      });
      if (!connection.data.online) {
        for (const room of connection.data.rooms) {
          client.publish(`${getRoomTopic(room.id, connection)}/${TOPIC_AVAILABILITY}`, "offline", {
            retain: true,
          });
        }
      }
      break;
  }
}

function publishRoomUpdate(
  client: mqtt.MqttClient,
  update: RehauRoomUpdate,
  connection: RehauConnection,
): void {
  const room = connection.data.rooms.find(
    (r) => Object.hasOwn(update, "roomId") && r.id === update.roomId,
  );
  if (!room) return;

  const base = getRoomTopic(room.id, connection);

  switch (update.kind) {
    case "config":
      const info = JSON.stringify(createRoomMqttConfig(room, connection));
      logger.debug("Publishing MQTT room info for room %s: %o", room.id, info);
      client.publish(`${base}/${TOPIC_CONFIG}`, info, { retain: true });
      client.publish(
        `${getRoomTopic(room.id, connection, "temperature")}/${TOPIC_CONFIG}`,
        JSON.stringify(createRoomTempSensorMqttConfig(room, connection)),
        { retain: true },
      );
      client.publish(
        `${getRoomTopic(room.id, connection, "humidity")}/${TOPIC_CONFIG}`,
        JSON.stringify(createRoomHumiditySensorMqttConfig(room, connection)),
        { retain: true },
      );
      client.publish(`${base}/${TOPIC_AVAILABILITY}`, "online", {
        retain: true,
      });
      break;
    case "temperature":
      if (room.temperature !== EMPTY_TEMP_VALUE) {
        logger.debug(
          "Publishing MQTT room temperature for room %s: %s",
          room.id,
          room.temperature,
        );
        client.publish(
          `${getRoomTopic(room.id, connection, "temperature")}/${TOPIC_STATE}`,
          room.temperature.toFixed(1),
        );
        client.publish(
          `${base}/${TOPIC_CURRENT_TEMPERATURE}`,
          room.temperature.toFixed(1),
        );
      }
      break;
    case "setpoint":
      if (room.setpoint !== EMPTY_TEMP_VALUE) {
        logger.debug(
          "Publishing MQTT room setpoint for room %s: %s",
          room.id,
          room.temperature,
        );
        client.publish(
          `${base}/${TOPIC_TARGET_TEMPERATURE}`,
          room.setpoint.toFixed(1),
        );
      }
      break;
    case "humidity":
      if (room.humidity !== EMPTY_HUMIDITY_VALUE) {
        logger.debug(
          "Publishing MQTT room humidity for room %s: %s",
          room.id,
          room.humidity,
        );
        client.publish(
          `${getRoomTopic(room.id, connection, "humidity")}/${TOPIC_STATE}`,
          room.humidity.toFixed(1),
        );
        client.publish(
          `${base}/${TOPIC_CURRENT_HUMIDITY}`,
          room.humidity.toString(),
        );
      }
      break;
    case "mode":
      if (room.mode !== RehauOperationStatus.Null) {
        let mode = "off";

        if (room.mode !== RehauOperationStatus.Standby) {
          mode = isSystemCooling(connection.data) ? "cool" : "heat";
        }
        logger.debug(
          "Publishing MQTT mode for room %s: %s",
          room.id,
          RehauOperationStatus[room.mode],
        );
        client.publish(`${base}/${TOPIC_MODE}`, mode);
        client.publish(
          `${base}/${TOPIC_PRESET}`,
          RehauOperationStatus[room.mode],
        );
      }
      break;
  }
}

function publishUpdate(
  client: mqtt.MqttClient,
  update: RehauUpdate,
  connection: RehauConnection,
): void {
  if (isRoomUpdate(update)) {
    publishRoomUpdate(client, update, connection);
  } else {
    publishGlobalUpdate(client, update, connection);
  }
}

export function startMqttClient(connection: RehauConnection): {
  stop: () => void;
  onUpdate: (update: RehauUpdate) => void;
} {
  const opts: mqtt.IClientOptions = {
    host: mqttHost,
    port: mqttPort,
    protocol: mqttProtocol,
  };
  if (mqttUsername) opts.username = mqttUsername;
  if (mqttPassword) opts.password = mqttPassword;

  const client = mqtt.connect(opts);

  client.on("connect", () => {
    logger.info("MQTT connected");
    client.subscribe(`${mqttTopic}/climate/#`, (err) => {
      if (err) logger.error("MQTT subscribe error: %s", err.message);
    });
    client.subscribe(`${getGlobalTopic(connection, "operationMode")}/${TOPIC_COMMAND}`, (err) => {
      if (err) logger.error("MQTT subscribe error: %s", err.message);
    });
    client.subscribe(`${getGlobalTopic(connection, "operationStatus")}/${TOPIC_COMMAND}`, (err) => {
      if (err) logger.error("MQTT subscribe error: %s", err.message);
    });

    client.publish(
      `${getGlobalTopic(connection, "outsideTemperature")}/${TOPIC_CONFIG}`,
      JSON.stringify(createOutsideTemperatureSensorConfig(connection)),
      { retain: true },
    );
    client.publish(
      `${getGlobalTopic(connection, "operationMode")}/${TOPIC_CONFIG}`,
      JSON.stringify(createOperationModeSelectConfig(connection)),
      { retain: true },
    );
    client.publish(
      `${getGlobalTopic(connection, "operationStatus")}/${TOPIC_CONFIG}`,
      JSON.stringify(createGlobalOperatingStatusSelectConfig(connection)),
      { retain: true },
    );
    client.publish(getGlobalAvailabilityTopic(connection), "online", {
      retain: true,
    });
  });

  client.on("message", (topic, message) => {
    if (topic === `${getGlobalTopic(connection, "operationMode")}/${TOPIC_COMMAND}`) {
      connection.data.globalMode = RehauGlobalOperationMode[message.toString() as keyof typeof RehauGlobalOperationMode] ?? connection.data.globalMode;
      return;
    } else if (topic === `${getGlobalTopic(connection, "operationStatus")}/${TOPIC_COMMAND}`) {
      connection.data.globalOperationStatus = RehauOperationStatus[message.toString() as keyof typeof RehauOperationStatus] ?? connection.data.globalOperationStatus;
      return;
    } 
    const parsed = parseRoomTopic(topic, connection);
    if (!parsed) return;
    const { roomId, subtopic } = parsed;
    const room = connection.data.rooms.find((r: RehauRoom) => r.id === roomId);
    if (!room) {
      const base = getRoomTopic(roomId, connection);
      client.publish(`${base}/${TOPIC_AVAILABILITY}`, "offline", {
        retain: true,
      });
      return;
    }

    const payload = message.toString();

    switch (subtopic) {
      case TOPIC_TEMPERATURE_COMMAND: {
        if (room.setpoint === EMPTY_TEMP_VALUE) return;
        const temp = parseFloat(payload);
        if (!isNaN(temp)) {
          room.setpoint = temp;
        }
        break;
      }
      case TOPIC_MODE_COMMAND: {
        if (room.mode === RehauOperationStatus.Null) return;
        switch (payload) {
          case "off":
            room.mode = RehauOperationStatus.Standby;
            break;
          default:
            room.mode = RehauOperationStatus.Normal;
            break;
        }
        break;
      }
      case TOPIC_PRESET_COMMAND: {
        if (room.mode === RehauOperationStatus.Null) return;
        const status =
          RehauOperationStatus[payload as keyof typeof RehauOperationStatus];
        if (status !== undefined) room.mode = status;
        break;
      }
    }
  });

  client.on("error", (err) => logger.error("MQTT error: %o", err));

  return {
    stop: () => {
      client.publish(getGlobalAvailabilityTopic(connection), "offline", {
        retain: true,
      });
      client.end();
    },
    onUpdate: (update) => publishUpdate(client, update, connection),
  };
}
