import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Download,
  FolderOpen,
  RefreshCw,
} from "lucide-react";
import { useMonitor } from "./hooks/useMonitor.js";
import Navigation from "./components/Navigation.jsx";
import ConnectionNotice from "./components/ConnectionNotice.jsx";
import StatusBadge from "./components/StatusBadge.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Readings from "./pages/Readings.jsx";
import Alerts from "./pages/Alerts.jsx";
import Device from "./pages/Device.jsx";
import { downloadReadingsCsv } from "./utils/csv.js";
import { timestamp, relativeTime } from "./utils/format.js";

const pages = {
  dashboard: "Overview",
  readings: "Readings",
  alerts: "Alerts",
  device: "Device",
};
const titles = {
  dashboard: "Room overview",
  readings: "Sensor readings",
  alerts: "Alert history",
  device: "Device health",
};

function getPage() {
  const page = window.location.hash.slice(1);
  return Object.hasOwn(pages, page) ? page : "dashboard";
}

export default function App() {
  const monitor = useMonitor();
  const [page, setPage] = useState(getPage);
  const [now, setNow] = useState(Date.now);
  const heading = useRef(null);
  const previousPage = useRef(page);

  useEffect(() => {
    function navigate() {
      setPage(getPage());
    }
    window.addEventListener("hashchange", navigate);
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => {
      window.removeEventListener("hashchange", navigate);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    document.title = `${titles[page]} · Document Storage Monitor`;
    if (previousPage.current !== page) {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
      previousPage.current = page;
    }
  }, [page]);

  const { snapshot, loading, connection, historyLoading, deviceCode } = monitor;
  const connected = connection === "connected";
  const deviceStatus = connected ? snapshot?.connectivity : "UNKNOWN";
  const busy = loading || historyLoading;
  const latest = snapshot?.latest;
  const openCount = snapshot?.activeAlerts.length;
  const connectionLabel = connected
    ? "Server connected"
    : connection === "disconnected"
      ? "Server disconnected"
      : "Connecting…";

  return (
    <div className="monitor-shell">
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          heading.current?.focus();
        }}
      >
        Skip to content
      </a>
      <Navigation
        page={page}
        pages={pages}
        deviceCode={deviceCode}
        deviceStatus={deviceStatus}
      />

      <div className="workspace">
        <header className="workspace-bar">
          <div className="room-crumb">
            <FolderOpen size={17} aria-hidden="true" />
            <span>Document storage</span>
            <ChevronRight size={14} aria-hidden="true" />
            <strong>{snapshot?.device.location || deviceCode}</strong>
          </div>
          <div className="bar-tools">
            <span className="server-state">
              <i className={connected ? "dot good" : "dot"} />
              {connectionLabel}
            </span>
            <a
              className="icon-button notification-link"
              href="#alerts"
              aria-label={
                openCount == null ? "Alert history" : `Alert history, ${openCount} open`
              }
            >
              <Bell size={18} aria-hidden="true" />
              {openCount > 0 && <i aria-hidden="true" />}
            </a>
          </div>
        </header>

        <main id="main" className="monitor-main">
          <header className="page-header">
            <div>
              <h1 ref={heading} tabIndex={-1}>
                {titles[page]}
              </h1>
              <div className="page-meta">
                {latest ? (
                  <>
                    <time dateTime={latest.receivedAt}>
                      Last reading {timestamp(latest.receivedAt)} PHT
                    </time>
                    <span className="age">{relativeTime(latest.receivedAt, now)}</span>
                  </>
                ) : (
                  <span>
                    {loading ? "Loading room data…" : "Awaiting sensor readings"}
                  </span>
                )}
              </div>
            </div>
            <div className="toolbar">
              {page !== "device" && (
                <label className="range-picker">
                  <CalendarDays size={16} aria-hidden="true" />
                  <span className="sr-only">History period</span>
                  <select
                    name="period"
                    value={monitor.rangeHours}
                    disabled={historyLoading}
                    onChange={(event) => monitor.setRange(Number(event.target.value))}
                  >
                    <option value={1}>Last hour</option>
                    <option value={24}>Last 24 hours</option>
                    <option value={168}>Last 7 days</option>
                  </select>
                </label>
              )}
              <button
                className="icon-button"
                type="button"
                aria-label="Refresh measurements"
                title="Refresh measurements"
                disabled={busy}
                onClick={monitor.refresh}
              >
                <RefreshCw
                  size={16}
                  aria-hidden="true"
                  className={busy ? "refreshing" : ""}
                />
              </button>
              {page === "dashboard" && (
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={!monitor.readings.length || historyLoading}
                  onClick={() => downloadReadingsCsv(monitor.readings, deviceCode)}
                >
                  <Download size={16} aria-hidden="true" /> Export CSV
                </button>
              )}
            </div>
          </header>

          <ConnectionNotice monitor={monitor} />
          {page !== "dashboard" && page !== "device" && (
            <div className="page-status">
              <span>
                Device <StatusBadge status={deviceStatus} />
              </span>
              <span>
                Last recorded risk <StatusBadge status={snapshot?.environmentalRisk} />
              </span>
            </div>
          )}
          {page === "dashboard" && <Dashboard monitor={monitor} />}
          {page === "readings" && <Readings monitor={monitor} />}
          {page === "alerts" && <Alerts monitor={monitor} />}
          {page === "device" && <Device monitor={monitor} />}
          <footer className="workspace-footer">Philippine time (UTC+8)</footer>
        </main>
      </div>
    </div>
  );
}
