import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import mqtt from "mqtt";
import { deviceCode as deviceCodeSchema } from "../src/validators/messages.js";
import { createSerialReadingParser } from "./usb-telemetry.js";

config({ quiet: true });

const port = (process.argv[2] || "COM3").toUpperCase();
const deviceCode =
  process.env.DEVICE_CODE || process.env.SIM_DEVICE_CODE || "DOC-ROOM-01";
const username = process.env.DEVICE_MQTT_USERNAME || process.env.SIM_MQTT_USERNAME;
const password = process.env.DEVICE_MQTT_PASSWORD || process.env.SIM_MQTT_PASSWORD;

if (process.platform !== "win32" || !/^COM[1-9][0-9]*$/.test(port)) {
  console.error("Run the USB bridge on Windows with a port such as COM3.");
  process.exit(1);
}
if (!deviceCodeSchema.safeParse(deviceCode).success || !username || !password) {
  console.error("Set the device code and device MQTT credentials in backend/.env.");
  process.exit(1);
}

const reader = spawn(
  process.env.PIO_PYTHON ||
    join(homedir(), ".platformio", "penv", "Scripts", "python.exe"),
  [fileURLToPath(new URL("read-serial.py", import.meta.url)), port],
  { stdio: ["ignore", "pipe", "inherit"], windowsHide: true },
);
const client = mqtt.connect(process.env.MQTT_URL || "mqtt://127.0.0.1:1883", {
  username,
  password,
  clientId: `dsms-usb-${randomUUID()}`,
  protocolVersion: 4,
  reconnectPeriod: 2000,
  ...(process.env.MQTT_CA_FILE ? { ca: readFileSync(process.env.MQTT_CA_FILE) } : {}),
});

console.log(`Reading ESP32 telemetry from ${port}. Press Ctrl+C to stop.`);
client.on("connect", () => console.log(`MQTT connected for ${deviceCode}.`));
client.on("error", (error) =>
  console.error(`MQTT connection error (${error.code ?? "unknown"}).`),
);

const parse = createSerialReadingParser();
const lines = createInterface({ input: reader.stdout });
let pending = 0;
let loggedFirstReading = false;
let closing = false;
lines.on("line", (line) => {
  const reading = parse(line);
  if (!reading || !client.connected || pending >= 8) return;

  const payload = JSON.stringify({
    deviceId: deviceCode,
    readingUid: randomUUID(),
    ...reading,
  });
  pending++;
  client.publish(
    `dsms/${deviceCode}/readings`,
    payload,
    { qos: 1, retain: false },
    (error) => {
      pending--;
      if (error) {
        console.error("MQTT could not send a USB reading.");
      } else if (!loggedFirstReading) {
        loggedFirstReading = true;
        console.log("First complete sensor reading acknowledged by MQTT.");
      }
    },
  );
});

function stop(exitCode = 0) {
  if (closing) return;
  closing = true;
  lines.close();
  reader.kill();
  client.end(true, () => {
    process.exitCode = exitCode;
  });
}

reader.once("error", () => {
  console.error("PlatformIO Python was not found. Set PIO_PYTHON to its full path.");
  stop(1);
});
reader.once("close", (code) => {
  if (code !== null) stop(code);
});
process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());
