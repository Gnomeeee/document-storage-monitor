import mqtt from "mqtt";
import { readFileSync } from "node:fs";
import { parseReading } from "../validators/messages.js";
import { publicError } from "../lib/errors.js";

export function connectMqtt({
  env,
  queue,
  readings,
  dashboard,
  broadcast,
  logger = console,
}) {
  const state = {
    connected: false,
    subscribed: false,
    lastError: null,
    accepted: 0,
    duplicates: 0,
    rejected: 0,
  };
  const client = mqtt.connect(env.MQTT_URL, {
    username: env.MQTT_USERNAME,
    password: env.MQTT_PASSWORD,
    clientId: env.MQTT_CLIENT_ID,
    clean: true,
    protocolVersion: 4,
    keepalive: 30,
    reconnectPeriod: 2000,
    connectTimeout: 10000,
    ...(env.MQTT_CA_FILE ? { ca: readFileSync(env.MQTT_CA_FILE) } : {}),
  });
  client.on("connect", () => {
    state.connected = true;
    client.subscribe("dsms/+/readings", { qos: 1 }, (error, grants) => {
      state.subscribed =
        !error && grants?.length === 1 && grants[0].qos !== 128;
      state.lastError = state.subscribed ? null : "SUBSCRIPTION_FAILED";
    });
  });
  client.on("close", () => {
    state.connected = false;
    state.subscribed = false;
  });
  client.on("error", () => {
    state.lastError = "BROKER_ERROR";
  });
  let windowStart = Date.now(),
    count = 0;
  client.on("message", (topic, bytes, packet) => {
    if (Date.now() - windowStart > 60000) {
      windowStart = Date.now();
      count = 0;
    }
    if (++count > 600) {
      state.rejected++;
      state.lastError = "RATE_LIMITED";
      return;
    }
    let reading;
    try {
      reading = parseReading(topic, bytes, packet.retain);
    } catch (error) {
      state.rejected++;
      state.lastError = publicError(error).code;
      return;
    }
    queue
      .run(async () => {
        const result = await readings.ingest(reading);
        if (result.duplicate) {
          state.duplicates++;
          return;
        }
        state.accepted++;
        state.lastError = null;
        broadcast("reading.created", {
          deviceCode: reading.deviceId,
          reading: result.reading,
        });
        for (const alert of result.alerts)
          broadcast("alert.changed", { deviceCode: reading.deviceId, alert });

        try {
          const snapshot = await dashboard.snapshot(reading.deviceId);
          broadcast("dashboard.snapshot", snapshot);
        } catch {
          logger.warn(
            "Dashboard refresh unavailable; request a fresh snapshot on reconnect.",
          );
        }
      })
      .catch((error) => {
        state.rejected++;
        state.lastError = publicError(error).code;
        logger.warn(`MQTT ingestion failed: ${state.lastError}`);
      });
  });
  let closing;
  return {
    state,
    client,
    close: () =>
      (closing ??= new Promise((resolve) => client.end(true, {}, resolve))),
  };
}
