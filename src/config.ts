export const useDebug = true;

export const modbusHost   = "0.0.0.0";
export const modbusPort   = 502;
export const unitNumber   = 241;

export const mqttHost              = "homeassistant.local";
export const mqttPort              = 8883;
export const mqttProtocol          = "mqtts" as const;
export const mqttUsername          = "";
export const mqttPassword          = "";
export const mqttRejectUnauthorized = false;
export const mqttEntityPrefix       = "rehau";
export const mqttTopic    = "homeassistant/climate";
