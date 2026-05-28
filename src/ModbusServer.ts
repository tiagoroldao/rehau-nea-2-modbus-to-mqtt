import { type IServiceVector, ServerTCP } from "modbus-serial";
import {
  type RehauConnection,
  type RehauData,
  type RoomUpdate,
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
} from "./modbusConstants";
import { logger } from "./config";


export function setRegister(
  data: RehauData,
  addr: number,
  value: number,
): RoomUpdate[] {
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
  let room = isNew
    ? createDefaultRoom(roomId)
    : data.rooms.find((r) => r.id === roomId)!;
  if (isNew) data.rooms.push(room);

  let fieldUpdate: RoomUpdate;
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

export function startModbusServer(
  connection: RehauConnection,
  host: string,
  port: number,
  onRoomUpdate?: (update: RoomUpdate) => void,
): () => void {
  const { data, modbusAddress } = connection;
  const vector: IServiceVector = {
    getHoldingRegister(addr: number, unitID: number) {
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

    setRegisterArray(addr: number, value: number[], unitID: number) {
      if (unitID !== modbusAddress && unitID !== 0) return;
      value.forEach((v, i) =>
        setRegister(data, addr + i, v).forEach((u) => onRoomUpdate?.(u)),
      );
    },
  };

  logger.info(`ModbusTCP listening on modbus://${host}:${port}`);
  const server = new ServerTCP(vector, { host, port, debug: true });

  server.on("error", (err) => logger.error(err));
  server.on("serverError", (err) => logger.error(err));
  server.on("socketError", (err) => {
    logger.error(err);
    server.close(() => logger.info("ModbusTCP closed"));
  });

  return () => server.close(() => logger.info("ModbusTCP closed"));
}
