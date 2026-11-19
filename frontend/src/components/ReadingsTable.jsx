import StatusBadge from "./StatusBadge.jsx";
import { clockTime, dateLabel, measurement } from "../utils/format.js";

export default function ReadingsTable({ readings, showId = false }) {
  return (
    <div
      className={showId ? "table-scroll full-readings" : "table-scroll"}
      role="region"
      aria-label={showId ? "Saved readings table" : "Recent readings table"}
      tabIndex={showId ? 0 : undefined}
    >
      <table className="readings-table">
        <caption className="sr-only">
          Sensor readings, newest first. Times are in Philippine time.
        </caption>
        <thead>
          <tr>
            <th scope="col">Time (PHT)</th>
            <th scope="col">
              <abbr title="Temperature">Temp.</abbr>
            </th>
            <th scope="col">Humidity</th>
            <th scope="col">Water</th>
            {showId && <th scope="col">Reading ID</th>}
          </tr>
        </thead>
        <tbody>
          {readings.map((reading) => (
            <tr key={reading.id}>
              <th scope="row">
                <time dateTime={reading.receivedAt}>
                  {clockTime(reading.receivedAt)}
                  <small>{dateLabel(reading.receivedAt)}</small>
                </time>
              </th>
              <td>{measurement(reading.temperatureC)}&nbsp;°C</td>
              <td>{measurement(reading.humidityPercent)}%</td>
              <td>
                <StatusBadge status={reading.waterDetected ? "WET" : "DRY"} />
              </td>
              {showId && (
                <td className="reading-id" translate="no">
                  {reading.readingUid || reading.id}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
