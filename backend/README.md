# Backend

Node.js, Express, Prisma and PostgreSQL. MQTT receives device readings. WebSocket sends dashboard data.

## Setup

Use Node.js 22.12 or newer and a running PostgreSQL database.

From backend/:

```powershell
npm.cmd ci
npm.cmd run db:generate
```

Create .env from .env.example if needed. Preserve an existing .env. Set:

- DATABASE_URL: PostgreSQL connection string.
- MQTT_URL: broker address.
- MQTT_USERNAME and MQTT_PASSWORD: backend broker account.
- CLIENT_URL: browser origin, usually http://localhost:5173.
- ALLOWED_ORIGINS: optional comma-separated origins if more than one browser address is used.

Review and apply pending migrations, then register DOC-ROOM-01:

```powershell
npm.cmd run db:validate
npm.cmd run db:status
npm.cmd run db:deploy
npm.cmd run db:seed
```

The seed registers the device; it does not create readings. Do not reset the database to bypass a migration error.

## MQTT broker

Install Mosquitto separately. The npm mqtt package is a client, not the broker.

From backend/, with the Mosquitto executables on PATH:

```powershell
mosquitto_passwd -c broker/passwords dsms_backend
mosquitto_passwd broker/passwords DOC-ROOM-01
mosquitto -c broker/mosquitto.conf -v
```

Use -c only for the first creation of the password file. It overwrites an existing file. On Windows, if the commands are not found, use the full executable path, such as:

```powershell
& "C:\Program Files\mosquitto\mosquitto.exe" -c broker/mosquitto.conf -v
```

The backend account can subscribe to readings. The device account can publish only to its own topic. Keep the accounts separate. broker/passwords is ignored by Git.

The example broker binds to loopback. For physical ESP32 access, configure a reachable private LAN address and firewall access. The ESP32 uses that address, not localhost.

## Run

```powershell
npm.cmd run dev
```

Use npm.cmd start without auto-reload. GET /api/v1/health returns 200 when PostgreSQL and the broker subscription are available, otherwise 503. Dashboard requests use /ws, not REST routes.

See [the code walkthrough](../docs/DEVELOPMENT_GUIDE.md) for folder responsibilities and [the communication contract](../docs/COMMUNICATION.md) for message fields.

## Checks

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run db:validate
```

For database/MQTT integration, set TEST_DATABASE_URL to a development database whose role can create schemas, then run npm.cmd run test:integration. It creates and removes an isolated test schema and temporary broker. It does not change application tables.

scripts/simulate-device.js is an optional test publisher. It is not started by the server. Use it only with a test database/broker; npm.cmd run simulate -- wet publishes artificial test values.

## Deployment

Run one backend process. Set HOST to the intended listening address and ALLOWED_ORIGINS to the exact frontend origin. Use MQTT TLS and WSS outside a trusted LAN. The dashboard is read-only and has no user login; Origin checks are not user authentication.

Keep .env, broker passwords and keys out of Git. Commit prisma/schema.prisma and migrations. Generated Prisma files and node_modules stay ignored.

Broker delivery acknowledgment does not guarantee a database save. There is no device offline buffer or durable browser event replay. The dashboard reloads saved state after reconnecting.
