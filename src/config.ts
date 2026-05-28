import { z } from "zod";

const boolEnv = z.string().transform(v => v === "true" || v === "1");

const configSchema = z.object({
    LOG_LEVEL:                z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),

    MODBUS_HOST:              z.string().default("0.0.0.0"),
    MODBUS_PORT:              z.coerce.number().int().min(1).max(65535).default(502),
    MODBUS_UNIT_ID:           z.coerce.number().int().default(240),

    MQTT_HOST:                z.string().default("localhost"),
    MQTT_PORT:                z.coerce.number().int().min(1).max(65535).default(1883),
    MQTT_PROTOCOL:            z.enum(["mqtt", "mqtts", "ws", "wss"]).default("mqtt"),
    MQTT_USERNAME:            z.string().default(""),
    MQTT_PASSWORD:            z.string().default(""),
    MQTT_REJECT_UNAUTHORIZED: boolEnv.default(false),
    MQTT_ENTITY_PREFIX:       z.string().default("rehau"),
    MQTT_TOPIC:               z.string().default("homeassistant/climate"),
});

const parsed = configSchema.parse(process.env);

export const logLevel               = parsed.LOG_LEVEL;
export const modbusHost             = parsed.MODBUS_HOST;
export const modbusPort             = parsed.MODBUS_PORT;
export const unitNumber             = parsed.MODBUS_UNIT_ID;
export const mqttHost               = parsed.MQTT_HOST;
export const mqttPort               = parsed.MQTT_PORT;
export const mqttProtocol           = parsed.MQTT_PROTOCOL;
export const mqttUsername           = parsed.MQTT_USERNAME;
export const mqttPassword           = parsed.MQTT_PASSWORD;
export const mqttRejectUnauthorized = parsed.MQTT_REJECT_UNAUTHORIZED;
export const mqttEntityPrefix       = parsed.MQTT_ENTITY_PREFIX;
export const mqttTopic              = parsed.MQTT_TOPIC;
