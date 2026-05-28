import { type Level } from "pino";

export const logLevel: Level = 'debug';

export const modbusHost   = "0.0.0.0";
export const modbusPort   = 502;
export const unitNumber   = 240;

export const mqttHost              = "localhost";
export const mqttPort              = 1883;
export const mqttProtocol          = "mqtt" as const;
export const mqttUsername          = "";
export const mqttPassword          = "";
export const mqttRejectUnauthorized = false;
export const mqttEntityPrefix       = "rehau";
export const mqttTopic    = "homeassistant/climate";
