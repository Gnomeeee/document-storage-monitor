import { config } from "dotenv";
import mqtt from "mqtt";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { readingSchema } from "../src/validators/messages.js";
import { defaultRules } from "../src/config/monitoring.js";
config({ quiet: true });
const scenario = process.argv[2] ?? "normal";
const presets = {
  normal: [50, false],
  warning: [defaultRules.humidityWarningPercent, false],
  critical: [defaultRules.humidityCriticalPercent, false],
  humidity: [defaultRules.humidityCriticalPercent, false],
  wet: [50, true],
  dry: [50, false],
  both: [defaultRules.humidityCriticalPercent, true],
  recovery: [50, false],
};
if (
  !presets[scenario] ||
  !process.env.SIM_MQTT_USERNAME ||
  !process.env.SIM_MQTT_PASSWORD
) {
  console.error(
    "Use normal|warning|critical|humidity|wet|dry|both|recovery; configure SIM_MQTT_USERNAME and SIM_MQTT_PASSWORD.",
  );
  process.exit(1);
}
const code = process.env.SIM_DEVICE_CODE ?? "DOC-ROOM-01";
const [humidityPercent, waterDetected] = presets[scenario];
const payload = readingSchema.parse({
  deviceId: code,
  readingUid: process.env.SIM_READING_UID || randomUUID(),
  temperatureC: 28.5,
  humidityPercent,
  waterDetected,
});
const client = mqtt.connect(process.env.MQTT_URL ?? "mqtt://127.0.0.1:1883", {
  username: process.env.SIM_MQTT_USERNAME,
  password: process.env.SIM_MQTT_PASSWORD,
  clientId: `sim-${randomUUID()}`,
  reconnectPeriod: 0,
  connectTimeout: 10000,
  ...(process.env.MQTT_CA_FILE ? { ca: readFileSync(process.env.MQTT_CA_FILE) } : {}),
});
const timer = setTimeout(() => {
  console.error("Publish timed out.");
  client.end(true);
  process.exitCode = 1;
}, 15000);
client.on("error", () => {
  console.error("Broker connection failed.");
  clearTimeout(timer);
  client.end(true);
  process.exitCode = 1;
});
client.once("connect", () =>
  client.publish(
    `dsms/${code}/readings`,
    JSON.stringify(payload),
    { qos: 1, retain: false },
    (error) => {
      clearTimeout(timer);
      if (error) {
        console.error("Publication failed.");
        process.exitCode = 1;
      } else
        console.log(
          `Broker acknowledged ${scenario} reading ${payload.readingUid}; verify persistence separately.`,
        );
      client.end();
    },
  ),
);
