import { Cpu, Droplets, Waves } from "lucide-react";
import { duration } from "../utils/format.js";

export default function AlertRules({ rules }) {
  if (!rules)
    return <p className="rules-unavailable">Waiting for the server’s alert settings.</p>;

  const groups = [
    {
      title: "Humidity",
      icon: Droplets,
      rows: [
        [
          "Warning",
          `At least ${rules.humidityWarningPercent}% RH for ${duration(rules.warningMs)}`,
        ],
        [
          "Critical",
          `At least ${rules.humidityCriticalPercent}% RH for ${duration(rules.criticalMs)}`,
        ],
        [
          "Recovery",
          `Below ${rules.humidityClearBelowPercent}% RH for ${duration(rules.humidityClearMs)}`,
        ],
      ],
    },
    {
      title: "Water intrusion",
      icon: Waves,
      rows: [
        ["Critical", "First saved wet reading"],
        ["Recovery", `Dry readings spanning ${duration(rules.waterClearMs)}`],
      ],
    },
    {
      title: "Device reporting",
      icon: Cpu,
      rows: [
        ["Delayed", `No accepted reading for ${duration(rules.staleMs)}`],
        ["Offline", `No accepted reading for ${duration(rules.offlineMs)}`],
      ],
    },
  ];
  return (
    <div className="rule-groups">
      {groups.map(({ title, icon: Icon, rows }) => (
        <section key={title} className="rule-group">
          <h3>
            <Icon size={16} aria-hidden="true" />
            {title}
          </h3>
          <dl>
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
