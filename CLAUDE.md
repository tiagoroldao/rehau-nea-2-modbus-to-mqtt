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

The project is in early development. The intended data flow is:

```
REHAU NEA SMART 2.0
      ↕ Modbus TCP (port 502, unit 241)
  modbus-test.ts  (TCP server, register map below)
      ↕
  dpt9001.ts      (DPT 9.001 temperature encoding/decoding)
      ↕
  mqtt-test.ts    (MQTT client → Home Assistant)
      ↕ MQTT topics: homeassistant/climate/rehau_<id>/...
  Home Assistant
```

**`src/main.ts`** — entry point, currently empty; integration logic goes here.

**`src/tests`** — files used to test MQTT/Modbus functionality - these should be used as reference only

**`src/tests/modbus-test.ts`** — Modbus TCP test server using `modbus-serial`. To be used only as reference Defines the register map:
- Unit ID: 241
- Holding registers 100–199: room data per-room (operation mode, set temperature, humidity)
- Temperature values are in centidegrees (2000 = 20°C)
- Operation modes: Normal=0, Reduced=1, Standby=2, Automatic=3, Party=4, Holiday/Absence=5
- Read queries currently throw "Not answering queries" (stub)

**`src/tests/mqtt-test.ts`** — MQTT client (mqtt@5) connecting to `homeassistant.local:8883`. Publishes Home Assistant MQTT Discovery payloads. See `example-mqtt/cucina.json` for the canonical discovery config shape for a climate entity.

**`src/dpt9001.ts`** — DPT 9.001 decoder: values >2048 are negative offsets. Formula: values ≤2048 → `value/100`°C; values >2048 → `((value-2048)*2)/100`°C (e.g., 3098 → 21.0°C).

## TypeScript Configuration

- Module system: `nodenext` (Node.js native ESM) — imports need `.js` extensions even for `.ts` sources
- Strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` enabled
- Output: `./dist`, source maps enabled
