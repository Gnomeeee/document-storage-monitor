import { Download } from "lucide-react";
import EmptyState from "../components/EmptyState.jsx";
import ReadingsTable from "../components/ReadingsTable.jsx";
import { downloadReadingsCsv } from "../utils/csv.js";

export default function Readings({ monitor }) {
  const { readings, deviceCode, historyLoading, historyError } = monitor;
  return (
    <section className="panel">
      <header className="panel-header">
        <div>
          <h2>Saved readings</h2>
          <p>{readings.length} loaded · Up to 500 per period</p>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          disabled={!readings.length || historyLoading}
          onClick={() => downloadReadingsCsv(readings, deviceCode)}
        >
          <Download size={16} aria-hidden="true" /> Export loaded CSV
        </button>
      </header>
      {readings.length ? (
        <ReadingsTable readings={readings} showId />
      ) : (
        <EmptyState
          loading={historyLoading}
          title={
            historyError
              ? "History unavailable"
              : historyLoading
                ? "Loading readings…"
                : "No readings found"
          }
          message={
            historyError ||
            (historyLoading
              ? undefined
              : "Choose another period or wait for a device reading.")
          }
        />
      )}
    </section>
  );
}
