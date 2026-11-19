import {
  ArrowUpRight,
  Bell,
  CircleCheck,
  Droplet,
  Radio,
  Thermometer,
  TriangleAlert,
  Waves,
} from "lucide-react";
import EmptyState from "../components/EmptyState.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import HumidityReport from "../components/HumidityReport.jsx";
import ReadingChart from "../components/ReadingChart.jsx";
import ReadingsTable from "../components/ReadingsTable.jsx";
import { measurement, timestamp } from "../utils/format.js";

function MetricCard({
  label,
  icon: Icon,
  value,
  unit,
  tone = "blue",
  loading,
  children,
}) {
  return (
    <article className="panel metric-card">
      <header>
        <h2>{label}</h2>
        <span className={`metric-icon tone-${tone}`}>
          <Icon size={17} aria-hidden="true" />
        </span>
      </header>
      <p className={`metric-value${loading ? " loading-value" : ""}`}>
        {value}
        {unit && <small>{unit}</small>}
      </p>
      <div className="metric-foot">{children}</div>
    </article>
  );
}

function ActiveAlerts({ alerts, snapshot }) {
  const ordered = [...alerts].sort(
    (a, b) => Number(b.severity === "CRITICAL") - Number(a.severity === "CRITICAL"),
  );
  return (
    <section className="panel" aria-labelledby="alerts-title">
      <header className="panel-header">
        <h2 id="alerts-title">Open alerts</h2>
        <a className="text-link" href="#alerts">
          History <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </header>
      {ordered.length ? (
        <ul className="incident-list">
          {ordered.map((alert) => (
            <li key={alert.id}>
              <div>
                <strong>
                  {alert.type === "WATER" ? "Water detected" : "High humidity"}
                </strong>
                <StatusBadge status={alert.severity} />
              </div>
              <p>{alert.message}</p>
              <time dateTime={alert.startedAt}>{timestamp(alert.startedAt)} PHT</time>
            </li>
          ))}
        </ul>
      ) : (
        <div className="quiet-state">
          {snapshot ? (
            <CircleCheck size={22} aria-hidden="true" />
          ) : (
            <Radio size={22} aria-hidden="true" />
          )}
          <div>
            <strong>{snapshot ? "No open alerts" : "Alert status unavailable"}</strong>
            <p>{snapshot ? "At the last server update." : "Waiting for the server."}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function WaterChanges({ readings, loading, error }) {
  const changes = [];
  for (let index = 0; index + 1 < readings.length && changes.length < 6; index++) {
    if (readings[index].waterDetected !== readings[index + 1].waterDetected)
      changes.push(readings[index]);
  }
  return (
    <section className="panel water-log">
      <header className="panel-header">
        <h2>Water activity</h2>
        <Waves size={18} aria-hidden="true" />
      </header>
      {changes.length ? (
        <ol className="water-events">
          {changes.map((reading) => (
            <li key={reading.id}>
              <span className={`event-dot ${reading.waterDetected ? "event-wet" : ""}`} />
              <span>{reading.waterDetected ? "Water detected" : "Probe dry"}</span>
              <time dateTime={reading.receivedAt}>{timestamp(reading.receivedAt)}</time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="panel-note">
          {error
            ? "Water history unavailable."
            : loading
              ? "Loading water history…"
              : readings.length < 2
                ? "Awaiting consecutive readings in this period."
                : "No state changes in the loaded readings."}
        </p>
      )}
    </section>
  );
}

export default function Dashboard({ monitor }) {
  const { snapshot, readings, historyError } = monitor;
  const latest = snapshot?.latest;
  const rules = snapshot?.monitoringRules;
  const alerts = snapshot?.activeAlerts || [];
  const threshold = rules?.humidityWarningPercent;
  const high =
    latest && Number.isFinite(threshold) && latest.humidityPercent >= threshold;
  const wet = latest?.waterDetected;
  const temperatures = readings.map((reading) => reading.temperatureC);
  const loading =
    !snapshot &&
    (monitor.loading ||
      ["idle", "connecting", "reconnecting"].includes(monitor.connection));
  const historyLoading = monitor.historyLoading || loading;
  const reporting =
    monitor.connection === "connected" && snapshot?.connectivity === "ONLINE";
  let attention;
  if (reporting) {
    if (wet) attention = "Water detected in the storage room";
    else if (snapshot.environmentalRisk === "CRITICAL")
      attention = "A critical incident is still open";
    else if (snapshot.environmentalRisk === "WARNING")
      attention = "Humidity warning active";
    else if (high) attention = "Humidity has reached the warning threshold";
  }

  return (
    <>
      {attention && (
        <div
          className={`attention-note ${wet || snapshot.environmentalRisk === "CRITICAL" ? "tone-danger" : "tone-warning"}`}
          role="status"
        >
          <TriangleAlert size={17} aria-hidden="true" />
          <strong>{attention}</strong>
          {alerts.length > 0 && (
            <a className="text-link" href="#alerts">
              Alert history <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          )}
        </div>
      )}
      <section className="metric-grid" aria-label="Latest recorded conditions">
        <MetricCard
          label="Humidity"
          icon={Droplet}
          value={measurement(latest?.humidityPercent)}
          unit={latest && "% RH"}
          loading={loading}
        >
          {latest && Number.isFinite(threshold) ? (
            <span className={high ? "note-warning" : ""}>
              {high ? "At or above" : "Below"} {threshold}% threshold
            </span>
          ) : (
            "Awaiting humidity and rules"
          )}
        </MetricCard>
        <MetricCard
          label="Temperature"
          icon={Thermometer}
          value={measurement(latest?.temperatureC)}
          unit={latest && "°C"}
          loading={loading}
        >
          {temperatures.length
            ? `Observed ${measurement(Math.min(...temperatures))}–${measurement(Math.max(...temperatures))} °C`
            : "DHT22 air temperature"}
        </MetricCard>
        <MetricCard
          label="Water sensor"
          icon={Waves}
          value={wet == null ? "--" : wet ? "Wet" : "Dry"}
          tone={wet == null ? "muted" : wet ? "danger" : "good"}
          loading={loading}
        >
          {wet == null
            ? "Awaiting probe reading"
            : wet
              ? "Water detected at the probe"
              : "No water at last reading"}
        </MetricCard>
        <MetricCard
          label="Open alerts"
          icon={Bell}
          value={snapshot ? alerts.length : "--"}
          tone={alerts.length ? "warning" : "blue"}
          loading={loading}
        >
          <span>Room risk</span>
          <StatusBadge status={snapshot?.environmentalRisk} />
        </MetricCard>
      </section>

      <div className="overview-grid">
        <ReadingChart
          readings={readings}
          gapMs={rules?.gapMs}
          humidityThreshold={threshold}
          loading={historyLoading}
          error={historyError}
        />
        <HumidityReport
          readings={readings}
          rules={rules}
          loading={historyLoading}
          error={historyError}
        />

        <section className="panel recent-readings">
          <header className="panel-header">
            <h2>Recent readings</h2>
            <a className="text-link" href="#readings">
              View readings <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </header>
          {readings.length ? (
            <ReadingsTable readings={readings.slice(0, 6)} />
          ) : (
            <EmptyState
              loading={historyLoading}
              title={
                historyError
                  ? "Reading history unavailable"
                  : historyLoading
                    ? "Loading readings…"
                    : "No readings yet"
              }
              message={
                historyError ||
                (historyLoading
                  ? undefined
                  : "Readings will appear when the device reports in this period.")
              }
            />
          )}
        </section>
        <div className="activity-column">
          <ActiveAlerts alerts={alerts} snapshot={snapshot} />
          <WaterChanges
            readings={readings}
            loading={historyLoading}
            error={historyError}
          />
        </div>
      </div>
    </>
  );
}
