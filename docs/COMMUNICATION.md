# MQTT and WebSocket messages

## Device to backend: MQTT

The device publishes to dsms/<deviceCode>/readings with QoS 1 and retain=false.

Example payload shape (values below are illustrative, not measured):

```json
{
  "deviceId": "DOC-ROOM-01",
  "readingUid": "unique-measurement-id",
  "temperatureC": 28.5,
  "humidityPercent": 68.2,
  "waterDetected": false
}
```

deviceId is the public Device.deviceCode, not the database integer ID. The backend checks that the device exists, is enabled and matches the topic.

Use a fresh readingUid per measurement and reuse it only when retrying that same measurement. An identical retry is ignored; changing values under an existing ID is rejected. Without readingUid, deduplication is unavailable.

Accepted values: temperature -20 to 80 C, humidity 0 to 100%, Boolean water state. The backend rejects invalid JSON, unexpected fields, oversized messages and retained replays.

The firmware publishes each valid DHT22 sample and wet/dry changes using the latest valid DHT22 values. If the latest DHT22 sample is invalid or out of the backend's accepted range, publishing pauses and the local water alarm continues. The ESP32 uses an in-memory MQTT outbox for delivery retries. It does not create a durable backlog while disconnected.

## Backend to browser: WebSocket

Connect to /ws. Browser requests use this envelope:

```json
{
  "type": "dashboard.get",
  "requestId": "request-1",
  "payload": { "deviceCode": "DOC-ROOM-01" }
}
```

| Request | Response | Payload returned |
| --- | --- | --- |
| dashboard.get | dashboard.snapshot | Device, latest reading, open alerts, risk, freshness and monitoringRules |
| readings.get | readings.result | deviceCode and items array |
| alerts.get | alerts.result | deviceCode and items array |

History requests accept optional from/to ISO timestamps and limit (1-500; default 100). Results are newest first. Responses echo requestId.

The server also pushes:

- reading.created: deviceCode and the saved reading.
- alert.changed: deviceCode and the full saved alert.
- dashboard.snapshot: updated summary after a saved reading.
- device.status: deviceCode, receivedAt and connectivity.

Errors contain type=error, requestId and an error code/message. SQL, passwords and stack traces are not sent to the browser.

monitoringRules comes from backend configuration. React displays these settings; alert qualification stays on the backend.

## Reconnection and missing data

The frontend reloads snapshot/history after reconnecting. Requests time out after 15 seconds; connection retries back off to 30 seconds. A snapshot request every 30 seconds checks responsiveness. No REST polling is used.

NO_DATA means no reading has been saved. STALE/OFFLINE are based on the age of the latest accepted reading. The dashboard connection and device freshness are separate. Open alerts remain open when readings stop.

There is no durable browser replay or device offline buffer. An MQTT acknowledgment alone does not prove that PostgreSQL saved a measurement.

## Security

- Separate broker accounts for the device and backend.
- Topic permissions restrict each publisher to its own device topic.
- Exact browser Origin checks, payload limits, request limits and bounded history queries.
- Credentials stay out of frontend code and Git.
- MQTT TLS and WSS are required across untrusted networks.
- The dashboard has no user login; use it on a controlled private network. Origin checks are not authentication.
