import { IServiceVector, ServerTCP } from "modbus-serial";
import { log } from "./logger.js";
import { RehauConnection, RehauData, createDefaultRoom } from "./RehauData.js";
import { decimalToDpt, dptValueToDecimal } from "./dpt9001.js";
import {
    REG_GLOBAL_OPERATION_MODE, REG_GLOBAL_OPERATION_STATUS, REG_OUTSIDE_TEMPERATURE, REG_OUTSIDE_TEMP_FILTERED, ROOM_BASE,
    ROOM_OFFSET_STATUS, ROOM_OFFSET_SETPOINT, ROOM_OFFSET_TEMPERATURE, ROOM_OFFSET_HUMIDITY,
} from "./modbusConstants.js";

export function setRegister(data: RehauData, addr: number, value: number): void {
    switch (addr) {
        case REG_GLOBAL_OPERATION_MODE:   data.globalMode = value; return;
        case REG_GLOBAL_OPERATION_STATUS: data.globalOperationStatus = value; return;
        case REG_OUTSIDE_TEMPERATURE:     data.outsideTemperature = dptValueToDecimal(value); return;
        case REG_OUTSIDE_TEMP_FILTERED:   data.outsideTemperatureFiltered = dptValueToDecimal(value); return;
    }

    if (addr < ROOM_BASE) return;

    const roomId = Math.floor(addr / ROOM_BASE);
    const offset = addr % ROOM_BASE;

    let room = data.rooms.find(r => r.id === roomId);
    if (!room) {
        room = createDefaultRoom(roomId);
        data.rooms.push(room);
    }

    switch (offset) {
        case ROOM_OFFSET_STATUS:      room.mode = value; break;
        case ROOM_OFFSET_SETPOINT:    room.setpoint = dptValueToDecimal(value); break;
        case ROOM_OFFSET_TEMPERATURE: room.temperature = dptValueToDecimal(value); break;
        case ROOM_OFFSET_HUMIDITY:    room.humidity = value; break;
    }
}

export function startModbusServer(connection: RehauConnection, host: string, port: number): () => void {
    const { data, modbusAddress } = connection;
    const vector: IServiceVector = {
        getHoldingRegister(addr: number, unitID: number) {
            if (unitID !== modbusAddress) return 0;

            if (addr === REG_GLOBAL_OPERATION_MODE)    return data.globalMode;
            if (addr === REG_GLOBAL_OPERATION_STATUS)  return data.globalOperationStatus;
            if (addr === REG_OUTSIDE_TEMPERATURE)    return decimalToDpt(data.outsideTemperature);
            if (addr === REG_OUTSIDE_TEMP_FILTERED)  return decimalToDpt(data.outsideTemperatureFiltered);
            if (addr < ROOM_BASE) return 0;

            const roomId = Math.floor(addr / ROOM_BASE);
            const offset = addr % ROOM_BASE;

            let room = data.rooms.find(r => r.id === roomId);
            if (!room) {
                room = createDefaultRoom(roomId);
                data.rooms.push(room);
            }

            switch (offset) {
                case ROOM_OFFSET_STATUS:      return room.mode;
                case ROOM_OFFSET_SETPOINT:    return decimalToDpt(room.setpoint);
                case ROOM_OFFSET_TEMPERATURE: return decimalToDpt(room.temperature);
                case ROOM_OFFSET_HUMIDITY:    return room.humidity;
                default: return 0;
            }
        },

        setRegisterArray(addr: number, value: number[], unitID: number) {
            if (unitID !== modbusAddress && unitID !== 0) return;
            value.forEach((v, i) => setRegister(data, addr + i, v));
        },
    };

    log(`ModbusTCP listening on modbus://${host}:${port}`);
    const server = new ServerTCP(vector, { host, port, debug: true });

    server.on("error", (err) => console.error(err));
    server.on("serverError", (err) => console.error(err));
    server.on("socketError", (err) => {
        console.error(err);
        server.close(() => log("server closed"));
    });

    return () => server.close(() => log("server closed"));
}
