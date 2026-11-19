import { Cpu } from "lucide-react";
import AlertRules from "../components/AlertRules.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { timestamp } from "../utils/format.js";

export default function Device({ monitor }) {
  const { snapshot, connection } = monitor;
  const device = snapshot?.device;
  const latest = snapshot?.latest;
  const details = [
    ["Device code", device?.deviceCode || monitor.deviceCode],
    ["Location", device?.location || "Not loaded"],
    ["Accepting readings", device ? (device.isActive ? "Yes" : "No") : "Unknown"],
    [
      "Last accepted reading",
      latest ? timestamp(latest.receivedAt) + " PHT" : "No readings",
    ],
    [
      "Server connection",
      <StatusBadge status={connection === "connected" ? "CONNECTED" : "DISCONNECTED"} />,
    ],
  ];
  return (
    <div className="device-grid">
      <section className="panel device-info">
        <header className="panel-header">
          <h2>Device details</h2>
          <Cpu size={20} aria-hidden="true" />
        </header>
        <div className="device-identity">
          <span className="device-chip">
            <Cpu size={28} aria-hidden="true" />
          </span>
          <div>
            <h3>{device?.name || "ESP32 monitor"}</h3>
            <StatusBadge
              status={connection === "connected" ? snapshot?.connectivity : "UNKNOWN"}
            />
          </div>
        </div>
        <dl className="detail-list">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="panel">
        <header className="panel-header">
          <div>
            <h2>Alert rules</h2>
            <p>Thresholds used by the monitoring server</p>
          </div>
        </header>
        <AlertRules rules={snapshot?.monitoringRules} />
      </section>
    </div>
  );
}
