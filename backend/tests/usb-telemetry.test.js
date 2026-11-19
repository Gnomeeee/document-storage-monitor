import test from "node:test";
import assert from "node:assert/strict";
import { createSerialReadingParser } from "../scripts/usb-telemetry.js";

test("USB bridge accepts a complete sensor frame and drops faults and partial frames", () => {
  const parse = createSerialReadingParser();
  const lines = [
    "Humidity: 85.0 %",
    "------------------------------",
    "Water detected: NO",
    "Temperature: 28.0 C",
    "------------------------------",
    "Water detected: YES",
    "FAULT: DHT22 reading failed; retrying on next sample.",
    "------------------------------",
    "Water detected: YES",
    "Temperature: 31.8 C",
    "Humidity: 67.9 %",
    "ALARM: Water detected!",
    "Humidity: 99.0 %",
    "------------------------------",
    "Water detected: NO",
    "Temperature: 33.0 C",
    "Humidity: 120.0 %",
  ];

  assert.deepEqual(lines.map(parse).filter(Boolean), [
    { temperatureC: 31.8, humidityPercent: 67.9, waterDetected: true },
  ]);
});
