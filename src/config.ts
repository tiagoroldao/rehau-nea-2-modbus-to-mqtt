import { z } from "zod";
import pino from "pino";

const configSchema = z.object({
    LOG_LEVEL:                z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
    
    MODBUS_UNIT_ID:           z.coerce.number().int().default(240),

    MQTT_HOST:                z.string(),
    MQTT_PORT:                z.coerce.number().int().min(1).max(65535),
    MQTT_PROTOCOL:            z.enum(["mqtt", "mqtts", "ws", "wss"]).default("mqtt"),
    MQTT_USERNAME:            z.string().default(""),
    MQTT_PASSWORD:            z.string().default(""),
    MQTT_ENTITY_PREFIX:       z.string().default("rehau"),
    MQTT_TOPIC:               z.string().default("homeassistant/climate"),
});

const parsed = configSchema.parse(process.env);

// Modbus port can be changed by setting the addon's port bindings
export const modbusHost             = '0.0.0.0';
export const modbusPort             = 502;
export const unitNumber             = parsed.MODBUS_UNIT_ID;

export const logLevel               = parsed.LOG_LEVEL;
export const mqttHost               = parsed.MQTT_HOST;
export const mqttPort               = parsed.MQTT_PORT;
export const mqttProtocol           = parsed.MQTT_PROTOCOL;
export const mqttUsername           = parsed.MQTT_USERNAME;
export const mqttPassword           = parsed.MQTT_PASSWORD;
export const mqttEntityPrefix       = parsed.MQTT_ENTITY_PREFIX;
export const mqttTopic              = parsed.MQTT_TOPIC;

export const logger = pino({ level: logLevel, transport: { target: 'pino-pretty'}});

logger.info("configuration: %o", parsed);
