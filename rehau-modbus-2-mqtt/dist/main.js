"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/config.ts
var import_zod = require("zod");
var boolEnv = import_zod.z.string().transform((v) => v === "true" || v === "1");
var configSchema = import_zod.z.object({
  LOG_LEVEL: import_zod.z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  MODBUS_HOST: import_zod.z.string().default("0.0.0.0"),
  MODBUS_PORT: import_zod.z.coerce.number().int().min(1).max(65535).default(502),
  MODBUS_UNIT_ID: import_zod.z.coerce.number().int().default(240),
  MQTT_HOST: import_zod.z.string().default("localhost"),
  MQTT_PORT: import_zod.z.coerce.number().int().min(1).max(65535).default(1883),
  MQTT_PROTOCOL: import_zod.z.enum(["mqtt", "mqtts", "ws", "wss"]).default("mqtt"),
  MQTT_USERNAME: import_zod.z.string().default(""),
  MQTT_PASSWORD: import_zod.z.string().default(""),
  MQTT_REJECT_UNAUTHORIZED: boolEnv.default(false),
  MQTT_ENTITY_PREFIX: import_zod.z.string().default("rehau"),
  MQTT_TOPIC: import_zod.z.string().default("homeassistant/climate")
});
var parsed = configSchema.parse(process.env);
var logLevel = parsed.LOG_LEVEL;
var modbusHost = parsed.MODBUS_HOST;
var modbusPort = parsed.MODBUS_PORT;
var unitNumber = parsed.MODBUS_UNIT_ID;
var mqttHost = parsed.MQTT_HOST;
var mqttPort = parsed.MQTT_PORT;
var mqttProtocol = parsed.MQTT_PROTOCOL;
var mqttUsername = parsed.MQTT_USERNAME;
var mqttPassword = parsed.MQTT_PASSWORD;
var mqttRejectUnauthorized = parsed.MQTT_REJECT_UNAUTHORIZED;
var mqttEntityPrefix = parsed.MQTT_ENTITY_PREFIX;
var mqttTopic = parsed.MQTT_TOPIC;

// src/RehauData.ts
var EMPTY_TEMP_VALUE = 0;
var EMPTY_HUMIDITY_VALUE = 0;
var RehauOperationStatus = /* @__PURE__ */ ((RehauOperationStatus2) => {
  RehauOperationStatus2[RehauOperationStatus2["Null"] = 10] = "Null";
  RehauOperationStatus2[RehauOperationStatus2["Normal"] = 1] = "Normal";
  RehauOperationStatus2[RehauOperationStatus2["Reduced"] = 2] = "Reduced";
  RehauOperationStatus2[RehauOperationStatus2["Standby"] = 3] = "Standby";
  RehauOperationStatus2[RehauOperationStatus2["Timed"] = 4] = "Timed";
  RehauOperationStatus2[RehauOperationStatus2["Party"] = 5] = "Party";
  RehauOperationStatus2[RehauOperationStatus2["HolidayAbsence"] = 6] = "HolidayAbsence";
  return RehauOperationStatus2;
})(RehauOperationStatus || {});
function createDefaultRoom(id) {
  return { id, mode: 10 /* Null */, setpoint: EMPTY_TEMP_VALUE, temperature: EMPTY_TEMP_VALUE, humidity: EMPTY_HUMIDITY_VALUE };
}
function createDefaultData() {
  return {
    globalMode: 10 /* Null */,
    globalOperationStatus: 10 /* Null */,
    outsideTemperature: EMPTY_TEMP_VALUE,
    outsideTemperatureFiltered: EMPTY_TEMP_VALUE,
    rooms: []
  };
}

// src/ModbusServer.ts
var import_modbus_serial = require("modbus-serial");

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

// src/ModbusServer.ts
var import_pino = __toESM(require("pino"));
var logger = (0, import_pino.default)({ level: logLevel });
function setRegister(data, addr, value) {
  switch (addr) {
    case REG_GLOBAL_OPERATION_MODE:
      data.globalMode = value;
      return [];
    case REG_GLOBAL_OPERATION_STATUS:
      data.globalOperationStatus = value;
      return [];
    case REG_OUTSIDE_TEMPERATURE:
      data.outsideTemperature = dptValueToDecimal(value);
      return [];
    case REG_OUTSIDE_TEMP_FILTERED:
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
      room.mode = value;
      fieldUpdate = { kind: "mode", roomId };
      break;
    case ROOM_OFFSET_SETPOINT:
      let setpoint = dptValueToDecimal(value);
      if (setpoint > MAX_SETPOINT_CELCIUS || setpoint < MIN_SETPOINT_CELCIUS) {
        setpoint = 0;
      }
      room.setpoint = setpoint;
      fieldUpdate = { kind: "setpoint", roomId };
      break;
    case ROOM_OFFSET_TEMPERATURE:
      room.temperature = dptValueToDecimal(value);
      fieldUpdate = { kind: "temperature", roomId };
      break;
    case ROOM_OFFSET_HUMIDITY:
      room.humidity = value;
      fieldUpdate = { kind: "humidity", roomId };
      break;
    default:
      return [];
  }
  return isNew ? [{ kind: "created", roomId }, fieldUpdate] : [fieldUpdate];
}
function startModbusServer(connection2, host, port, onRoomUpdate2) {
  const { data, modbusAddress } = connection2;
  const vector = {
    getHoldingRegister(addr, unitID) {
      if (unitID !== modbusAddress) return 0;
      if (addr === REG_GLOBAL_OPERATION_MODE) return data.globalMode;
      if (addr === REG_GLOBAL_OPERATION_STATUS)
        return data.globalOperationStatus;
      if (addr === REG_OUTSIDE_TEMPERATURE)
        return decimalToDpt(data.outsideTemperature);
      if (addr === REG_OUTSIDE_TEMP_FILTERED)
        return decimalToDpt(data.outsideTemperatureFiltered);
      if (addr < ROOM_BASE) return;
      const roomId = Math.floor(addr / ROOM_BASE);
      const offset = addr % ROOM_BASE;
      let room = data.rooms.find((r) => r.id === roomId);
      if (!room) return;
      switch (offset) {
        case ROOM_OFFSET_STATUS:
          return room.mode;
        case ROOM_OFFSET_SETPOINT:
          return decimalToDpt(room.setpoint);
        case ROOM_OFFSET_TEMPERATURE:
          return decimalToDpt(room.temperature);
        case ROOM_OFFSET_HUMIDITY:
          return room.humidity;
        default:
          return 0;
      }
    },
    setRegisterArray(addr, value, unitID) {
      if (unitID !== modbusAddress && unitID !== 0) return;
      value.forEach(
        (v, i) => setRegister(data, addr + i, v).forEach((u) => onRoomUpdate2?.(u))
      );
    }
  };
  logger.info(`ModbusTCP listening on modbus://${host}:${port}`);
  const server = new import_modbus_serial.ServerTCP(vector, { host, port, debug: true });
  server.on("error", (err) => logger.error(err));
  server.on("serverError", (err) => logger.error(err));
  server.on("socketError", (err) => {
    logger.error(err);
    server.close(() => logger.info("ModbusTCP closed"));
  });
  return () => server.close(() => logger.info("ModbusTCP closed"));
}

// src/MqttClient.ts
var import_mqtt = __toESM(require("mqtt"));

// src/mqttDiscovery.ts
var TOPIC_CURRENT_TEMPERATURE = "current_temperature";
var TOPIC_TARGET_TEMPERATURE = "target_temperature";
var TOPIC_TEMPERATURE_COMMAND = "temperature_command";
var TOPIC_CURRENT_HUMIDITY = "current_humidity";
var TOPIC_MODE = "mode";
var TOPIC_MODE_COMMAND = "mode_command";
var TOPIC_PRESET = "preset";
var TOPIC_PRESET_COMMAND = "preset_command";
var TOPIC_AVAILABILITY = "availability";
var TOPIC_CONFIG = "config";
function getRoomBaseTopic(room, connection2) {
  return `${mqttTopic}/${connection2.mqttPrefix}_room_${room.id}`;
}
function parseRoomTopic(topic, connection2) {
  const prefix = `${mqttTopic}/${connection2.mqttPrefix}_room_`;
  if (!topic.startsWith(prefix)) return null;
  const rest = topic.slice(prefix.length);
  const slashIdx = rest.indexOf("/");
  if (slashIdx === -1) return null;
  const roomId = parseInt(rest.slice(0, slashIdx), 10);
  if (isNaN(roomId)) return null;
  return { roomId, subtopic: rest.slice(slashIdx + 1) };
}
function createRoomMqttConfig(room, connection2) {
  const entityId = `${connection2.mqttPrefix}_room_${room.id}`;
  const baseTopic = getRoomBaseTopic(room, connection2);
  return {
    name: `Room ${room.id}`,
    unique_id: entityId,
    object_id: entityId,
    device: {
      identifiers: [connection2.mqttPrefix],
      manufacturer: "REHAU",
      model: "NEA SMART 2.0"
    },
    current_temperature_topic: `${baseTopic}/${TOPIC_CURRENT_TEMPERATURE}`,
    temperature_state_topic: `${baseTopic}/${TOPIC_TARGET_TEMPERATURE}`,
    temperature_command_topic: `${baseTopic}/${TOPIC_TEMPERATURE_COMMAND}`,
    current_humidity_topic: `${baseTopic}/${TOPIC_CURRENT_HUMIDITY}`,
    mode_state_topic: `${baseTopic}/${TOPIC_MODE}`,
    mode_command_topic: `${baseTopic}/${TOPIC_MODE_COMMAND}`,
    modes: ["off", "auto", "heat"],
    preset_mode_state_topic: `${baseTopic}/${TOPIC_PRESET}`,
    preset_mode_command_topic: `${baseTopic}/${TOPIC_PRESET_COMMAND}`,
    preset_modes: [
      "Normal",
      "Reduced",
      "Standby",
      "Timed",
      "Party",
      "HolidayAbsence"
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

// src/MqttClient.ts
var import_pino2 = __toESM(require("pino"));
var logger2 = (0, import_pino2.default)({ level: logLevel });
function roomModeToHaMode(mode) {
  switch (mode) {
    case 3 /* Standby */:
    case 6 /* HolidayAbsence */:
      return "off";
    case 4 /* Timed */:
      return "auto";
    default:
      return "heat";
  }
}
function publishRoom(client, update, connection2) {
  const room = connection2.data.rooms.find((r) => r.id === update.roomId);
  if (!room) return;
  const base = getRoomBaseTopic(room, connection2);
  switch (update.kind) {
    case "created":
      const info = JSON.stringify(createRoomMqttConfig(room, connection2));
      logger2.debug("Publishing MQTT room info for room %s: %o", room.id, info);
      client.publish(`${base}/${TOPIC_CONFIG}`, info, { retain: true });
      client.publish(`${base}/${TOPIC_AVAILABILITY}`, "online", {
        retain: true
      });
      break;
    case "temperature":
      if (room.temperature !== EMPTY_TEMP_VALUE) {
        logger2.debug(
          "Publishing MQTT room temperature for room %s: %s",
          room.id,
          room.temperature
        );
        client.publish(
          `${base}/${TOPIC_CURRENT_TEMPERATURE}`,
          room.temperature.toFixed(1)
        );
      }
      break;
    case "setpoint":
      if (room.setpoint !== EMPTY_TEMP_VALUE) {
        logger2.debug(
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
        logger2.debug(
          "Publishing MQTT room humidity for room %s: %s",
          room.id,
          room.temperature
        );
        client.publish(
          `${base}/${TOPIC_CURRENT_HUMIDITY}`,
          room.humidity.toString()
        );
      }
      break;
    case "mode":
      if (room.mode !== 10 /* Null */) {
        logger2.debug(
          "Publishing MQTT mode for room %s: %s",
          room.id,
          roomModeToHaMode(room.mode)
        );
        client.publish(`${base}/${TOPIC_MODE}`, roomModeToHaMode(room.mode));
        client.publish(
          `${base}/${TOPIC_PRESET}`,
          RehauOperationStatus[room.mode]
        );
      }
      break;
  }
}
function startMqttClient(connection2) {
  const opts = {
    host: mqttHost,
    port: mqttPort,
    protocol: mqttProtocol,
    rejectUnauthorized: mqttRejectUnauthorized
  };
  if (mqttUsername) opts.username = mqttUsername;
  if (mqttPassword) opts.password = mqttPassword;
  const client = import_mqtt.default.connect(opts);
  client.on("connect", () => {
    logger2.info("MQTT connected");
    client.subscribe(`${mqttTopic}/#`, (err) => {
      if (err) logger2.error("MQTT subscribe error: %s", err.message);
    });
  });
  client.on("message", (topic, message) => {
    const parsed2 = parseRoomTopic(topic, connection2);
    if (!parsed2) return;
    const { roomId, subtopic } = parsed2;
    const room = connection2.data.rooms.find((r) => r.id === roomId);
    if (!room) {
      const base = getRoomBaseTopic({ id: roomId }, connection2);
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
  client.on("error", (err) => logger2.error("MQTT error: %s", err.message));
  return {
    stop: () => client.end(),
    onRoomUpdate: (update) => publishRoom(client, update, connection2)
  };
}

// src/main.ts
var connection = {
  mqttPrefix: mqttEntityPrefix,
  modbusAddress: unitNumber,
  data: createDefaultData()
};
var { stop: stopMqtt, onRoomUpdate } = startMqttClient(connection);
var stopModbus = startModbusServer(connection, modbusHost, modbusPort, onRoomUpdate);
process.on("SIGINT", () => {
  stopModbus();
  stopMqtt();
});
process.on("SIGTERM", () => {
  stopModbus();
  stopMqtt();
});
