import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import EmptyState from "./EmptyState.jsx";
import { clockTime, dateLabel, measurement, timestamp } from "../utils/format.js";

function SensorTooltip({ active, payload, label, unit, name }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="plot-tooltip">
      <time>{timestamp(label)} PHT</time>
      <p>
        {name}
        <strong>
          {measurement(payload[0].value)} {unit}
        </strong>
      </p>
    </div>
  );
}

export default function ReadingChart({
  readings,
  gapMs,
  humidityThreshold,
  loading,
  error,
}) {
  const [metric, setMetric] = useState("humidityPercent");
  const [fullPeriod, setFullPeriod] = useState(false);
  // The server delivers newest first. A gap marks the end of the most recent run.
  const runLength = readings.findIndex(
    (row, index) =>
      gapMs > 0 &&
      index > 0 &&
      Date.parse(readings[index - 1].receivedAt) - Date.parse(row.receivedAt) > gapMs,
  );
  const latestRun = !fullPeriod && runLength >= 2;
  const visibleReadings = latestRun ? readings.slice(0, runLength) : readings;
  const humidity = metric === "humidityPercent";
  const name = humidity ? "Humidity" : "Temperature";
  const unit = humidity ? "% RH" : "°C";
  const showThreshold = humidity && Number.isFinite(humidityThreshold);
  const points = [];
  const values = [];

  for (const reading of [...visibleReadings].reverse()) {
    const time = Date.parse(reading.receivedAt);
    const previous = points.at(-1);
    if (previous && gapMs && time - previous.time > gapMs) {
      points.push({ time: previous.time + 1, value: null });
    }
    points.push({ time, value: reading[metric] });
    values.push(reading[metric]);
  }

  const min = values.length ? Math.min(...values) : null;
  const max = values.length ? Math.max(...values) : null;
  const mean = values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
  // Include the warning line and leave room around a flat or single-point series.
  const low = showThreshold ? Math.min(min, humidityThreshold) : min;
  const high = showThreshold ? Math.max(max, humidityThreshold) : max;
  const step =
    [0.5, 1, 2, 5, 10, 20, 25, 50].find((size) => high - low <= 4 * size) ?? 50;
  const floor = Math.floor((low - step * 0.15) / step) * step;
  const ceiling = Math.ceil((high + step * 0.15) / step) * step;
  const yRange = humidity
    ? [Math.max(0, floor), Math.min(100, ceiling)]
    : [floor, ceiling];
  const first = points[0]?.time;
  const last = points.at(-1)?.time;
  const ticks = [];
  for (let value = yRange[0]; value <= yRange[1]; value += step) ticks.push(value);

  // Isolated samples on either side of a gap need a dot to remain visible.
  function sampleDot({ cx, cy, index }) {
    if (points[index]?.value == null || !Number.isFinite(cx) || !Number.isFinite(cy))
      return null;
    const isolated = points[index - 1]?.value == null && points[index + 1]?.value == null;
    return isolated || values.length <= 2 ? (
      <circle key={index} cx={cx} cy={cy} r={3} fill="var(--blue)" />
    ) : null;
  }

  return (
    <section className="panel trend-panel" aria-labelledby="trend-title">
      <header className="panel-header">
        <div>
          <h2 id="trend-title">Climate trend</h2>
          <p>
            {latestRun ? "Latest reporting run" : "Selected period"} ·{" "}
            {visibleReadings.length} saved readings
          </p>
        </div>
        <div className="chart-switch" role="group" aria-label="Chart measurement">
          {[
            ["humidityPercent", "Humidity"],
            ["temperatureC", "Temperature"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={metric === key}
              onClick={() => setMetric(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      <div className="plot-legend">
        <span>
          <i />
          {name} ({unit})
        </span>
        {showThreshold && (
          <span>
            <i className="threshold-key" />
            Warning {humidityThreshold}%
          </span>
        )}
        {runLength >= 2 && (
          <button
            type="button"
            className="scope-link"
            onClick={() => setFullPeriod(!fullPeriod)}
          >
            {latestRun ? "Show full period" : "Focus latest run"}
          </button>
        )}
      </div>
      {values.length ? (
        <div className="plot" aria-label={`${name} by time in the Philippines`}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart
              data={points}
              margin={{ top: 12, right: 16, bottom: 2, left: 0 }}
              accessibilityLayer
            >
              <defs>
                <linearGradient id="history-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--blue)" stopOpacity={0.17} />
                  <stop offset="100%" stopColor="var(--blue)" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--line)"
                strokeDasharray="3 4"
              />
              <XAxis
                dataKey="time"
                type="number"
                domain={
                  first === last ? [first - 30000, last + 30000] : ["dataMin", "dataMax"]
                }
                ticks={first === last ? [first] : undefined}
                tickFormatter={(time) =>
                  last - first > 86400000
                    ? dateLabel(time)
                    : last - first < 300000
                      ? clockTime(time)
                      : timestamp(time, true)
                }
                minTickGap={30}
                tickMargin={8}
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={yRange}
                width={43}
                ticks={ticks}
                tickFormatter={(value) => (humidity ? `${value}%` : `${value}°`)}
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={<SensorTooltip unit={unit} name={name} />}
                cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
              />
              {showThreshold && (
                <ReferenceLine
                  y={humidityThreshold}
                  stroke="var(--amber)"
                  strokeDasharray="5 4"
                />
              )}
              <Area
                type="linear"
                dataKey="value"
                stroke="var(--blue)"
                fill="url(#history-fill)"
                baseValue="dataMin"
                strokeWidth={2.2}
                dot={sampleDot}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "white" }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="plot plot-empty">
          <EmptyState
            loading={loading}
            title={
              error
                ? "History unavailable"
                : loading
                  ? "Loading readings…"
                  : "No readings in this period"
            }
            message={
              error ||
              (loading
                ? undefined
                : "Select another period or wait for the device to report.")
            }
          />
        </div>
      )}
      <dl className="plot-stats">
        {[
          ["Lowest", min],
          ["Average", mean],
          ["Highest", max],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {measurement(value)}
              {value !== null && <small> {unit}</small>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
