import { useRef } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import AlertRules from "./AlertRules.jsx";
import EmptyState from "./EmptyState.jsx";
import { duration, measurement, timestamp } from "../utils/format.js";

function RulesButton({ rules }) {
  const dialog = useRef(null);
  return (
    <>
      <button
        className="text-button"
        aria-label="View alert rules"
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialog.current.showModal()}
      >
        <SlidersHorizontal size={15} aria-hidden="true" /> Rules
      </button>
      <dialog
        ref={dialog}
        className="rules-sheet"
        aria-labelledby="rules-title"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current.close();
        }}
      >
        <div className="sheet-content">
          <header className="panel-header">
            <div>
              <h2 id="rules-title">Alert rules</h2>
              <p>Thresholds used by the monitoring server</p>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Close alert rules"
              onClick={() => dialog.current.close()}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <AlertRules rules={rules} />
        </div>
      </dialog>
    </>
  );
}

function HumidityGauge({ peak, threshold }) {
  // Each tick covers 2.5 percentage points on the 0–100% RH scale.
  const ticks = [];
  for (let index = 0; index < 40; index++) {
    const level = (index + 0.5) * 2.5;
    const angle = Math.PI * (1 - level / 100);
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    let color = "var(--track)";
    if (level <= peak) color = level >= threshold ? "var(--amber)" : "var(--blue)";
    ticks.push(
      <line
        key={index}
        x1={110 + 78 * x}
        y1={101 - 78 * y}
        x2={110 + 98 * x}
        y2={101 - 98 * y}
        stroke={color}
        strokeWidth="4.4"
      />,
    );
  }

  return (
    <div className="humidity-gauge">
      <svg viewBox="0 0 220 104" aria-hidden="true">
        {ticks}
      </svg>
      <div className="gauge-value">
        <strong>
          {measurement(peak)}
          <small>%</small>
        </strong>
        <span>Peak in loaded readings</span>
      </div>
    </div>
  );
}

export default function HumidityReport({ readings, rules, loading, error }) {
  const threshold = rules?.humidityWarningPercent;
  const high = readings.filter((row) => row.humidityPercent >= threshold);
  const peak = readings.reduce(
    (highest, row) =>
      !highest || row.humidityPercent > highest.humidityPercent ? row : highest,
    null,
  );

  return (
    <section className="panel humidity-report" aria-labelledby="humidity-title">
      <header className="panel-header">
        <h2 id="humidity-title">Humidity report</h2>
        <RulesButton rules={rules} />
      </header>
      {peak ? (
        <>
          <div className="peak-block">
            <HumidityGauge peak={peak.humidityPercent} threshold={threshold} />
            <time dateTime={peak.receivedAt}>{timestamp(peak.receivedAt)} PHT</time>
          </div>
          <div className="peak-readings">
            {Number.isFinite(threshold) ? (
              <>
                <h3>Recent readings at or above {threshold}%</h3>
                {high.length ? (
                  <ol>
                    {high.slice(0, 3).map((row) => (
                      <li key={row.id}>
                        <time dateTime={row.receivedAt}>{timestamp(row.receivedAt)}</time>
                        <strong>{measurement(row.humidityPercent)}% RH</strong>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>All loaded readings are below the warning threshold.</p>
                )}
                <p className="rule-reminder">
                  Warning after {duration(rules.warningMs)} at or above {threshold}% RH.
                </p>
              </>
            ) : (
              <p>Waiting for the humidity threshold.</p>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          loading={loading}
          title={
            error
              ? "Humidity history unavailable"
              : loading
                ? "Loading humidity…"
                : "No humidity samples"
          }
          message={
            error ||
            (loading
              ? undefined
              : "The peak appears after a reading arrives in this period.")
          }
        />
      )}
    </section>
  );
}
