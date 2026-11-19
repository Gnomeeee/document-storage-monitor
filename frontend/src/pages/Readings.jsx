import { Download } from "lucide-react";
import EmptyState from "../components/EmptyState.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { timestamp, measurement } from "../utils/format.js";
import { downloadCsv } from "../utils/csv.js";

export default function Readings({ monitor }) {
  const { readings, snapshot, historyLoading, historyError } = monitor;

  function exportReadings() {
    const rows = readings.map((reading) => [
      snapshot?.device.deviceCode,
      reading.receivedAt,
      reading.temperatureC,
      reading.humidityPercent,
      reading.waterDetected,
      reading.readingUid,
    ]);

    downloadCsv("readings.csv", [
      [
        "Device",
        "Received at (UTC)",
        "Temperature (C)",
        "Humidity (%)",
        "Water detected",
        "Reading UID",
      ],
      ...rows,
    ]);
  }

  return (
    <section className="panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
        <div>
          <h2 className="font-semibold">Saved readings</h2>
          <p className="mt-1 text-xs text-slate-600">
            {readings.length} loaded, newest first. Maximum 500 records.
          </p>
        </div>
        <button
          className="btn"
          disabled={!readings.length || historyLoading}
          onClick={exportReadings}
        >
          <Download size={16} />
          Export loaded CSV
        </button>
      </div>

      {readings.length > 0 ? (
        <div className="max-h-[36rem] overflow-auto">
          <table>
            <caption className="sr-only">
              Saved sensor readings. Times are in Philippine time.
            </caption>
            <thead>
              <tr>
                <th>Received (PHT)</th>
                <th>Temperature</th>
                <th>Humidity</th>
                <th>Water</th>
                <th>Reading ID</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((reading) => (
                <tr key={reading.id}>
                  <td>
                    <time dateTime={reading.receivedAt}>
                      {timestamp(reading.receivedAt)}
                    </time>
                  </td>
                  <td className="tabular-nums">{measurement(reading.temperatureC)} °C</td>
                  <td className="tabular-nums">
                    {measurement(reading.humidityPercent)}% RH
                  </td>
                  <td>
                    <StatusBadge status={reading.waterDetected ? "WET" : "DRY"} />
                  </td>
                  <td
                    className="max-w-48 truncate font-mono text-xs"
                    title={reading.readingUid || String(reading.id)}
                  >
                    {reading.readingUid || reading.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={historyLoading ? "Loading readings..." : "No readings found"}
          message={historyError || "Choose another period or wait for a device reading."}
        />
      )}
    </section>
  );
}
