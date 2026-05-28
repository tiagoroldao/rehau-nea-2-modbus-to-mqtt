
// "Empty" values - values REHAU recognizes as the system not having data, triggering a setRegister on their part
export const EMPTY_OPERATION_MODE = 10;
export const EMPTY_TEMP_VALUE = 0;
export const EMPTY_HUMIDITY_VALUE = 0;

export enum RehauGlobalOperationMode {
    Null = 10,
    Auto = 1,
    Heating = 2,
    Cooling = 3,
    ManualHeating = 4,
    ManualCooling = 5,
}

// [“auto”, “off”, “cool”, “heat”, “dry”, “fan_only”]

export enum RehauOperationStatus {
    Null = 10,
    Normal = 1,
    Reduced = 2,
    Standby = 3,
    Timed = 4,
    Party = 5,
    HolidayAbsence = 6,
}


export function createDefaultRoom(id: number): RehauRoom {
    return { id, mode: RehauOperationStatus.Null, setpoint: EMPTY_TEMP_VALUE, temperature: EMPTY_TEMP_VALUE, humidity: EMPTY_HUMIDITY_VALUE };
}

export interface RehauRoom {
    id: number;
    mode: RehauOperationStatus;
    setpoint: number;
    temperature: number;
    humidity: number;
}

export type RoomUpdate =
    | { kind: 'created';     roomId: number }
    | { kind: 'mode';        roomId: number }
    | { kind: 'setpoint';    roomId: number }
    | { kind: 'temperature'; roomId: number }
    | { kind: 'humidity';    roomId: number };

export interface RehauData {
    globalMode: RehauGlobalOperationMode;
    globalOperationStatus: RehauOperationStatus;
    outsideTemperature: number;
    outsideTemperatureFiltered: number;
    rooms: RehauRoom[];
}

export function createDefaultData(): RehauData {
    return {
        globalMode: RehauGlobalOperationMode.Null,
        globalOperationStatus: RehauOperationStatus.Null,
        outsideTemperature: EMPTY_TEMP_VALUE,
        outsideTemperatureFiltered: EMPTY_TEMP_VALUE,
        rooms: [],
    };
}

export interface RehauConnection {
    mqttPrefix: string;
    modbusAddress: number;
    data: RehauData;
}