import { modbusHost, modbusPort, installationName, unitNumber } from "./config";
import { type RehauConnection, createDefaultData } from "./RehauData";
import { startModbusServer } from "./ModbusServer";
import { startMqttClient } from "./MqttClient";

/**
 * Lowercased ASCII slug — strips accents, collapses non-alphanum to `-`.
 * "Casa Bertini" → "casa-bertini", "Ufficio 2°" → "ufficio-2".
 */
export const slugify = (s: string): string =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "default";

const connection: RehauConnection = {
    installationName: installationName,
    installationSlug: slugify(installationName),
    modbusAddress: unitNumber,
    data: createDefaultData(),
};

const { stop: stopMqtt, onRoomUpdate } = startMqttClient(connection);
const stopModbus = startModbusServer(connection, modbusHost, modbusPort, onRoomUpdate);

process.on("SIGINT",  () => { stopModbus(); stopMqtt(); });
process.on("SIGTERM", () => { stopModbus(); stopMqtt(); });
