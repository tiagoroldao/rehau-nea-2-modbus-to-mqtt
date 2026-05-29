# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

A TypeScript gateway that bridges a **REHAU NEA SMART 2.0** heating/room-control system (via Modbus TCP) with **MQTT** for Home Assistant integration. It sets up a Modbus TCP server (slave) that the REHAU system connects to as master. All connection settings are in `src/config.ts`.

## Commands

```bash
# Run the app directly (no build step needed)
npx ts-node src/main.ts

# Build to dist/
npx tsc

# Install dependencies
yarn install
```

No test or lint scripts are configured yet.

## Architecture

### Data flow

```
REHAU NEA SMART 2.0
      ↕ Modbus TCP (slave on configured host:port, unit ID)
  ModbusServer.ts
      ↕ RoomUpdate events (created | mode | setpoint | temperature | humidity)
  MqttClient.ts
      ↕ MQTT  homeassistant/climate/rehau_room_{id}/{subtopic}
  Home Assistant
```

- **Modbus → MQTT**: When REHAU writes registers, `setRegister` returns typed `RoomUpdate[]`. The server fires `onRoomUpdate` for each, triggering the MQTT client to publish to the corresponding topic.
- **MQTT → Modbus**: Command messages update `RehauData` directly. REHAU picks up changes on its next read cycle.

### Key source files

**`src/main.ts`** — entry point. Creates `RehauConnection`, starts both services, wires the `onRoomUpdate` callback from MQTT client to Modbus server, handles `SIGINT`/`SIGTERM`.

**`src/RehauData.ts`** — all shared data types:
- `RehauConnection` — config (`installationName`, `modbusAddress`) + live `data`
- `RehauData` — live state: global mode/status, outside temperatures, rooms array
- `RehauRoom` — per-room: `id`, `mode` (RehauOperationStatus), `setpoint`, `temperature`, `humidity`
- `RoomUpdate` — discriminated union of update events fired by `setRegister`
- `EMPTY_*` constants — sentinel values REHAU recognises as "no data yet", triggering a write-back
- Enum values match Modbus wire values (1-based); `Null = 10` is the empty sentinel

**`src/ModbusServer.ts`** — Modbus TCP server using `modbus-serial`:
- `setRegister(data, addr, value): RoomUpdate[]` — updates a single register; returns `[{kind:'created'}, {kind:fieldType}]` for new rooms, `[{kind:fieldType}]` for existing ones, `[]` for global registers
- `startModbusServer(connection, host, port, onRoomUpdate?)` — starts server, calls `onRoomUpdate` for every update from `setRegisterArray`
- `getHoldingRegister` creates rooms with default values on first read (REHAU probing)

**`src/MqttClient.ts`** — MQTT client using `mqtt`:
- `startMqttClient(connection)` returns `{ stop, onRoomUpdate }`
- `onRoomUpdate` publishes to the specific topic matching the update kind; `created` publishes discovery config + availability
- Subscribes to `{mqttTopic}/#`; ignores messages for unknown rooms or rooms with empty (uninitialized) data

**`src/mqttDiscovery.ts`** — MQTT topic constants (`TOPIC_*`), `parseRoomTopic`, `getRoomBaseTopic`, and `createRoomMqttConfig` (builds Home Assistant MQTT discovery payload)

**`src/modbusConstants.ts`** — all Modbus register address constants (`REG_*`, `ROOM_OFFSET_*`, `ROOM_BASE`, `MIN/MAX_SETPOINT_CELCIUS`)

**`src/dpt9001.ts`** — DPT 9.001 encoder/decoder. Values ≤2048 → `value/100`°C; values >2048 → `((value-2048)*2)/100`°C.

**`src/experiments/`** — reference-only scripts for Modbus and MQTT. Do not use as production code.

## MQTT topic structure

Entity ID format: `{installationName}_room_{roomId}` (e.g. `rehau_room_1`)
Base topic: `{mqttTopic}/{entityId}` (e.g. `homeassistant/climate/rehau_room_1`)

Subtopics: `config`, `availability`, `current_temperature`, `target_temperature`, `temperature_command`, `current_humidity`, `mode`, `mode_command`, `preset`, `preset_command`

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

Address formula: `N = roomId × 100` (roomId is 1-based, matches `RehauRoom.id`).

| Offset | Example addresses | Description | Access | Encoding |
|--------|-------------------|-------------|--------|----------|
| YY00 | 100, 200, …, 6000 | Local operation status | R/W | RehauOperationStatus (1-based) |
| YY01 | 101, 201, …, 6001 | Set temperature | R/W | DPT 9.001 |
| YY02 | 102, 202, …, 6002 | Actual zone temperature | R | DPT 9.001 |
| YY10 | 110, 210, …, 6010 | Relative humidity | R | 0–100 % |

**Master/slave room zone layout**:
- Master RZ 1–12: `1xx`–`12xx`
- Slave 1 RZ 1–12: `13xx`–`24xx`
- Slave 2: `25xx`–`36xx` (and so on, up to 5 slaves)

### Mixed circuit registers (IDs 10–21)

Each circuit has 4 registers: opening %, pump state, flow temp (DPT 9.001), return temp (DPT 9.001).

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
