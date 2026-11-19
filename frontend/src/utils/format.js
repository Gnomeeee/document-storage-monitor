export function timestamp(value, short = false) {
  if (value === null || value === undefined) return "Not available";

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    ...(short ? {} : { month: "short", day: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
    ...(short ? {} : { second: "2-digit" }),
  }).format(new Date(value));
}

export function duration(milliseconds) {
  if (!Number.isFinite(milliseconds)) return "--";
  if (milliseconds < 60000) return `${milliseconds / 1000} sec`;
  return `${Number((milliseconds / 60000).toFixed(1))} min`;
}

export function measurement(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "--";
}

export function relativeTime(value, now = Date.now()) {
  if (!value) return "No readings";
  const seconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1000));

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
