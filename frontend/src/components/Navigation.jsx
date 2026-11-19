import { Archive, Bell, Cpu, LayoutDashboard, ListFilter, Server } from "lucide-react";
import StatusBadge from "./StatusBadge.jsx";

const icons = {
  dashboard: LayoutDashboard,
  readings: ListFilter,
  alerts: Bell,
  device: Cpu,
};

export default function Navigation({ page, pages, deviceCode, deviceStatus }) {
  return (
    <aside className="sidebar">
      <a
        href="#dashboard"
        className="brand"
        aria-label="Document Storage Monitor overview"
      >
        <span className="brand-mark">
          <Archive size={21} aria-hidden="true" />
        </span>
        <span>Storage Monitor</span>
      </a>
      <nav aria-label="Main navigation" className="sidebar-nav">
        {Object.entries(pages).map(([id, label]) => {
          const Icon = icons[id];
          return (
            <a key={id} href={`#${id}`} aria-current={page === id ? "page" : undefined}>
              <Icon size={18} aria-hidden="true" />
              {label}
            </a>
          );
        })}
      </nav>
      <div className="sidebar-device">
        <span className="sidebar-device-label">
          <Server size={15} aria-hidden="true" /> Monitoring device
        </span>
        <strong translate="no">{deviceCode}</strong>
        <StatusBadge status={deviceStatus} />
      </div>
    </aside>
  );
}
