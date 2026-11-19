import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useMonitor } from "./hooks/useMonitor.js";
import Navigation from "./components/Navigation.jsx";
import ConnectionNotice from "./components/ConnectionNotice.jsx";
import StatusBadge from "./components/StatusBadge.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Readings from "./pages/Readings.jsx";
import Alerts from "./pages/Alerts.jsx";
import Device from "./pages/Device.jsx";

const pageTitles = {
  dashboard: "Dashboard",
  readings: "Readings",
  alerts: "Alerts",
  device: "Device",
};

function getPage() {
  const page = window.location.hash.slice(1);
  return Object.hasOwn(pageTitles, page) ? page : "dashboard";
}

export default function App() {
  const monitor = useMonitor();
  const [page, setPage] = useState(getPage);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    function handleNavigation() {
      setPage(getPage());
    }

    window.addEventListener("hashchange", handleNavigation);
    const timer = setInterval(() => setNow(Date.now()), 10000);

    return () => {
      window.removeEventListener("hashchange", handleNavigation);
      clearInterval(timer);
    };
  }, []);

  const { snapshot, connection, loading, historyLoading } = monitor;
  const isConnected = connection === "connected";
  const isLoading = loading || historyLoading;

  return (
    <div className="min-h-screen">
      <a
        className="sr-only focus:not-sr-only focus:block focus:p-4"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main").focus();
        }}
      >
        Skip to content
      </a>

      <Navigation page={page} pages={pageTitles} />

      <main
        id="main"
        className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{pageTitles[page]}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {snapshot?.device.location || "Document storage"}
            </p>
          </div>
          <button className="btn" onClick={monitor.refresh} disabled={isLoading}>
            <RefreshCw
              size={16}
              className={isLoading ? "animate-spin motion-reduce:animate-none" : ""}
            />
            {isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <ConnectionNotice monitor={monitor} />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-slate-600">Device</span>
            <StatusBadge status={isConnected ? snapshot?.connectivity : "UNKNOWN"} />
            <span className="ml-2 text-slate-600">Last recorded risk</span>
            <StatusBadge status={snapshot?.environmentalRisk} />
          </div>
          {page !== "device" && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              History
              <select
                className="form-select"
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
        </div>

        {page === "dashboard" && <Dashboard monitor={monitor} now={now} />}
        {page === "readings" && <Readings monitor={monitor} />}
        {page === "alerts" && <Alerts monitor={monitor} />}
        {page === "device" && <Device monitor={monitor} />}

        <footer className="border-t border-slate-200 pt-4 text-xs text-slate-500">
          Times are shown in Philippine time (UTC+8).
        </footer>
      </main>
    </div>
  );
}
