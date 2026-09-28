import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Check, CheckCheck, Megaphone, Sparkles, X } from "lucide-react";
import { useNotifications } from "../context/NotificationContext";
import { timeAgo } from "./ui";

export function NotificationItem({ n, onRead, onDismiss }) {
  const Icon = n.kind === "announcement" ? Megaphone : Sparkles;
  return (
    <div className={`notif ${n.read ? "" : "unread"}`}>
      <span className={`notif-icon ${n.kind === "announcement" ? "" : n.kind === "info" ? "info" : "success"}`}><Icon size={15} /></span>
      <div className="notif-body">
        <div className="notif-title">{n.title}</div>
        {n.text && <div className="notif-text">{n.text}</div>}
        <div className="notif-time">{timeAgo(n.time)}{n.kind === "announcement" ? " · Announcement" : ""}</div>
      </div>
      <div className="notif-actions">
        {!n.read && (
          <button className="btn btn-plain btn-sm" onClick={() => onRead(n.id)} aria-label="Mark as read" title="Mark as read"><Check size={14} /></button>
        )}
        <button className="btn btn-plain btn-sm" onClick={() => onDismiss(n.id)} aria-label="Clear notification" title="Clear"><X size={14} /></button>
      </div>
    </div>
  );
}

export default function NotificationBell({ allPath }) {
  const { items, unread, markRead, markAllRead, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label={`Notifications, ${unread} unread`} aria-expanded={open}>
        <Bell size={17} />
        {unread > 0 && <span className="bell-count">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="dropdown-panel" role="menu">
          <div className="dropdown-head">
            <h3>Notifications</h3>
            {unread > 0 && (
              <button className="btn btn-plain btn-sm" onClick={markAllRead}><CheckCheck size={14} /> Mark all read</button>
            )}
          </div>
          <div className="dropdown-list">
            {items.length === 0 ? (
              <p className="small" style={{ padding: 24, textAlign: "center" }}>You're all caught up.</p>
            ) : (
              items.slice(0, 8).map((n) => <NotificationItem key={n.id} n={n} onRead={markRead} onDismiss={dismiss} />)
            )}
          </div>
          {allPath && (
            <div className="dropdown-foot">
              <Link to={allPath} onClick={() => setOpen(false)}>View all notifications</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
