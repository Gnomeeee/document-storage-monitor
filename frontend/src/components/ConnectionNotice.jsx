export default function ConnectionNotice({ monitor }) {
  const { connection, snapshot, error, historyError, refresh } = monitor;
  let message;

  if (connection !== "connected") {
    message = snapshot
      ? "Disconnected. Showing last saved readings while the connection retries."
      : "Connecting to the backend. No readings have been loaded.";
  } else if (error) {
    message = error;
  } else if (snapshot?.device.isActive === false) {
    message = "This device is disabled. The backend is not accepting new readings.";
  } else if (snapshot?.connectivity === "NO_DATA") {
    message = "No readings yet. Waiting for the device to send its first measurement.";
  } else if (snapshot && snapshot.connectivity !== "ONLINE") {
    message =
      "No recent device readings. The values below are from the last saved measurement.";
  }

  if (!message && !historyError) return null;

  return (
    <div
      className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          {message && <p>{message}</p>}
          {historyError && <p>History: {historyError}</p>}
        </div>
        <button className="font-medium underline underline-offset-4" onClick={refresh}>
          Retry
        </button>
      </div>
    </div>
  );
}
