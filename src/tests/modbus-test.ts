import { IServiceVector, ServerTCP } from "modbus-serial";

const coils: Record<number, boolean> = {};
const registers: Record<number, number> = {};

const UNIT_ID = 241;
const minAddress = 0;
const maxAddress = 20001;

const useDebug = true;

function debug(...args: any[]) {
  useDebug && console.debug(...args);
}

const OPERATION_MODES: Record<number, string> = {
  1: "Normal mode",
  2: "Reduced mode",
  3: "Standby mode",
  4: "Automatic mode (timed)",
  5: "Party",
  6: "Holiday/Absence",
}

function getCoil(addr: number) {
  if (addr < minAddress || addr >= maxAddress) {
    throw new Error("Address out of range");
  }
  if (coils[addr] === undefined) {
    throw new Error("Address not found, perhaps not initialized");
  }
  return coils[addr];
}

function getRegister(addr: number) {
  debug("get address", addr, minAddress, maxAddress);
  if (addr < minAddress || addr >= maxAddress) {
    debug("Address out of range");
    throw new Error("Address out of range");
  }
  if (registers[addr] === undefined) {
    debug("Address not found, perhaps not initialized");
    throw new Error("Address not found, perhaps not initialized");
  }
  return registers[addr];
}

function setRegister(
  addr: number,
  value: number
) {
  if (addr < minAddress || addr >= maxAddress) {
    console.error("Address out of range");
    throw new Error("Address out of range");
  }
  registers[addr] = value;
}

function setCoil(
  addr: number,
  value: boolean
) {
  if (addr < minAddress || addr >= maxAddress) {
    console.error("Address out of range");
    throw new Error("Address out of range");
  }
  coils[addr] = value;
}

const vector: IServiceVector = {
  getCoil: function (addr: number, unitID: number) {
    debug("getCoil", addr, `unit:${unitID}`);
    if (unitID !== UNIT_ID) {
      throw new Error("Wrong unit ID");
    }
    throw new Error("Not answering queries");
    const out = getCoil(addr);
    debug("responded to getCoil", addr, out, `unit:${unitID}`);
    return out;
  },
  getInputRegister: function (addr: number, unitID: number) {
    debug("getInputRegister", addr, `unit:${unitID}`);
    if (unitID !== UNIT_ID) {
      throw new Error("Wrong unit ID");
    }
    throw new Error("Not answering queries");
    const out = getRegister(addr);
    debug("responded to getInputRegister", addr, out, `unit:${unitID}`);
    return out;
  },
  getHoldingRegister: function (addr: number, unitID: number) {
    debug("getHoldingRegister", addr, `unit:${unitID}`);
    if (unitID !== UNIT_ID) {
      throw new Error("Wrong unit ID");
    }
    throw new Error("Not answering queries");
    const out = getRegister(addr);
    debug("responded to getInputRegister", addr, out, `unit:${unitID}`);
    return out;
  },
  getMultipleInputRegisters: function (
    addr: number,
    length: number,
    unitID: number
  ) {
    debug("getMultipleInputRegisters", addr, length, `unit:${unitID}`);
    if (unitID !== UNIT_ID) {
      throw new Error("Wrong unit ID");
    }
    throw new Error("Not answering queries");
    const out: number[] = [];
    for (let i = 0; i < length; i++) {
      out.push(getRegister(addr + i));
    }
    debug(
      "responded to getMultipleInputRegisters",
      unitID,
      addr,
      length,
      out
    );
    return out;
  },
  getMultipleHoldingRegisters: function (
    addr: number,
    length: number,
    unitID: number
  ) {
    if (addr < 100 || addr >= 200) {
      throw new Error("Only setting room 1xx");
    }
    debug("getMultipleHoldingRegisters", addr, length, `unit:${unitID}`);
    if (unitID !== UNIT_ID) {
      throw new Error("Wrong unit ID");
      // debug("Wrong unit ID");
    }
    // throw new Error("Not answering queries");
    const out: number[] = [];
    for (let i = 0; i < length; i++) {
      let val = 0;
      try {
        val = getRegister(addr + i);
      } catch(e) {
        // do nothing
      }
      out.push(val);
    }
    debug(
      "responded to getMultipleHoldingRegisters",
      unitID,
      addr,
      length,
      out
    );
    return out;
  },
  setCoil: function (addr: number, value: boolean, unitID: number) {
    debug("setCoil", addr, `unit:${unitID}`);
    if (unitID !== UNIT_ID && unitID !== 0) {
      throw new Error("Wrong unit ID");
    }
    setCoil(addr, value);
    debug("Set a coil", unitID, addr, value);
  },
  setRegister: function (addr: number, value: number, unitID: number) {
    if (unitID !== UNIT_ID && unitID !== 0) {
      throw new Error("Wrong unit ID");
    }
    if (addr >= 300) {
      throw new Error("Skipping most rooms");
    }
    const type = addr % 100;
    const roomNr = `Room ${Math.floor(addr / 100)}xx`;

    if (type === 0) {
      debug(`${roomNr} Operation Mode`, OPERATION_MODES[value] || "Unknown", `unit:${unitID}`);
    }
    else if (type === 1) {
      debug(`${roomNr} SET temp`, `${value/100} °C`, `unit:${unitID}`);
    }
    else if (type === 2) {
      debug(`${roomNr} temp`, `${value/100} °C`, `unit:${unitID}`);
    }
    else if (type === 10) {
      debug(`${roomNr} humidity`, `${value} %`, `unit:${unitID}`);
    } else {
      debug("Set a non-room register", addr,  value, `unit:${unitID}`);
    }
    setRegister(addr, value);
  },
  // setRegisterArray: function (addr: number, value: number[], unitID: number) {
  //   if (unitID !== UNIT_ID && unitID !== 0) {
  //     throw new Error("Wrong unit ID");
  //   }
  //   debug("Set a register array", addr,  value, `unit:${unitID}`);
  //   for (let i = 0; i < value.length; i++) {
  //     setRegister(addr + i, value[i]!);
  //   }
  // }
};

(vector as any).readDeviceIdentification = function(unitID: number) {
    debug("readDeviceIdentification", `unit:${unitID}`);
    if (unitID !== UNIT_ID) {
      throw new Error("Wrong unit ID");
    }
    return {
      0x00: "MyVendorName",
      0x01: "MyProductCode",
      0x02: "MyMajorMinorRevision",
      0x05: "MyModelName",
      0x97: "MyExtendedObject1",
      0xAB: "MyExtendedObject2"
    };
  }

// set the server to answer for modbus requests
debug("ModbusTCP listening on modbus://0.0.0.0:502");
const serverTCP = new ServerTCP(vector, {
  host: "0.0.0.0",
  port: 502,
  debug: false,
  // unitID: UNIT_ID,
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
  debug("server closed");
}
