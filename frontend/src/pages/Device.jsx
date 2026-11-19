import AlertRules from "../components/AlertRules.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { timestamp } from "../utils/format.js";

export default function Device({ monitor }) {
  const { snapshot, connection } = monitor;
  const device = snapshot?.device;

  const details = [
    ["Device code", device?.deviceCode || monitor.deviceCode],
    ["Name", device?.name || "Not loaded"],
    ["Location", device?.location || "Not loaded"],
    ["Accepting readings", device ? (device.isActive ? "Yes" : "No") : "Unknown"],
    [
      "Last received",
      snapshot?.latest ? timestamp(snapshot.latest.receivedAt) + " PHT" : "No readings",
    ],
  ];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <section className="panel p-5">
        <h2 className="font-semibold">Device details</h2>
        <dl className="mt-4 divide-y divide-slate-100">
          {details.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-3 text-sm">
              <dt className="text-slate-600">{label}</dt>
              <dd className="text-right break-all">{value}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 py-3 text-sm">
            <dt className="text-slate-600">Dashboard connection</dt>
            <dd>
              <StatusBadge
                status={connection === "connected" ? "CONNECTED" : "DISCONNECTED"}
              />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3 text-sm">
            <dt className="text-slate-600">Device reporting</dt>
            <dd>
              <StatusBadge
                status={connection === "connected" ? snapshot?.connectivity : "UNKNOWN"}
              />
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel p-5">
        <h2 className="mb-4 font-semibold">Alert rules</h2>
        <AlertRules rules={snapshot?.monitoringRules} />
      </section>
    </div>
  );
}
