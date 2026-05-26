import { IServiceVector, ServerTCP } from "modbus-serial";
import { log } from "./logger";

/**
 * Modbus server for REHAU communication
 * 
 * REHAU 
 */

const vector: IServiceVector = {
  getHoldingRegister: function (addr: number, unitID: number) {
    // if (unitID !== unitNumber && unitID !== 0) {
    //   return;
    // }
    if (addr > 199) {
      throw new Error("Wrong address");
    }
    log("getHoldingRegister", addr, `unit:${unitID}`);

    if (addr === 1) {
      return 10;
    }

    return 0;
  },
  setRegisterArray: function (addr: number, value: number[], unitID: number) {
    // if (unitID !== unitNumber && unitID !== 0) {
    //   return;
    // }
    if (addr > 199) {
      throw new Error("Wrong address");
    }
    log("setRegisterArray", addr, value, `unit:${unitID}`);
  },
};

// set the server to answer for modbus requests
log("ModbusTCP listening on modbus://0.0.0.0:502");
const serverTCP = new ServerTCP(vector, {
  host: "0.0.0.0",
  port: 502,
  debug: true,
});

serverTCP.on("error", function (err) {
  console.error(err);
});

serverTCP.on("serverError", function (err) {
  console.error(err);
});

serverTCP.on("socketError", function (err) {
  console.error(err);
  serverTCP.close(closed);
});

function closed() {
  log("server closed");
}
