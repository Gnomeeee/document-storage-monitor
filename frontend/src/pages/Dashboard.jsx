import StatusBadge from "../components/StatusBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";
import ReadingChart from "../components/ReadingChart.jsx";
import { measurement, timestamp, relativeTime } from "../utils/format.js";

export default function Dashboard({ monitor, now }) {
  const { snapshot, readings, historyLoading, historyError } = monitor;
  const latest = snapshot?.latest;
  const alerts = snapshot?.activeAlerts || [];

  const readingsSummary = [
    { label: "Humidity", value: measurement(latest?.humidityPercent), unit: "% RH" },
    { label: "Temperature", value: measurement(latest?.temperatureC), unit: "°C" },
    { label: "Water", value: latest ? (latest.waterDetected ? "Wet" : "Dry") : "--" },
    { label: "Open alerts", value: snapshot ? alerts.length : "--" },
  ];

  return (
    <>
      <section aria-label="Latest readings">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {readingsSummary.map((reading) => (
            <div key={reading.label} className="panel p-5">
              <h2 className="text-sm text-slate-600">{reading.label}</h2>
              <p className="mt-3 text-3xl font-semibold tabular-nums">
                {reading.value}
                {reading.unit && (
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    {reading.unit}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-600">
          {latest
            ? `Last received: ${timestamp(latest.receivedAt)} PHT (${relativeTime(latest.receivedAt, now)})`
            : "No readings yet. Water state and environmental risk are unknown."}
        </p>
      </section>

      <ReadingChart
        readings={readings}
        gapMs={snapshot?.monitoringRules?.gapMs}
        loading={historyLoading}
        error={historyError}
      />

      <section className="panel">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <h2 className="font-semibold">Open alerts</h2>
          <a
            href="#alerts"
            className="text-sm text-emerald-800 underline underline-offset-4"
          >
            View history
          </a>
        </div>

        {alerts.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {alerts.map((alert) => (
              <li key={alert.id} className="flex items-start justify-between gap-4 p-5">
                <div>
                  <p className="font-medium">
                    {alert.type === "WATER" ? "Water detected" : "High humidity"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Started {timestamp(alert.startedAt)} PHT
                  </p>
                </div>
                <StatusBadge status={alert.severity} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={snapshot ? "No open alerts" : "Alert status unavailable"}
            message={
              snapshot
                ? "Alerts appear when the backend confirms a warning condition."
                : "Waiting for the backend."
            }
          />
        )}
      </section>
    </>
  );
}
