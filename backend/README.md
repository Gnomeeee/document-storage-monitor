# DSMS backend

Node.js/Express + Prisma/PostgreSQL, MQTT ingestion and **plain WebSocket** dashboard communication. The browser uses the built-in WebSocket API, not Socket.IO. No frontend or ESP32 networking changes are included here.

## Requirements and implementation status

- Node.js >=22.12 (verified on 24.22.1), npm and PostgreSQL (project uses Prisma 7.10.1).
- An authenticated MQTT 3.1.1-compatible broker. `broker/` contains an Eclipse Mosquitto configuration/ACL example; Mosquitto is a separate executable/service, not installed by npm.
- Three existing entities: Device, SensorReading and Alert. The initial migration is preserved. A follow-up migration adds one-open-alert uniqueness, measurement checks and clearance consistency.
- Tests use a temporary authenticated Aedes broker. This does not install or verify your actual Mosquitto service or physical device.
- Run one backend process for this single-room prototype. Its shared bounded queue orders ingestion, snapshots and pushes. Multi-instance broadcast coordination is outside scope.

## Source layout

```text
src/server.js        process entry point and shutdown signals
src/runtime.js       wires database, MQTT, WebSocket and freshness timer
src/app.js           Express health endpoint
src/config/          environment validation and Prisma adapter
src/mqtt/            broker connection and telemetry subscription
src/websocket/       dashboard requests and device-scoped live events
src/services/        reading transactions, alert rules and dashboard queries
src/validators/      incoming message schemas
src/lib/             shared errors and bounded processing queue
prisma/              schema, migrations and device seed
broker/              Mosquitto configuration and topic permissions
scripts/             software device simulator and syntax checker
tests/               unit/socket tests; integration/ uses real PostgreSQL
```

## Setup (run from backend/)

```powershell
npm ci
npm run db:generate
```

If npm.ps1 is blocked by PowerShell policy, use `npm.cmd` with the same arguments. No transpilation build is needed: this backend is JavaScript ESM.

Create `.env` from `.env.example` only if it does not already exist. Otherwise merge the missing variables; preserve your real DATABASE_URL. The implementation did not overwrite your .env. Required values: DATABASE_URL, MQTT_USERNAME and MQTT_PASSWORD. PORT defaults to 3000, HOST to 127.0.0.1, broker URL to mqtt://127.0.0.1:1883. ALLOWED_ORIGINS is a comma-separated list of exact browser origins, or defaults to existing CLIENT_URL / http://localhost:5173. No wildcard Origin is accepted.

Database setup:

```powershell
npm run db:validate
npm run db:status
npm run db:deploy
npm run db:seed
```

`db:deploy` applies pending migrations to the configured database. Review the SQL first, especially if there is existing data; inconsistent data causes the new constraints to fail rather than being deleted. The implementation tests migrations in an isolated temporary schema and does not automatically apply them to your application tables. Do not edit the old migration or use reset to bypass a failure. `db:seed` registers DOC-ROOM-01 without changing an existing device's location or enabled setting.

The config filename is `prisma7.config.ts`; npm scripts pass it explicitly. The generated client lives at src/generated/prisma and stays ignored by Git.

Commit schema, migrations, source, package manifests and .env.example. Keep actual .env, broker/passwords, generated Prisma output and node_modules private/generated. This repository already tracks files under backend/node_modules; .gitignore does not untrack them. Remove those from Git's index when preparing repository cleanup (the implementation has not staged or committed files).

## MQTT broker

Install Mosquitto using its official distribution, then from backend/ create local password entries (commands prompt for passwords):

```powershell
mosquitto_passwd -c broker/passwords dsms_backend
mosquitto_passwd broker/passwords DOC-ROOM-01
mosquitto -c broker/mosquitto.conf -v
```

Use `-c` only when creating a NEW password file: it overwrites an existing file. For subsequent password changes, omit `-c`. Keep `broker/passwords` out of Git. Set MQTT_USERNAME=dsms_backend and its password in .env; simulator/device uses DOC-ROOM-01 and its own password, never the backend account.

The ACL lets the backend read dsms/+/readings and lets DOC-ROOM-01 write only dsms/DOC-ROOM-01/readings. Devices cannot subscribe with this ACL because no device commands are implemented. Configure another explicit user/topic rule if registering a different device.

The broker example binds loopback for local development. To connect a physical ESP32, deliberately bind the broker to the laptop's private LAN address and restrict the firewall to the intended network. The ESP32 targets that LAN address, not localhost. For remote dashboard access, similarly change backend HOST and the allowed browser origins. Public deployment/staff authentication is not implemented. Use MQTT TLS/WSS (with a properly configured TLS proxy for WebSocket) before crossing untrusted networks; MQTT_CA_FILE supports a private broker CA without disabling certificate verification.

## Run and inspect

```powershell
npm run dev
```

Or `npm start` without auto-reload. On startup the backend checks PostgreSQL/model availability; broker connection/subscription runs with retries. Health is at `http://localhost:3000/api/v1/health`: 200 when database and MQTT subscription are available, 503 otherwise. Database health is checked per request; MQTT connected alone is insufficient. Safe ingestion counters are returned, not secrets. HTTP is diagnostic only; no REST reading ingestion or history routes are introduced.

## Device message contract

Topic: `dsms/DOC-ROOM-01/readings`; QoS 1, retain=false.

```json
{
  "deviceId": "DOC-ROOM-01",
  "readingUid": "measurement-unique-id",
  "temperatureC": 28.5,
  "humidityPercent": 68.2,
  "waterDetected": false
}
```

Payload deviceId is the public deviceCode; the backend resolves the internal integer key. Broker credentials/ACLs authenticate and restrict publishers; backend then checks topic/payload agreement and active registration. Allowed device codes use letters, digits, underscores and hyphens (1..64). readingUid is 1..64 characters when provided. Retained replays, payloads over 4096 bytes, unknown fields, nonfinite values, RH outside 0..100 and temperature outside -20..80 C are rejected. Temperature limits follow the proposed SRS validation range, not the DHT's entire nominal range.

Duplicate (deviceId, readingUid) with the same measurements is ignored without changing receivedAt, incident timers or live events. Reusing an ID with different measurements is rejected. Omitting readingUid is supported by the schema but forfeits deduplication; production publishers should always supply it.

The backend transaction locks the device, inserts the reading and updates incidents atomically. It broadcasts only after commit. Humidity qualification: >=60% for 30 minutes gives WARNING, >=65% for 15 minutes gives CRITICAL. Severity never downgrades within an incident. Recovery: RH <58% for 10 minutes; water dry for 10 seconds. Wet reports open WATER CRITICAL immediately (physical noise confirmation belongs on the device). Water and humidity incidents are independent. Only received observations advance duration rules; a gap >180 seconds resets qualifying streaks. Silence never clears an incident.

Timers reconstruct from recent persisted readings after restart (up to 10,000 records over the longest rule window plus gap). This is a conservative bound: unusually high message rates can delay qualification. Ingestion is capped at 600 incoming messages/minute overall, appropriate to the single-device scope. Threshold durations can be overridden using the documented .env variables for controlled tests; retain defaults for actual evaluation. The existing firmware still needs its timed warning behavior aligned separately.

## WebSocket contract

Connect to `ws://localhost:3000/ws` from an allowed browser origin. Binary messages are rejected; JSON messages are limited to 8192 bytes, 60 requests/minute and five pending requests per socket. Default connection limit is 30. The server uses ping/pong heartbeat and disconnects slow clients with excessive buffered output. This is a read-only trusted-LAN dashboard, not an authenticated public service. Origin checks are not user authentication.

First send:

```json
{"type":"dashboard.get","requestId":"request-1","payload":{"deviceCode":"DOC-ROOM-01"}}
```

Response type is dashboard.snapshot, with the same requestId and payload containing device, latest (or null), activeAlerts, environmentalRisk and connectivity. This also subscribes that socket to live events for that device. A subsequent dashboard.get switches the selected device after its snapshot succeeds.

History:

```json
{"type":"readings.get","requestId":"request-2","payload":{"deviceCode":"DOC-ROOM-01","limit":100}}
```

Use alerts.get for incidents. Responses are readings.result / alerts.result with payload `{deviceCode, items}`. Optional from/to are ISO 8601 timestamps with timezones. Limit defaults to 100 and is capped at 500. Results are newest-first, ordered by timestamp then ID; reverse for ascending charts. Requests are independently correlated by requestId.

Pushes (no requestId):

- reading.created: payload `{deviceCode, reading}`.
- alert.changed: payload `{deviceCode, alert}` containing the full updated incident.
- dashboard.snapshot: refreshed derived summary after an accepted reading; includes deviceCode as well as the snapshot fields.
- device.status: payload `{deviceCode, receivedAt, connectivity}` when freshness changes without new readings.

Errors: `{type: "error", requestId, error: {code, message}}`; malformed/unidentifiable requests use null requestId. Errors never expose SQL, stack traces or credentials.

React should request snapshot and relevant history on every connection/reconnection, retry connections with backoff and give requests a timeout (e.g. 15 seconds). The shared server queue ensures a snapshot is sent before subsequent committed pushes; do not cache an old response over newer events in the UI. There is no durable event replay. WebSocket connectivity and device freshness are separate: NO_DATA before first reading, STALE after 180 seconds, OFFLINE after 300 seconds. isActive is ingestion permission, not online status.

## Simulator

Set SIM_MQTT_USERNAME=DOC-ROOM-01 and SIM_MQTT_PASSWORD to the device broker password. Each command publishes one reading and exits:

```powershell
npm run simulate -- normal
npm run simulate -- wet
npm run simulate -- recovery
npm run simulate -- humidity
```

`warning` (62% RH), `critical` (66% RH), `dry` and `both` are also supported. `humidity` aliases critical readings; `recovery` aliases dry normal readings. SIM_READING_UID can hold a fixed ID to exercise retries; otherwise a fresh UUID is generated. One humidity publication does not satisfy a 15/30-minute rule. Publish repeated observations at intervals shorter than GAP_AFTER_MS, or deliberately shorten duration settings for a labeled software test. Water clearance similarly requires dry observations spanning at least 10 seconds; with a 60-second telemetry interval it clears on the next qualifying dry report. Broker acknowledgment only confirms transport; verify the database/dashboard separately.

## Verification

```powershell
npm run check
npm test
npm run db:validate
```

`check` runs Node syntax checks on application/scripts/tests; there is no separate formatter/linter dependency. Unit tests cover qualification/recovery/gaps, validation, queue limits, config redaction, and a real loopback WebSocket connection with Origin and ordering checks. `*.test.js` files use Node's built-in test runner. Local network access is required for the socket test.

The implementation-time `npm audit` reported two moderate development-dependency findings through existing nodemon/minimatch. A forced dependency downgrade was not applied. `npm start` does not use nodemon; review the audit again before deployment.

For PostgreSQL/MQTT/WebSocket integration, put TEST_DATABASE_URL in your private .env pointing to a development/test database whose role can create schemas, then run:

```powershell
npm run test:integration
```

Without TEST_DATABASE_URL the test is explicitly skipped. It creates an isolated `dsms_test_<random>` schema, applies the migration SQL there, starts an authenticated temporary Aedes broker and actual backend on loopback ephemeral ports, and removes only that schema on completion. It tests persistence, concurrent deduplication, constraints, device rejection, actual MQTT/WebSocket delivery, history, reconnect and freshness. It does not modify application tables or establish hardware accuracy. A forced process termination can leave a test schema that should be inspected before manual cleanup.

## Remaining deployment boundaries

- Start/configure the real broker and supply credentials; npm does not install its service.
- Apply the follow-up migration and register the real device intentionally.
- No offline device buffer or application-level MQTT storage acknowledgment is implemented. Broker ACK does not guarantee a PostgreSQL commit; outages can lose readings and will produce stale data. Health/counters/logs expose failures, without fabricating measurements.
- No frontend implementation, physical upload or buzzer wiring changes are part of this backend task.
- Read-only trusted-LAN access only; no user accounts, remote device commands, SMS or extra entities.

Sources: [MQTT.js](https://github.com/mqttjs/MQTT.js), [ws](https://github.com/websockets/ws), [Mosquitto](https://mosquitto.org/documentation/), [Prisma 7](https://www.prisma.io/docs/orm/v7).
