
// "Empty" values - values REHAU recognizes as the system not having data, triggering a setRegister on their part
export const EMPTY_OPERATION_MODE = 10;
export const EMPTY_TEMP_VALUE = 0;

export enum RehauGlobalOperationMode {
    Auto = 1,
    Heating = 2,
    Cooling = 3,
    ManualHeating = 4,
    ManualCooling = 5,
}

// [“auto”, “off”, “cool”, “heat”, “dry”, “fan_only”]

export enum RehauOperationStatus {
    Normal = 0,
    Reduced = 1,
    Standby = 2,
    Timed = 3,
    Party = 4,
    HolidayAbsence = 5,
}


interface RehauRoom {
    id: number;
    mode: RehauOperationStatus;
    setpoint: number;
    temperature: number;
    humidity: number;
}

interface RehauData {
    mqttPrefix: string;
    modbusAddress: number;
    globalMode: RehauGlobalOperationMode;
    rooms: RehauRoom[];
}