import { readingSchema } from "../src/validators/messages.js";

const serialReading = readingSchema.pick({
  waterDetected: true,
  temperatureC: true,
  humidityPercent: true,
});

export function createSerialReadingParser() {
  let frame = null;

  return (rawLine) => {
    const line = rawLine.trim();
    if (line === "------------------------------") {
      frame = {};
      return;
    }
    if (!frame) return;

    const water = /^Water detected: (YES|NO)$/.exec(line);
    const temperature = /^Temperature: (-?\d+\.\d+) C$/.exec(line);
    const humidity = /^Humidity: (\d+\.\d+) %$/.exec(line);
    if (water) frame.waterDetected = water[1] === "YES";
    if (temperature) frame.temperatureC = Number(temperature[1]);
    if (line.startsWith("FAULT:")) frame = null;
    if (!humidity) return;

    const result = serialReading.safeParse({
      ...frame,
      humidityPercent: Number(humidity[1]),
    });
    frame = null;
    if (result.success) return result.data;
  };
}
