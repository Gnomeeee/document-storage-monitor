import { Inbox } from "lucide-react";

export default function EmptyState({
  title,
  message,
  icon: Icon = Inbox,
  loading = false,
}) {
  return (
    <div className="empty-state" aria-busy={loading}>
      <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
      <p>{title}</p>
      {message && <small>{message}</small>}
      {loading && <span aria-hidden="true" className="loading-line" />}
    </div>
  );
}
