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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
        <h2 className="font-semibold">Alert history</h2>
        <button
          className="btn"
          disabled={!filteredAlerts.length || historyLoading}
          onClick={exportAlerts}
        >
          <Download size={16} />
          Export loaded CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-4 p-5">
        <label className="flex items-center gap-2 text-sm">
          Status
          <select
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
        <div className="max-h-[36rem] overflow-auto">
          <table>
            <caption className="sr-only">
              Alert history. Times are in Philippine time.
            </caption>
            <thead>
              <tr>
                <th>Type</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Started (PHT)</th>
                <th>Cleared (PHT)</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map((alert) => (
                <tr key={alert.id}>
                  <td>{alert.type === "WATER" ? "Water" : "Humidity"}</td>
                  <td>
                    <StatusBadge status={alert.severity} />
                  </td>
                  <td>
                    <StatusBadge status={alert.status} />
                  </td>
                  <td>{timestamp(alert.startedAt)}</td>
                  <td>{alert.clearedAt ? timestamp(alert.clearedAt) : "Not cleared"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title={historyLoading ? "Loading alerts..." : "No matching alerts"}
          message={historyError || "Try a different period, status, or type."}
        />
      )}

      <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
        {filteredAlerts.length} matching records. Up to 500 by start time. Older open
        alerts remain on the dashboard.
      </p>
    </section>
  );
}
