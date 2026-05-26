// Global registers
export const REG_GLOBAL_OPERATION_MODE   = 1;
export const REG_GLOBAL_OPERATION_STATUS = 2;
export const REG_ERROR_PRESENT           = 3;
export const REG_WARNING_PRESENT         = 5;
export const REG_HINT_PRESENT            = 6;
export const REG_OUTSIDE_TEMPERATURE     = 7;
export const REG_OUTSIDE_TEMP_FILTERED   = 8;

// Room zone base address: ROOM_BASE * roomId (roomId is 1-based)
// e.g. room 1 → 100, room 2 → 200, ..., room 60 → 6000
export const ROOM_BASE = 100;

// Offsets within each room zone block
export const ROOM_OFFSET_STATUS      = 0;
export const ROOM_OFFSET_SETPOINT    = 1;
export const ROOM_OFFSET_TEMPERATURE = 2;
export const ROOM_OFFSET_HUMIDITY    = 10;

// Mixed circuit registers (each circuit occupies 4 consecutive IDs)
export const REG_MC1_OPENING     = 10;
export const REG_MC1_PUMP        = 11;
export const REG_MC1_FLOW_TEMP   = 12;
export const REG_MC1_RETURN_TEMP = 13;
export const REG_MC2_OPENING     = 14;
export const REG_MC2_PUMP        = 15;
export const REG_MC2_FLOW_TEMP   = 16;
export const REG_MC2_RETURN_TEMP = 17;
export const REG_MC3_OPENING     = 18;
export const REG_MC3_PUMP        = 19;
export const REG_MC3_FLOW_TEMP   = 20;
export const REG_MC3_RETURN_TEMP = 21;

// Dehumidifier state registers (up to 9)
export const REG_DEHUMIDIFIER_FIRST = 22;
export const REG_DEHUMIDIFIER_LAST  = 30;

// Pump state registers (up to 5)
export const REG_PUMP_FIRST = 31;
export const REG_PUMP_LAST  = 35;
