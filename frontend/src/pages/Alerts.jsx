import { useState } from "react";
import { Download } from "lucide-react";
import StatusBadge from "../components/StatusBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { timestamp } from "../utils/format.js";
import { downloadCsv } from "../utils/csv.js";

export default function Alerts({ monitor }) {
  const [status, setStatus] = useState("ALL");
  const [type, setType] = useState("ALL");
  const { alerts, snapshot, historyLoading, historyError } = monitor;

  const filteredAlerts = alerts.filter((alert) => {
    const matchesStatus = status === "ALL" || alert.status === status;
    const matchesType = type === "ALL" || alert.type === type;
    return matchesStatus && matchesType;
  });

  function exportAlerts() {
    const rows = filteredAlerts.map((alert) => [
      snapshot?.device.deviceCode,
      alert.type,
      alert.severity,
      alert.status,
      alert.startedAt,
      alert.clearedAt,
    ]);

    downloadCsv("alerts.csv", [
      ["Device", "Type", "Severity", "Status", "Started (UTC)", "Cleared (UTC)"],
      ...rows,
    ]);
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2>Recorded incidents</h2>
          <p>{filteredAlerts.length} matching records in this period</p>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          disabled={!filteredAlerts.length || historyLoading}
          onClick={exportAlerts}
        >
          <Download size={16} aria-hidden="true" />
          Export loaded CSV
        </button>
      </header>

      <div className="table-filters">
        <label className="flex items-center gap-2 text-sm">
          Status
          <select
            name="alert-status"
            className="form-select"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="ALL">All</option>
            <option value="OPEN">Open</option>
            <option value="CLEARED">Cleared</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Type
          <select
            name="alert-type"
            className="form-select"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="ALL">All</option>
            <option value="HUMIDITY">Humidity</option>
            <option value="WATER">Water</option>
          </select>
        </label>
      </div>

      {filteredAlerts.length > 0 ? (
        <div
          className="table-scroll alert-table-scroll"
          role="region"
          aria-label="Recorded incidents table"
          tabIndex={0}
        >
          <table>
            <caption className="sr-only">
              Alert history. Times are in Philippine time.
            </caption>
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Severity</th>
                <th scope="col">Status</th>
                <th scope="col">Started (PHT)</th>
                <th scope="col">Cleared (PHT)</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map((alert) => (
                <tr key={alert.id}>
                  <td data-label="Type">
                    {alert.type === "WATER" ? "Water" : "Humidity"}
                  </td>
                  <td data-label="Severity">
                    <StatusBadge status={alert.severity} />
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={alert.status} />
                  </td>
                  <td data-label="Started (PHT)">
                    <time dateTime={alert.startedAt}>{timestamp(alert.startedAt)}</time>
                  </td>
                  <td data-label="Cleared (PHT)">
                    {alert.clearedAt ? (
                      <time dateTime={alert.clearedAt}>{timestamp(alert.clearedAt)}</time>
                    ) : (
                      "Not cleared"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          loading={historyLoading}
          title={
            historyError
              ? "Alert history unavailable"
              : historyLoading
                ? "Loading alerts…"
                : "No matching alerts"
          }
          message={
            historyError ||
            (historyLoading ? undefined : "Try a different period, status, or type.")
          }
        />
      )}

      <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
        Up to 500 alerts by start time. Older open alerts remain on the dashboard.
      </p>
    </section>
  );
}
