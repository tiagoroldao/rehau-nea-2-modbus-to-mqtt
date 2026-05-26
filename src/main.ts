import { modbusHost, modbusPort, mqttEntityPrefix, unitNumber } from "./config.js";
import { RehauConnection, createDefaultData } from "./RehauData.js";
import { startModbusServer } from "./ModbusServer.js";
import { startMqttClient } from "./MqttClient.js";

const connection: RehauConnection = {
    mqttPrefix: mqttEntityPrefix,
    modbusAddress: unitNumber,
    data: createDefaultData(),
};

const stopModbus = startModbusServer(connection, modbusHost, modbusPort);
const stopMqtt   = startMqttClient(connection);

process.on("SIGINT",  () => { stopModbus(); stopMqtt(); });
process.on("SIGTERM", () => { stopModbus(); stopMqtt(); });
