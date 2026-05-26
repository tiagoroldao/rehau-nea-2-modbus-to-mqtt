# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

A TypeScript gateway that bridges a **REHAU NEA SMART 2.0** heating/room-control system (via Modbus TCP) with **MQTT** for Home Assistant integration. It sets up a modbus-over-tcp server (i.e. Modbus slave) that the REHAU system communicates to as a TCP client (Modbus master). TCP port and unit id are configurable via config file.

## Commands

```bash
# Run a TypeScript file directly (no build step needed for development)
npx ts-node src/modbus-test.ts
npx ts-node src/mqtt-test.ts

# Build to dist/
npx tsc

# Install dependencies
yarn install
```

No test or lint scripts are configured yet.

## Architecture

The project is in early development. The system will be comprised of:

- A class meant to hold data in-memory, and bridge MQTT and Modbus systems
- A Modbus server (using `modbus-serial`) that:
    - Synchronizes data:
        - Global operation mode and status
        - How many rooms exist in the system (as REHAU will send data on a per-room basis)

**`src/main.ts`** — entry point, currently empty; integration logic goes here.

**`src/dpt9001.ts`** — DPT 9.001 decoder: values >2048 are negative offsets. Formula: values ≤2048 → `value/100`°C; values >2048 → `((value-2048)*2)/100`°C (e.g., 3098 → 21.0°C).

**`src/experiments/`** — reference-only test files for Modbus and MQTT. Do not use as production code.

## Modbus Register Map

Source: NEA SMART 2.0 KNX Gateway commissioning manual (`nea-smart-2-0-knx-gateway.pdf`).

**Device Modbus settings**: slave address 240 or 241, 38400 bps, no parity, 1 stop bit, MSB first, 0-based register addressing.

### Global registers

| ID | Description | Values |
|----|-------------|--------|
| 1 | Global operation mode (R/W) | 1=Auto, 2=Heating, 3=Cooling, 4=Manual Heating, 5=Manual Cooling |
| 2 | Global operation status (R/W) | 1=Normal, 2=Reduced, 3=Standby, 4=Automatic(timed), 5=Party, 6=Holiday/Absence |
| 3 | Error present | 0/1 |
| 5 | Warning present | 0/1 |
| 6 | Hint present | 0/1 |
| 7 | Outside temperature | DPT 9.001 |
| 8 | Filtered outside temperature | DPT 9.001 |

### Room zone registers

Address formula: `N = 100 + k×100` where `k` is 0-based room zone index (0 ≤ k < 60).

| Offset | Example addresses | Description | Access | Encoding |
|--------|-------------------|-------------|--------|----------|
| YY00 | 100, 200, …, 6000 | Local operation status | R/W | 1-based (same as global status) |
| YY01 | 101, 201, …, 6001 | Set temperature | R/W | DPT 9.001 |
| YY02 | 102, 202, …, 6002 | Actual zone temperature | R | DPT 9.001 |
| YY10 | 110, 210, …, 6010 | Relative humidity | R | 0–100 % |

**Master/slave room zone layout**:
- Master RZ 1–12: `1xx`–`12xx`
- Slave 1 RZ 1–12: `13xx`–`24xx`
- Slave 2: `25xx`–`36xx` (and so on, up to 5 slaves)

### Mixed circuit registers (IDs 10–21)

Each circuit has 4 registers: opening %, pump state, flow temp (DPT 9.001), return temp (DPT 9.001). All 4 must be present to enable a circuit.

| IDs | Circuit |
|-----|---------|
| 10–13 | Mixed circuit 1 |
| 14–17 | Mixed circuit 2 |
| 18–21 | Mixed circuit 3 |

### Attached device registers

| IDs | Description |
|-----|-------------|
| 22–30 | Dehumidifier state (0/1), up to 9 |
| 31–35 | Pump state (0/1), up to 5 |

## TypeScript Configuration

- Module system: `nodenext` (Node.js native ESM) — imports need `.js` extensions even for `.ts` sources
- Strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` enabled
- Output: `./dist`, source maps enabled
