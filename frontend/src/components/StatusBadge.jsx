const statuses = {
  NORMAL: { label: "Normal", color: "bg-emerald-50 text-emerald-800" },
  WARNING: { label: "Warning", color: "bg-amber-50 text-amber-800" },
  CRITICAL: { label: "Critical", color: "bg-red-50 text-red-800" },
  ONLINE: { label: "Reporting", color: "bg-emerald-50 text-emerald-800" },
  STALE: { label: "Stale", color: "bg-amber-50 text-amber-800" },
  OFFLINE: { label: "Offline", color: "bg-red-50 text-red-800" },
  NO_DATA: { label: "No readings", color: "bg-slate-100 text-slate-700" },
  OPEN: { label: "Open", color: "bg-amber-50 text-amber-800" },
  CLEARED: { label: "Cleared", color: "bg-slate-100 text-slate-700" },
  WET: { label: "Wet", color: "bg-red-50 text-red-800" },
  DRY: { label: "Dry", color: "bg-emerald-50 text-emerald-800" },
  CONNECTED: { label: "Connected", color: "bg-emerald-50 text-emerald-800" },
  DISCONNECTED: { label: "Disconnected", color: "bg-amber-50 text-amber-800" },
};

export default function StatusBadge({ status }) {
  const { label, color } = statuses[status] || {
    label: "Unknown",
    color: "bg-slate-100 text-slate-700",
  };

  return (
    <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
