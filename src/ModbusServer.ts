import { type IServiceVector, ServerTCP } from "modbus-serial";
import {
  type RehauConnection,
  type RehauData,
  RehauGlobalOperationMode,
  RehauOperationStatus,
  type RehauUpdate,
  createDefaultRoom,
} from "./RehauData";
import { decimalToDpt, dptValueToDecimal } from "./dpt9001";
import {
  REG_GLOBAL_OPERATION_MODE,
  REG_GLOBAL_OPERATION_STATUS,
  REG_OUTSIDE_TEMPERATURE,
  REG_OUTSIDE_TEMP_FILTERED,
  ROOM_BASE,
  ROOM_OFFSET_STATUS,
  ROOM_OFFSET_SETPOINT,
  ROOM_OFFSET_TEMPERATURE,
  ROOM_OFFSET_HUMIDITY,
  MAX_SETPOINT_CELCIUS,
  MIN_SETPOINT_CELCIUS,
  CONNECTION_TIMEOUT_MS,
} from "./modbusConstants";
import { logger } from "./config";

export function setRegister(
  data: RehauData,
  addr: number,
  value: number,
): RehauUpdate[] {
  switch (addr) {
    case REG_GLOBAL_OPERATION_MODE:
      logger.debug(
        `ModbusTCP - global operation mode update: ${RehauGlobalOperationMode[value]} as ${value}`,
      );
      data.globalMode = value;
      return [
        {
          kind: "globalMode",
        },
      ];
    case REG_GLOBAL_OPERATION_STATUS:
      logger.debug(
        `ModbusTCP - global operation status update: ${RehauOperationStatus[value]} as ${value}`,
      );
      data.globalOperationStatus = value;
      return [
        {
          kind: "globalOperationStatus",
        },
      ];
    case REG_OUTSIDE_TEMPERATURE:
      logger.debug(
        `ModbusTCP - outside temperature update: ${dptValueToDecimal(value)} as ${value}`,
      );
      data.outsideTemperature = dptValueToDecimal(value);
      return [
        {
          kind: "outsideTemperature",
        },
      ];
    case REG_OUTSIDE_TEMP_FILTERED:
      logger.debug(
        `ModbusTCP - outside temperature [filtered] update: ${dptValueToDecimal(value)} as ${value}`,
      );
      data.outsideTemperatureFiltered = dptValueToDecimal(value);
      return [];
  }

  if (addr < ROOM_BASE) return [];

  const roomId = Math.floor(addr / ROOM_BASE);
  const offset = addr % ROOM_BASE;

  const isNew = !data.rooms.find((r) => r.id === roomId);
  let room = isNew
    ? createDefaultRoom(roomId)
    : data.rooms.find((r) => r.id === roomId)!;
  if (isNew) data.rooms.push(room);

  let fieldUpdate: RehauUpdate;
  switch (offset) {
    case ROOM_OFFSET_STATUS:
      logger.debug(
        `ModbusTCP - room nr. ${room.id} status update: ${RehauOperationStatus[room.mode]}`,
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
        `ModbusTCP - room nr. ${room.id} setpoint update: ${setpoint} as ${value}`,
      );
      room.setpoint = setpoint;
      fieldUpdate = { kind: "setpoint", roomId };
      break;
    case ROOM_OFFSET_TEMPERATURE:
      logger.debug(
        `ModbusTCP - room nr. ${room.id} temperature update: ${dptValueToDecimal(value)} as ${value}`,
      );
      room.temperature = dptValueToDecimal(value);
      fieldUpdate = { kind: "temperature", roomId };
      break;
    case ROOM_OFFSET_HUMIDITY:
      logger.debug(
        `ModbusTCP - room nr. ${room.id} humidity update: ${value}%`,
      );
      room.humidity = value;
      fieldUpdate = { kind: "humidity", roomId };
      break;
    default:
      return [];
  }

  return isNew ? [{ kind: "config", roomId }, fieldUpdate] : [fieldUpdate];
}

export function startModbusServer(
  connection: RehauConnection,
  host: string,
  port: number,
  onUpdate?: (update: RehauUpdate) => void,
): () => void {
  const { data, modbusAddress } = connection;
  let lastDataReceived = Date.now();

  const connectionCheckInterval = setInterval(() => {
    if (Date.now() - lastDataReceived < CONNECTION_TIMEOUT_MS) return;
    logger.warn("No data received from Rehau system. Setting state as offline");
    connection.data.online = false;
    onUpdate?.({ kind: "onlineState" });
  }, 1000);

  const pingDataReceived = () => {
    lastDataReceived = Date.now();
    if (connection.data.online) return;
    logger.info("Data received from Rehau system. Setting state as online");
    connection.data.online = true;
    onUpdate?.({ kind: "onlineState" });
  };

  const vector: IServiceVector = {
    getHoldingRegister(addr: number, unitID: number) {
      pingDataReceived();
      if (unitID !== modbusAddress) return 0;

      if (addr === REG_GLOBAL_OPERATION_MODE) {
        logger.debug(
          `ModbusTCP - responding with global operation mode: ${RehauGlobalOperationMode[data.globalMode]}`,
        );
        return data.globalMode;
      }
      if (addr === REG_GLOBAL_OPERATION_STATUS) {
        logger.debug(
          `ModbusTCP - responding with global operation status: ${RehauOperationStatus[data.globalOperationStatus]}`,
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
            `ModbusTCP - responding with room nr. ${room.id} operation status: ${RehauOperationStatus[room.mode]}`,
          );
          return room.mode;
        case ROOM_OFFSET_SETPOINT:
          logger.debug(
            `ModbusTCP - responding with room nr. ${room.id} setpoint: ${room.setpoint} as ${decimalToDpt(room.setpoint)}`,
          );
          return decimalToDpt(room.setpoint);
        default:
          return;
      }
    },

    setRegisterArray(addr: number, value: number[], unitID: number) {
      pingDataReceived();
      if (unitID !== modbusAddress && unitID !== 0) return;
      value.forEach((v, i) =>
        setRegister(data, addr + i, v).forEach((u) => onUpdate?.(u)),
      );
    },
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
