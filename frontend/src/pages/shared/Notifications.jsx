import { useState } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";
import { EmptyState } from "../../components/States";
import { PageHeader } from "../../components/ui";
import { NotificationItem } from "../../components/NotificationBell";

export default function Notifications() {
  const { items, unread, markRead, markAllRead, dismiss, clearAll } = useNotifications();
  const [tab, setTab] = useState("all");
  const shown = items.filter((n) => tab === "all" || (tab === "unread" ? !n.read : n.kind === "announcement"));

  return (
    <div>
      <PageHeader title="Notifications" subtitle={`${unread} unread`}
        actions={<>
          <button className="btn btn-ghost" onClick={markAllRead} disabled={!unread}><CheckCheck size={15} /> Mark all read</button>
          <button className="btn btn-plain" onClick={clearAll} disabled={!items.length}><Trash2 size={15} /> Clear all</button>
        </>} />
      <div className="segmented mb-16" role="tablist">
        {[["all", "All"], ["unread", "Unread"], ["announcement", "Announcements"]].map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} className={tab === v ? "active" : ""} onClick={() => setTab(v)}>{l}</button>
        ))}
      </div>
      <div className="table-card">
        {shown.length === 0 ? (
          <EmptyState icon={Bell} title="You're all caught up" message="New announcements and activity updates will appear here." />
        ) : (
          shown.map((n) => <NotificationItem key={n.id} n={n} onRead={markRead} onDismiss={dismiss} />)
        )}
      </div>
    </div>
  );
}
