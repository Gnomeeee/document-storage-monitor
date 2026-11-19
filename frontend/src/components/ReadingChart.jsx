import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import EmptyState from "./EmptyState.jsx";
import { timestamp, measurement } from "../utils/format.js";

export default function ReadingChart({ readings, gapMs, loading, error }) {
  const [metric, setMetric] = useState("humidityPercent");
  const isHumidity = metric === "humidityPercent";
  const unit = isHumidity ? "% RH" : "°C";
  const points = [];

  for (const reading of [...readings].reverse()) {
    const time = Date.parse(reading.receivedAt);
    const previous = points.at(-1);

    // A missing observation must not look like a continuous measurement.
    if (previous && gapMs && time - previous.time > gapMs) {
      points.push({ time: previous.time + 1, [metric]: null });
    }

    points.push({ ...reading, time });
  }

  return (
    <section className="panel">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <h2 className="font-semibold">Reading history</h2>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Measurement
          <select
            className="form-select"
            value={metric}
            onChange={(event) => setMetric(event.target.value)}
          >
            <option value="humidityPercent">Humidity</option>
            <option value="temperatureC">Temperature</option>
          </select>
        </label>
      </div>

      {readings.length > 0 ? (
        <div className="h-64 min-w-0 px-3 pb-4 sm:h-72 sm:px-5">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart
              data={points}
              margin={{ top: 10, right: 15, left: -15, bottom: 0 }}
              accessibilityLayer
            >
              <CartesianGrid vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="time"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(value) => timestamp(value, true)}
                minTickGap={50}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={isHumidity ? [0, 100] : ["auto", "auto"]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                labelFormatter={(value) => timestamp(value)}
                formatter={(value) => [
                  `${measurement(value)} ${unit}`,
                  isHumidity ? "Humidity" : "Temperature",
                ]}
                contentStyle={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
              <Line
                type="linear"
                dataKey={metric}
                stroke="#047857"
                strokeWidth={2}
                dot={readings.length < 3}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState
          title={
            loading
              ? "Loading readings..."
              : error
                ? "History unavailable"
                : "No readings in this period"
          }
          message={error || "Received measurements will appear here."}
        />
      )}

      <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
        {readings.length} records loaded. Up to 500 newest readings per period.
      </p>
    </section>
  );
}
