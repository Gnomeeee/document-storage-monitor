import mqtt from "mqtt";
import { readFileSync } from "node:fs";
import { parseReading } from "./validators/messages.js";
import { publicError } from "./utils/errors.js";

export function createMqttState() {
  return {
    connected: false,
    subscribed: false,
    lastError: null,
    accepted: 0,
    duplicates: 0,
    rejected: 0,
  };
}

export function connectMqtt({
  env,
  state = createMqttState(),
  queue,
  readings,
  dashboard,
  broadcast,
  logger = console,
}) {
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
      state.subscribed = !error && grants?.length === 1 && grants[0].qos !== 128;
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
  let windowStart = Date.now();
  let messageCount = 0;

  function rejectReading(code) {
    state.rejected++;
    state.lastError = code;
  }

  async function saveAndBroadcast(reading) {
    const result = await readings.ingest(reading);
    if (result.duplicate) {
      state.duplicates++;
      return;
    }

    state.accepted++;
    state.lastError = null;
    const deviceCode = reading.deviceId;
    broadcast("reading.created", { deviceCode, reading: result.reading });

    for (const alert of result.alerts) {
      broadcast("alert.changed", { deviceCode, alert });
    }

    try {
      const snapshot = await dashboard.snapshot(deviceCode);
      broadcast("dashboard.snapshot", snapshot);
    } catch {
      logger.warn(
        "Dashboard refresh unavailable; request a fresh snapshot on reconnect.",
      );
    }
  }

  client.on("message", (topic, bytes, packet) => {
    if (Date.now() - windowStart > 60000) {
      windowStart = Date.now();
      messageCount = 0;
    }

    messageCount++;
    if (messageCount > 600) {
      rejectReading("RATE_LIMITED");
      return;
    }

    let reading;
    try {
      reading = parseReading(topic, bytes, packet.retain);
    } catch (error) {
      rejectReading(publicError(error).code);
      return;
    }

    queue
      .run(() => saveAndBroadcast(reading))
      .catch((error) => {
        rejectReading(publicError(error).code);
        logger.warn(`MQTT ingestion failed: ${state.lastError}`);
      });
  });

  let closing;
  function close() {
    if (!closing) {
      closing = new Promise((resolve) => client.end(true, {}, resolve));
    }
    return closing;
  }

  return { state, client, close };
}
