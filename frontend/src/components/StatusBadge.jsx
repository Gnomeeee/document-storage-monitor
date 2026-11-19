import {
  CircleCheck,
  CircleHelp,
  CircleMinus,
  Clock3,
  Droplet,
  Radio,
  TriangleAlert,
  WifiOff,
} from "lucide-react";

const states = {
  NORMAL: ["Normal", "good", CircleCheck],
  WARNING: ["Warning", "warning", TriangleAlert],
  CRITICAL: ["Critical", "danger", TriangleAlert],
  ONLINE: ["Reporting", "good", Radio],
  STALE: ["Delayed", "warning", Clock3],
  OFFLINE: ["Offline", "muted", WifiOff],
  NO_DATA: ["No data", "muted", CircleMinus],
  OPEN: ["Open", "warning", Clock3],
  CLEARED: ["Cleared", "good", CircleCheck],
  WET: ["Wet", "danger", Droplet],
  DRY: ["Dry", "good", CircleCheck],
  CONNECTED: ["Connected", "good", Radio],
  DISCONNECTED: ["Disconnected", "muted", WifiOff],
  UNKNOWN: ["Unknown", "muted", CircleHelp],
};

export default function StatusBadge({ status }) {
  const [label, tone, Icon] = states[status] || states.UNKNOWN;

  return (
    <span className={`status-badge tone-${tone}`}>
      <Icon size={13} aria-hidden="true" />
      {label}
    </span>
  );
}
