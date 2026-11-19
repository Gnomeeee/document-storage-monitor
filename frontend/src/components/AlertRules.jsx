import { duration } from "../utils/format.js";

export default function AlertRules({ rules }) {
  if (!rules) {
    return (
      <p className="text-sm text-slate-600">Alert rules will load from the backend.</p>
    );
  }

  const rows = [
    [
      "Humidity warning",
      `At least ${rules.humidityWarningPercent}% for ${duration(rules.warningMs)}`,
    ],
    [
      "Humidity critical",
      `At least ${rules.humidityCriticalPercent}% for ${duration(rules.criticalMs)}`,
    ],
    [
      "Humidity recovery",
      `Below ${rules.humidityClearBelowPercent}% for ${duration(rules.humidityClearMs)}`,
    ],
    ["Water alert", "When a wet reading is received"],
    ["Water recovery", `Dry readings spanning ${duration(rules.waterClearMs)}`],
    ["Stale readings", `No accepted reading for ${duration(rules.staleMs)}`],
    ["Device offline", `No accepted reading for ${duration(rules.offlineMs)}`],
  ];

  return (
    <dl className="divide-y divide-slate-100">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 py-3 text-sm sm:grid-cols-2 sm:gap-4">
          <dt className="text-slate-600">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
