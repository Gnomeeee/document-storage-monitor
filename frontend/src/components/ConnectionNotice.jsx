import { Info, WifiOff } from "lucide-react";

export default function ConnectionNotice({ monitor }) {
  const { connection, snapshot, error, historyError, refresh } = monitor;
  let title;
  let detail;
  if (connection !== "connected") {
    title =
      connection === "disconnected" ? "Server disconnected" : "Connecting to server…";
    detail = snapshot
      ? "Showing the last saved measurements."
      : "Waiting for the dashboard connection.";
  } else if (error) {
    title = "Room status unavailable";
  } else if (snapshot?.device.isActive === false) {
    title = "Device disabled";
    detail = "This device is no longer accepting readings.";
  } else if (snapshot?.connectivity === "NO_DATA") {
    title = "Awaiting first reading";
  } else if (snapshot && snapshot.connectivity !== "ONLINE") {
    title = snapshot.connectivity === "OFFLINE" ? "Device offline" : "Readings delayed";
    detail = "Measurements below are from the last device report.";
  }
  if (!title && !historyError) return null;
  const Icon = connection === "disconnected" ? WifiOff : Info;
  return (
    <div className="connection-notice" role="status">
      <Icon size={17} aria-hidden="true" />
      <div>
        <strong>{title || "History unavailable"}</strong>
        {detail && <span>{detail}</span>}
        {error && <span>{error}</span>}
        {historyError && <span>{historyError}</span>}
      </div>
      <button type="button" onClick={refresh}>
        Retry
      </button>
    </div>
  );
}
