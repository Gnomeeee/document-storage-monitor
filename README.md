# Document Storage Monitor

Monitors temperature, humidity and water in a school records room.

```text
ESP32 -> MQTT broker -> backend -> PostgreSQL
                          |
                       WebSocket
                          |
                     React dashboard
```

The dashboard displays readings received by the backend. It does not generate sample values. No readings means an empty state, not zero or normal.

## Folders

| Folder | Purpose |
| --- | --- |
| backend/ | Receives readings, saves them and checks alerts |
| frontend/ | Displays readings, history and device status |
| firmware/ | ESP32 sensor and buzzer code |
| docs/ | Requirements, database design and project explanation |

## Start here

1. [Backend setup](backend/README.md): database, broker and server.
2. [Frontend setup](frontend/README.md): dashboard and deployment URL.
3. [Code walkthrough](docs/DEVELOPMENT_GUIDE.md): which files to read and how a reading moves through the system.
4. [Message formats](docs/COMMUNICATION.md): MQTT and WebSocket contracts.

## Current hardware status

The backend and dashboard support live MQTT readings. The ESP32 firmware still needs Wi-Fi/MQTT publishing and the agreed humidity timers. Connecting a USB cable alone does not send measurements to the dashboard.

The seed script creates a Device record only. Test data belongs in a separate test database/broker. Existing database rows are not deleted by the application, and the current schema does not identify whether a publisher was a physical device or a test script.
