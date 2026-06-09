// src/config.ts
import { z } from "zod";
import pino from "pino";
var configSchema = z.object({
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  MODBUS_UNIT_ID: z.coerce.number().int().default(240),
  MQTT_HOST: z.string(),
  MQTT_PORT: z.coerce.number().int().min(1).max(65535),
  MQTT_PROTOCOL: z.enum(["mqtt", "mqtts", "ws", "wss"]).default("mqtt"),
  MQTT_USERNAME: z.string().default(""),
  MQTT_PASSWORD: z.string().default(""),
  INSTALLATION_NAME: z.string().default("home-climate"),
  MQTT_TOPIC: z.string().default("homeassistant")
});
var parsed = configSchema.parse(process.env);
var modbusHost = "0.0.0.0";
var modbusPort = 502;
var unitNumber = parsed.MODBUS_UNIT_ID;
var logLevel = parsed.LOG_LEVEL;
var mqttHost = parsed.MQTT_HOST;
var mqttPort = parsed.MQTT_PORT;
var mqttProtocol = parsed.MQTT_PROTOCOL;
var mqttUsername = parsed.MQTT_USERNAME;
var mqttPassword = parsed.MQTT_PASSWORD;
var installationName = parsed.INSTALLATION_NAME;
var mqttTopic = parsed.MQTT_TOPIC;
var logger = pino({ level: logLevel, transport: { target: "pino-pretty" } });
logger.info("configuration: %o", parsed);

// src/RehauData.ts
var EMPTY_TEMP_VALUE = 0;
var EMPTY_HUMIDITY_VALUE = 0;
var RehauGlobalOperationMode = /* @__PURE__ */ ((RehauGlobalOperationMode2) => {
  RehauGlobalOperationMode2[RehauGlobalOperationMode2["Null"] = 10] = "Null";
  RehauGlobalOperationMode2[RehauGlobalOperationMode2["Auto"] = 1] = "Auto";
  RehauGlobalOperationMode2[RehauGlobalOperationMode2["Heating"] = 2] = "Heating";
  RehauGlobalOperationMode2[RehauGlobalOperationMode2["Cooling"] = 3] = "Cooling";
  RehauGlobalOperationMode2[RehauGlobalOperationMode2["ManualHeating"] = 4] = "ManualHeating";
  RehauGlobalOperationMode2[RehauGlobalOperationMode2["ManualCooling"] = 5] = "ManualCooling";
  return RehauGlobalOperationMode2;
})(RehauGlobalOperationMode || {});
var RehauOperationStatus = /* @__PURE__ */ ((RehauOperationStatus2) => {
  RehauOperationStatus2[RehauOperationStatus2["Null"] = 10] = "Null";
  RehauOperationStatus2[RehauOperationStatus2["Mixed"] = 0] = "Mixed";
  RehauOperationStatus2[RehauOperationStatus2["Normal"] = 1] = "Normal";
  RehauOperationStatus2[RehauOperationStatus2["Reduced"] = 2] = "Reduced";
  RehauOperationStatus2[RehauOperationStatus2["Standby"] = 3] = "Standby";
  RehauOperationStatus2[RehauOperationStatus2["Timed"] = 4] = "Timed";
  RehauOperationStatus2[RehauOperationStatus2["Party"] = 5] = "Party";
  RehauOperationStatus2[RehauOperationStatus2["Holiday"] = 6] = "Holiday";
  return RehauOperationStatus2;
})(RehauOperationStatus || {});
function isSystemCooling(data) {
  return data.globalMode === 3 /* Cooling */ || data.globalMode === 5 /* ManualCooling */;
}
function createDefaultRoom(id) {
  return {
    id,
    mode: 10 /* Null */,
    setpoint: EMPTY_TEMP_VALUE,
    temperature: EMPTY_TEMP_VALUE,
    humidity: EMPTY_HUMIDITY_VALUE
  };
}
function isRoomUpdate(update) {
  return typeof update.roomId === "number";
}
function createDefaultData() {
  return {
    online: false,
    globalMode: 10 /* Null */,
    globalOperationStatus: 10 /* Null */,
    outsideTemperature: EMPTY_TEMP_VALUE,
    outsideTemperatureFiltered: EMPTY_TEMP_VALUE,
    rooms: []
  };
}

// src/ModbusServer.ts
import { ServerTCP } from "modbus-serial";

// src/dpt9001.ts
function dptValueToDecimal(value) {
  if (value > 2048) {
    value = (value - 2048) * 2;
  }
  return value / 100;
}
function decimalToDpt(value) {
  value = value * 100;
  if (value > 2048) {
    value = value / 2 + 2048;
  }
  return value;
}

// src/modbusConstants.ts
var REG_GLOBAL_OPERATION_MODE = 1;
var REG_GLOBAL_OPERATION_STATUS = 2;
var REG_OUTSIDE_TEMPERATURE = 7;
var REG_OUTSIDE_TEMP_FILTERED = 8;
var ROOM_BASE = 100;
var ROOM_OFFSET_STATUS = 0;
var ROOM_OFFSET_SETPOINT = 1;
var ROOM_OFFSET_TEMPERATURE = 2;
var ROOM_OFFSET_HUMIDITY = 10;
var MAX_SETPOINT_CELCIUS = 30;
var MIN_SETPOINT_CELCIUS = 5;
var CONNECTION_TIMEOUT_MS = 1e4;

// src/ModbusServer.ts
function setRegister(data, addr, value) {
  switch (addr) {
    case REG_GLOBAL_OPERATION_MODE:
      logger.debug(
        `ModbusTCP - global operation mode update: ${RehauGlobalOperationMode[value]} as ${value}`
      );
      data.globalMode = value;
      return [
        {
          kind: "globalMode"
        }
      ];
    case REG_GLOBAL_OPERATION_STATUS:
      logger.debug(
        `ModbusTCP - global operation status update: ${RehauOperationStatus[value]} as ${value}`
      );
      data.globalOperationStatus = value;
      return [
        {
          kind: "globalOperationStatus"
        }
      ];
    case REG_OUTSIDE_TEMPERATURE:
      logger.debug(
        `ModbusTCP - outside temperature update: ${dptValueToDecimal(value)} as ${value}`
      );
      data.outsideTemperature = dptValueToDecimal(value);
      return [
        {
          kind: "outsideTemperature"
        }
      ];
    case REG_OUTSIDE_TEMP_FILTERED:
      logger.debug(
        `ModbusTCP - outside temperature [filtered] update: ${dptValueToDecimal(value)} as ${value}`
      );
      data.outsideTemperatureFiltered = dptValueToDecimal(value);
      return [];
  }
  if (addr < ROOM_BASE) return [];
  const roomId = Math.floor(addr / ROOM_BASE);
  const offset = addr % ROOM_BASE;
  const isNew = !data.rooms.find((r) => r.id === roomId);
  let room = isNew ? createDefaultRoom(roomId) : data.rooms.find((r) => r.id === roomId);
  if (isNew) data.rooms.push(room);
  let fieldUpdate;
  switch (offset) {
    case ROOM_OFFSET_STATUS:
      logger.debug(
        `ModbusTCP - room nr. ${room.id} status update: ${RehauOperationStatus[room.mode]}`
      );
      room.mode = value;
      fieldUpdate = { kind: "mode", roomId };
      break;
    case ROOM_OFFSET_SETPOINT:
      let setpoint = dptValueToDecimal(value);
      if (setpoint > MAX_SETPOINT_CELCIUS || setpoint < MIN_SETPOINT_CELCIUS) {
        setpoint = 0;
      }
      logger.debug(
        `ModbusTCP - room nr. ${room.id} setpoint update: ${setpoint} as ${value}`
      );
      room.setpoint = setpoint;
      fieldUpdate = { kind: "setpoint", roomId };
      break;
    case ROOM_OFFSET_TEMPERATURE:
      logger.debug(
        `ModbusTCP - room nr. ${room.id} temperature update: ${dptValueToDecimal(value)} as ${value}`
      );
      room.temperature = dptValueToDecimal(value);
      fieldUpdate = { kind: "temperature", roomId };
      break;
    case ROOM_OFFSET_HUMIDITY:
      logger.debug(
        `ModbusTCP - room nr. ${room.id} humidity update: ${value}%`
      );
      room.humidity = value;
      fieldUpdate = { kind: "humidity", roomId };
      break;
    default:
      return [];
  }
  return isNew ? [{ kind: "config", roomId }, fieldUpdate] : [fieldUpdate];
}
function startModbusServer(connection2, host, port, onUpdate) {
  const { data, modbusAddress } = connection2;
  let lastDataReceived = Date.now();
  const connectionCheckInterval = setInterval(() => {
    if (Date.now() - lastDataReceived < CONNECTION_TIMEOUT_MS) return;
    logger.warn("No data received from Rehau system. Setting state as offline");
    connection2.data.online = false;
    onUpdate?.({ kind: "onlineState" });
  }, 1e3);
  const pingDataReceived = () => {
    lastDataReceived = Date.now();
    if (connection2.data.online) return;
    logger.info("Data received from Rehau system. Setting state as online");
    connection2.data.online = true;
    onUpdate?.({ kind: "onlineState" });
  };
  const vector = {
    getHoldingRegister(addr, unitID) {
      pingDataReceived();
      if (unitID !== modbusAddress) return 0;
      if (addr === REG_GLOBAL_OPERATION_MODE) {
        logger.debug(
          `ModbusTCP - responding with global operation mode: ${RehauGlobalOperationMode[data.globalMode]}`
        );
        return data.globalMode;
      }
      if (addr === REG_GLOBAL_OPERATION_STATUS) {
        logger.debug(
          `ModbusTCP - responding with global operation status: ${RehauOperationStatus[data.globalOperationStatus]}`
        );
        return data.globalOperationStatus;
      }
      if (addr < ROOM_BASE) return;
      const roomId = Math.floor(addr / ROOM_BASE);
      const offset = addr % ROOM_BASE;
      let room = data.rooms.find((r) => r.id === roomId);
      if (!room) return;
      switch (offset) {
        case ROOM_OFFSET_STATUS:
          logger.debug(
            `ModbusTCP - responding with room nr. ${room.id} operation status: ${RehauOperationStatus[room.mode]}`
          );
          return room.mode;
        case ROOM_OFFSET_SETPOINT:
          logger.debug(
            `ModbusTCP - responding with room nr. ${room.id} setpoint: ${room.setpoint} as ${decimalToDpt(room.setpoint)}`
          );
          return decimalToDpt(room.setpoint);
        default:
          return;
      }
    },
    setRegisterArray(addr, value, unitID) {
      pingDataReceived();
      if (unitID !== modbusAddress && unitID !== 0) return;
      value.forEach(
        (v, i) => setRegister(data, addr + i, v).forEach((u) => onUpdate?.(u))
      );
    }
  };
  logger.info(`ModbusTCP listening on modbus://${host}:${port}`);
  const server = new ServerTCP(vector, { host, port, debug: true });
  const cleanup = () => {
    clearInterval(connectionCheckInterval);
    server.close(() => logger.info("ModbusTCP closed"));
  };
  server.on("error", (err) => logger.error(err));
  server.on("serverError", (err) => logger.error(err));
  server.on("socketError", (err) => {
    logger.error(err);
    cleanup();
  });
  return () => cleanup();
}

// src/MqttClient.ts
import mqtt from "mqtt";

// src/mqttDiscovery.ts
var TOPIC_STATE = "state";
var TOPIC_CURRENT_TEMPERATURE = "current_temperature";
var TOPIC_TARGET_TEMPERATURE = "target_temperature";
var TOPIC_TEMPERATURE_COMMAND = "temperature_command";
var TOPIC_CURRENT_HUMIDITY = "current_humidity";
var TOPIC_MODE = "mode";
var TOPIC_MODE_COMMAND = "mode_command";
var TOPIC_COMMAND = "command";
var TOPIC_PRESET = "preset";
var TOPIC_PRESET_COMMAND = "preset_command";
var TOPIC_AVAILABILITY = "availability";
var TOPIC_CONFIG = "config";
function getRoomTopic(roomId, connection2, type = "climate") {
  return `${mqttTopic}/${type === "climate" ? "climate" : "sensor"}/${connection2.installationSlug}_room_${roomId}${type === "climate" ? "" : `_${type}`}`;
}
function getGlobalTopic(connection2, type) {
  const domain = type === "outsideTemperature" ? "sensor" : "select";
  return `${mqttTopic}/${domain}/${connection2.installationSlug}_${type}`;
}
function getGlobalAvailabilityTopic(connection2) {
  return `rehau2MQTT/${connection2.installationSlug}_availability`;
}
function parseRoomTopic(topic, connection2) {
  const prefix = getRoomTopic("", connection2);
  if (!topic.startsWith(prefix)) return null;
  const rest = topic.slice(prefix.length);
  const slashIdx = rest.indexOf("/");
  if (slashIdx === -1) return null;
  const roomId = parseInt(rest.slice(0, slashIdx), 10);
  if (isNaN(roomId)) return null;
  return { roomId, subtopic: rest.slice(slashIdx + 1) };
}
function deviceData(connection2) {
  return {
    identifiers: [connection2.installationSlug],
    manufacturer: "REHAU",
    model: "Nea Smart 2.0",
    name: connection2.installationName
  };
}
function createRoomMqttConfig(room, connection2) {
  const entityId = `${connection2.installationSlug}_room_${room.id}`;
  const baseTopic = getRoomTopic(room.id, connection2);
  return {
    name: `Room ${room.id}`,
    unique_id: entityId,
    default_entity_id: `climate.${entityId}`,
    object_id: entityId,
    device: deviceData(connection2),
    origin: {
      name: "REHAU Modbus-to-MQTT"
    },
    current_temperature_topic: `${baseTopic}/${TOPIC_CURRENT_TEMPERATURE}`,
    temperature_state_topic: `${baseTopic}/${TOPIC_TARGET_TEMPERATURE}`,
    temperature_command_topic: `${baseTopic}/${TOPIC_TEMPERATURE_COMMAND}`,
    current_humidity_topic: `${baseTopic}/${TOPIC_CURRENT_HUMIDITY}`,
    mode_state_topic: `${baseTopic}/${TOPIC_MODE}`,
    mode_command_topic: `${baseTopic}/${TOPIC_MODE_COMMAND}`,
    modes: ["off", isSystemCooling(connection2.data) ? "cool" : "heat"],
    preset_mode_state_topic: `${baseTopic}/${TOPIC_PRESET}`,
    preset_mode_command_topic: `${baseTopic}/${TOPIC_PRESET_COMMAND}`,
    preset_modes: [
      "Normal",
      "Reduced",
      "Standby",
      "Timed",
      "Party",
      "Holiday"
    ],
    availability_topic: `${baseTopic}/${TOPIC_AVAILABILITY}`,
    payload_available: "online",
    payload_not_available: "offline",
    temperature_unit: "C",
    temp_step: 0.5,
    min_temp: MIN_SETPOINT_CELCIUS,
    max_temp: MAX_SETPOINT_CELCIUS,
    precision: 0.1,
    optimistic: true
  };
}
function createRoomTempSensorMqttConfig(room, connection2) {
  const entityId = `${connection2.installationName}_room_${room.id}_temperature`;
  const baseTopic = getRoomTopic(room.id, connection2, "temperature");
  const baseRoomTopic = getRoomTopic(room.id, connection2);
  return {
    name: `Room ${room.id} Temperature`,
    unique_id: entityId,
    default_entity_id: `sensor.${entityId}}`,
    state_topic: `${baseTopic}/${TOPIC_STATE}`,
    object_id: entityId,
    device: deviceData(connection2),
    availability_topic: `${baseRoomTopic}/${TOPIC_AVAILABILITY}`,
    payload_available: "online",
    payload_not_available: "offline",
    unit_of_measurement: "\xB0C",
    device_class: "temperature",
    state_class: "measurement"
  };
}
function createRoomHumiditySensorMqttConfig(room, connection2) {
  const entityId = `${connection2.installationName}_room_${room.id}_humidity`;
  const baseTopic = getRoomTopic(room.id, connection2, "humidity");
  const baseRoomTopic = getRoomTopic(room.id, connection2);
  return {
    name: `Room ${room.id} Humidity`,
    unique_id: entityId,
    default_entity_id: `sensor.${entityId}}`,
    state_topic: `${baseTopic}/${TOPIC_STATE}`,
    object_id: entityId,
    device: deviceData(connection2),
    availability_topic: `${baseRoomTopic}/${TOPIC_AVAILABILITY}`,
    payload_available: "online",
    payload_not_available: "offline",
    state_class: "measurement",
    unit_of_measurement: "%",
    device_class: "humidity"
  };
}
function createOutsideTemperatureSensorConfig(connection2) {
  const entityId = `${connection2.installationName}_outsideTemperature`;
  const baseTopic = getGlobalTopic(connection2, "outsideTemperature");
  return {
    name: "Outside temperature",
    unique_id: entityId,
    state_topic: `${baseTopic}/${TOPIC_STATE}`,
    unit_of_measurement: "\xB0C",
    device_class: "temperature",
    state_class: "measurement",
    availability_topic: getGlobalAvailabilityTopic(connection2),
    payload_available: "online",
    payload_not_available: "offline",
    device: deviceData(connection2)
  };
}
function createOperationModeSelectConfig(connection2) {
  const entityId = `${connection2.installationName}_operationMode`;
  const baseTopic = getGlobalTopic(connection2, "operationMode");
  return {
    name: "Operation Mode",
    unique_id: entityId,
    state_topic: `${baseTopic}/${TOPIC_STATE}`,
    command_topic: `${baseTopic}/${TOPIC_COMMAND}`,
    options: [
      "Auto",
      "Heating",
      "Cooling",
      "ManualHeating",
      "ManualCooling"
    ],
    availability_topic: getGlobalAvailabilityTopic(connection2),
    payload_available: "online",
    payload_not_available: "offline",
    device: deviceData(connection2)
  };
}
function createGlobalOperatingStatusSelectConfig(connection2) {
  const entityId = `${connection2.installationName}_operationStatus`;
  const baseTopic = getGlobalTopic(connection2, "operationStatus");
  return {
    name: "Operation Status",
    unique_id: entityId,
    state_topic: `${baseTopic}/${TOPIC_STATE}`,
    command_topic: `${baseTopic}/${TOPIC_COMMAND}`,
    options: [
      "Mixed",
      "Normal",
      "Reduced",
      "Standby",
      "Timed",
      "Party",
      "Holiday"
    ],
    availability_topic: getGlobalAvailabilityTopic(connection2),
    payload_available: "online",
    payload_not_available: "offline",
    device: deviceData(connection2)
  };
}

// src/MqttClient.ts
function publishGlobalUpdate(client, update, connection2) {
  switch (update.kind) {
    case "globalMode":
      if (connection2.data.globalMode !== 10 /* Null */) {
        client.publish(
          `${getGlobalTopic(connection2, "operationMode")}/${TOPIC_STATE}`,
          RehauGlobalOperationMode[connection2.data.globalMode],
          { retain: true }
        );
        for (const room of connection2.data.rooms) {
          publishRoomUpdate(client, { kind: "config", roomId: room.id }, connection2);
          publishRoomUpdate(client, { kind: "mode", roomId: room.id }, connection2);
        }
      }
      break;
    case "globalOperationStatus":
      if (connection2.data.globalOperationStatus !== 10 /* Null */) {
        client.publish(
          `${getGlobalTopic(connection2, "operationStatus")}/${TOPIC_STATE}`,
          RehauOperationStatus[connection2.data.globalOperationStatus],
          { retain: true }
        );
      }
      break;
    case "outsideTemperature":
      if (connection2.data.outsideTemperature !== EMPTY_TEMP_VALUE) {
        client.publish(
          `${getGlobalTopic(connection2, "outsideTemperature")}/${TOPIC_STATE}`,
          connection2.data.outsideTemperature.toFixed(1)
        );
      }
      break;
    case "onlineState":
      client.publish(getGlobalAvailabilityTopic(connection2), connection2.data.online ? "online" : "offline", {
        retain: true
      });
      if (!connection2.data.online) {
        for (const room of connection2.data.rooms) {
          client.publish(`${getRoomTopic(room.id, connection2)}/${TOPIC_AVAILABILITY}`, "offline", {
            retain: true
          });
        }
      }
      break;
  }
}
function publishRoomUpdate(client, update, connection2) {
  const room = connection2.data.rooms.find(
    (r) => Object.hasOwn(update, "roomId") && r.id === update.roomId
  );
  if (!room) return;
  const base = getRoomTopic(room.id, connection2);
  switch (update.kind) {
    case "config":
      const info = JSON.stringify(createRoomMqttConfig(room, connection2));
      logger.debug("Publishing MQTT room info for room %s: %o", room.id, info);
      client.publish(`${base}/${TOPIC_CONFIG}`, info, { retain: true });
      client.publish(
        `${getRoomTopic(room.id, connection2, "temperature")}/${TOPIC_CONFIG}`,
        JSON.stringify(createRoomTempSensorMqttConfig(room, connection2)),
        { retain: true }
      );
      client.publish(
        `${getRoomTopic(room.id, connection2, "humidity")}/${TOPIC_CONFIG}`,
        JSON.stringify(createRoomHumiditySensorMqttConfig(room, connection2)),
        { retain: true }
      );
      client.publish(`${base}/${TOPIC_AVAILABILITY}`, "online", {
        retain: true
      });
      break;
    case "temperature":
      if (room.temperature !== EMPTY_TEMP_VALUE) {
        logger.debug(
          "Publishing MQTT room temperature for room %s: %s",
          room.id,
          room.temperature
        );
        client.publish(
          `${getRoomTopic(room.id, connection2, "temperature")}/${TOPIC_STATE}`,
          room.temperature.toFixed(1)
        );
        client.publish(
          `${base}/${TOPIC_CURRENT_TEMPERATURE}`,
          room.temperature.toFixed(1)
        );
      }
      break;
    case "setpoint":
      if (room.setpoint !== EMPTY_TEMP_VALUE) {
        logger.debug(
          "Publishing MQTT room setpoint for room %s: %s",
          room.id,
          room.temperature
        );
        client.publish(
          `${base}/${TOPIC_TARGET_TEMPERATURE}`,
          room.setpoint.toFixed(1)
        );
      }
      break;
    case "humidity":
      if (room.humidity !== EMPTY_HUMIDITY_VALUE) {
        logger.debug(
          "Publishing MQTT room humidity for room %s: %s",
          room.id,
          room.humidity
        );
        client.publish(
          `${getRoomTopic(room.id, connection2, "humidity")}/${TOPIC_STATE}`,
          room.humidity.toFixed(1)
        );
        client.publish(
          `${base}/${TOPIC_CURRENT_HUMIDITY}`,
          room.humidity.toString()
        );
      }
      break;
    case "mode":
      if (room.mode !== 10 /* Null */) {
        let mode = "off";
        if (room.mode !== 3 /* Standby */) {
          mode = isSystemCooling(connection2.data) ? "cool" : "heat";
        }
        logger.debug(
          "Publishing MQTT mode for room %s: %s",
          room.id,
          RehauOperationStatus[room.mode]
        );
        client.publish(`${base}/${TOPIC_MODE}`, mode);
        client.publish(
          `${base}/${TOPIC_PRESET}`,
          RehauOperationStatus[room.mode]
        );
      }
      break;
  }
}
function publishUpdate(client, update, connection2) {
  if (isRoomUpdate(update)) {
    publishRoomUpdate(client, update, connection2);
  } else {
    publishGlobalUpdate(client, update, connection2);
  }
}
function startMqttClient(connection2) {
  const opts = {
    host: mqttHost,
    port: mqttPort,
    protocol: mqttProtocol
  };
  if (mqttUsername) opts.username = mqttUsername;
  if (mqttPassword) opts.password = mqttPassword;
  const client = mqtt.connect(opts);
  client.on("connect", () => {
    logger.info("MQTT connected");
    client.subscribe(`${mqttTopic}/climate/#`, (err) => {
      if (err) logger.error("MQTT subscribe error: %s", err.message);
    });
    client.subscribe(`${getGlobalTopic(connection2, "operationMode")}/${TOPIC_COMMAND}`, (err) => {
      if (err) logger.error("MQTT subscribe error: %s", err.message);
    });
    client.subscribe(`${getGlobalTopic(connection2, "operationStatus")}/${TOPIC_COMMAND}`, (err) => {
      if (err) logger.error("MQTT subscribe error: %s", err.message);
    });
    client.publish(
      `${getGlobalTopic(connection2, "outsideTemperature")}/${TOPIC_CONFIG}`,
      JSON.stringify(createOutsideTemperatureSensorConfig(connection2)),
      { retain: true }
    );
    client.publish(
      `${getGlobalTopic(connection2, "operationMode")}/${TOPIC_CONFIG}`,
      JSON.stringify(createOperationModeSelectConfig(connection2)),
      { retain: true }
    );
    client.publish(
      `${getGlobalTopic(connection2, "operationStatus")}/${TOPIC_CONFIG}`,
      JSON.stringify(createGlobalOperatingStatusSelectConfig(connection2)),
      { retain: true }
    );
    client.publish(getGlobalAvailabilityTopic(connection2), "online", {
      retain: true
    });
  });
  client.on("message", (topic, message) => {
    if (topic === `${getGlobalTopic(connection2, "operationMode")}/${TOPIC_COMMAND}`) {
      connection2.data.globalMode = RehauGlobalOperationMode[message.toString()] ?? connection2.data.globalMode;
      return;
    } else if (topic === `${getGlobalTopic(connection2, "operationStatus")}/${TOPIC_COMMAND}`) {
      connection2.data.globalOperationStatus = RehauOperationStatus[message.toString()] ?? connection2.data.globalOperationStatus;
      return;
    }
    const parsed2 = parseRoomTopic(topic, connection2);
    if (!parsed2) return;
    const { roomId, subtopic } = parsed2;
    const room = connection2.data.rooms.find((r) => r.id === roomId);
    if (!room) {
      const base = getRoomTopic(roomId, connection2);
      client.publish(`${base}/${TOPIC_AVAILABILITY}`, "offline", {
        retain: true
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
        if (room.mode === 10 /* Null */) return;
        switch (payload) {
          case "off":
            room.mode = 3 /* Standby */;
            break;
          default:
            room.mode = 1 /* Normal */;
            break;
        }
        break;
      }
      case TOPIC_PRESET_COMMAND: {
        if (room.mode === 10 /* Null */) return;
        const status = RehauOperationStatus[payload];
        if (status !== void 0) room.mode = status;
        break;
      }
    }
  });
  client.on("error", (err) => logger.error("MQTT error: %o", err));
  return {
    stop: () => {
      client.publish(getGlobalAvailabilityTopic(connection2), "offline", {
        retain: true
      });
      client.end();
    },
    onUpdate: (update) => publishUpdate(client, update, connection2)
  };
}

// src/main.ts
var slugify = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "default";
var connection = {
  installationName,
  installationSlug: slugify(installationName),
  modbusAddress: unitNumber,
  data: createDefaultData()
};
var { stop: stopMqtt, onUpdate: onRoomUpdate } = startMqttClient(connection);
var stopModbus = startModbusServer(connection, modbusHost, modbusPort, onRoomUpdate);
process.on("SIGINT", () => {
  stopModbus();
  stopMqtt();
});
process.on("SIGTERM", () => {
  stopModbus();
  stopMqtt();
});
export {
  slugify
};
//# sourceMappingURL=main.js.map