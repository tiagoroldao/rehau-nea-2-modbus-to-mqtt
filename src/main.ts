import { modbusHost, modbusPort, mqttEntityPrefix, unitNumber } from "./config";
import { RehauConnection, createDefaultData } from "./RehauData";
import { startModbusServer } from "./ModbusServer";
import { startMqttClient } from "./MqttClient";

const connection: RehauConnection = {
    mqttPrefix: mqttEntityPrefix,
    modbusAddress: unitNumber,
    data: createDefaultData(),
};

const { stop: stopMqtt, onRoomUpdate } = startMqttClient(connection);
const stopModbus = startModbusServer(connection, modbusHost, modbusPort, onRoomUpdate);

process.on("SIGINT",  () => { stopModbus(); stopMqtt(); });
process.on("SIGTERM", () => { stopModbus(); stopMqtt(); });
