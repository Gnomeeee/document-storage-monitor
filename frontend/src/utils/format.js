const dateOptions = { timeZone: "Asia/Manila" };
const timeOptions = { hour: "2-digit", minute: "2-digit" };
const clock = new Intl.DateTimeFormat("en-PH", { ...dateOptions, ...timeOptions });
const timeWithSeconds = new Intl.DateTimeFormat("en-PH", {
  ...dateOptions,
  ...timeOptions,
  second: "2-digit",
});
const fullTime = new Intl.DateTimeFormat("en-PH", {
  ...dateOptions,
  ...timeOptions,
  month: "short",
  day: "numeric",
  second: "2-digit",
});
const day = new Intl.DateTimeFormat("en-PH", {
  ...dateOptions,
  month: "short",
  day: "numeric",
});
const decimal = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function timestamp(value, short = false) {
  if (value === null || value === undefined) return "Not available";
  return (short ? clock : fullTime).format(new Date(value));
}

export function dateLabel(value) {
  return day.format(new Date(value));
}

export function clockTime(value) {
  return timeWithSeconds.format(new Date(value));
}

export function duration(milliseconds) {
  if (!Number.isFinite(milliseconds)) return "--";
  if (milliseconds < 60000) return `${milliseconds / 1000} sec`;
  return `${Number((milliseconds / 60000).toFixed(1))} min`;
}

export function measurement(value) {
  return Number.isFinite(value) ? decimal.format(value) : "--";
}

export function relativeTime(value, now = Date.now()) {
  if (!value) return "No readings";
  const seconds = Math.max(0, Math.floor((now - Date.parse(value)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
