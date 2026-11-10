# DSMS development guide

The agreed architecture is **ESP32 -> MQTT broker -> Node.js/Express -> PostgreSQL**, with **WebSocket between React and the backend**. The feature scope remains readings, local warnings, incident/history display and connectivity. See [COMMUNICATION.md](COMMUNICATION.md) for the proposed topic, payload, events and reconnect behavior.

## Current implementation

- Firmware: PlatformIO ESP32 Arduino C++ local prototype; GPIO4 DHT22, GPIO27 water input, GPIO26 passive simulated buzzer. No Wi-Fi/MQTT ingestion yet. Current RH >=60% immediate alarm is not the SRS timed qualification rule.
- Backend: Prisma 7.10.1 packages, JavaScript ESM, three models and initial migration. Express app/server are not implemented. Migration application must be verified against the configured development database.
- Frontend: React/Vite starter; no WebSocket dashboard yet.
- Broker service and MQTT/WebSocket libraries: not configured/installed. No running integration is claimed.

## Build one complete flow

1. Verify local PostgreSQL connection, review existing migration state and register DOC-ROOM-01. Add the remaining integrity constraints through a follow-up migration (see ERD).
2. Select and configure an MQTT broker, per-device credentials, authorized topic ACLs, and a backend subscriber account. Keep credentials out of Git/frontend. Broker product is still a choice; Eclipse Mosquitto is one option to evaluate.
3. Implement backend MQTT message handling with Zod validation, topic/code matching, device lookup and readingUid deduplication. Keep processing in a shared ingestion service rather than transport callbacks alone.
4. Publish one simulated reading through a temporary Node.js MQTT script. Verify its persisted values before building UI logic.
5. Implement transactional incident creation/escalation/clearance, qualification and missing-data rules. Use controlled-clock tests for duration rules.
6. Implement WebSocket snapshot/history requests and live updates after commit. Add message limits, Origin checks, bounded history, heartbeat, reconnect, and snapshot/event reconciliation.
7. Build React cards, history and incident list against these actual messages. No REST polling or SSE is required for the chosen dashboard transport.
8. Test broker/database outages, duplicates, malformed data and browser reconnection.
9. Separately verify physical modules in Serial Monitor, then add Wi-Fi/MQTT to ESP32 with the same topic/payload contract. Do not block local sensing while reconnecting.

First milestone: **one simulated MQTT reading saved in PostgreSQL**. Next extend it to WebSocket/React, then replace the publisher with the real ESP32.

## Configuration and tooling

Run commands from the component directory containing package.json/platformio.ini. Backend uses Node.js with Prisma 7; check the locked packages' engine requirements when choosing the runtime. The inspected local runtime was Node.js 24.22.1; PlatformIO Core 6.2.0 built the existing firmware in the earlier review. Do not infer hardware or integration success from those checks.

From backend/:

```powershell
npm ci
npx prisma validate --config ./prisma7.config.ts
npx prisma migrate status --config ./prisma7.config.ts
npx prisma generate --config ./prisma7.config.ts
```

The config has a custom filename; keep --config unless it is deliberately renamed to prisma.config.ts. DATABASE_URL comes from backend/.env. The current generator is prisma-client-js with output src/generated/prisma; keep generated imports and the PostgreSQL driver adapter consistent with this setup.

Only when creating the next reviewed development migration:

```powershell
npx prisma migrate dev --name enforce_monitoring_constraints --create-only --config ./prisma7.config.ts
```

Review the generated SQL and add required constraints before applying with migrate dev. Even --create-only may detect drift and request a reset: inspect any such prompt, do not accept it blindly. Never edit an already-applied migration. Runtime database credentials and broker credentials are distinct.

Existing backend `npm run dev` / `npm start` target the not-yet-implemented server. `npm test` is currently a failing placeholder, not a real suite. Add and document meaningful validation/ingestion/incident/socket tests during implementation. No backend build or lint script is currently configured.

From frontend/:

```powershell
npm ci
npm run dev
npm run build
npm run lint
```

There is no frontend test script yet. These commands currently exercise the starter app, not a monitoring dashboard.

From firmware/:

```powershell
pio run -e esp32dev
```

See firmware/README.md for upload/monitor commands and the optional Wokwi scenario. The current simulation requires no broker because networking has not been added.

Proposed configuration names (not already wired into code): MQTT_URL, MQTT_USERNAME, MQTT_PASSWORD, PORT, ALLOWED_ORIGIN in backend; VITE_WS_URL in frontend; broker host/port and separate device credentials in private firmware configuration. Never place credentials in VITE_ variables.

## Communication libraries and structure

Choose one compatible browser/server combination: plain WebSocket (browser built-in API plus a server implementation), or Socket.IO on both sides. Socket.IO has its own wire protocol. For a strictly WebSocket transport requirement configure Socket.IO accordingly if selected. MQTT client choices must support the proposed publish QoS and nonblocking reconnect behavior. Do not install multiple competing transports just because examples mention them.

Suggested new modules when implementing (not existing files):

```text
backend/src/mqtt/           broker connection and subscription handlers
backend/src/websocket/     connections, requests and broadcast handling
backend/src/services/      validation, ingestion, incidents and queries
backend/scripts/           simulated MQTT publisher
backend/tests/             automated contract and behavior tests
frontend/src/services/     one managed WebSocket connection
```

Express can retain a diagnostic HTTP health endpoint and serve static assets; that does not reintroduce REST sensor ingestion. Backend subscribes to telemetry only; remote device control is not included.

## Documentation and checks

- [SRS](SRS.md): requirements, thresholds and acceptance criteria.
- [ERD](ERD.md): actual model names/fields and remaining constraints.
- [Communication](COMMUNICATION.md): architecture, contracts and failure boundaries.
- Preview Mermaid code blocks using a Markdown viewer with Mermaid support.
- Record software-simulator results separately from physical readings. Verify broker permissions, persistence, duplicate handling, history, socket reconnect and independent local buzzer operation.

References: [MQTT](https://mqtt.org/), [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API), [Prisma 7](https://www.prisma.io/docs/orm/v7), [Socket.IO](https://socket.io/docs/v4/).
