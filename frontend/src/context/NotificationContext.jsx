/**
 * Notifications = backend announcements for the user's audience (GET /announcements)
 *               + local activity events (resume analysed, project assessed, ...).
 * Read / cleared state is kept per user in localStorage (the backend has no
 * per-user notification store).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { listAnnouncements } from "../api/catalog";
import { localValue } from "../mock/store";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.id;
  const k = (name) => `sb_notif_${name}_${uid}`;
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [readIds, setReadIds] = useState([]);
  const [hiddenIds, setHiddenIds] = useState([]);

  const refresh = useCallback(() => {
    if (!uid) return;
    listAnnouncements()
      .then((rows) =>
        setAnnouncements(
          rows
            .filter((a) => a.is_active !== false && (!a.expires_at || new Date(a.expires_at) > new Date()))
            .map((a) => ({ id: `ann-${a.id}`, title: a.title, text: a.message, time: a.created_at, kind: "announcement" }))
        )
      )
      .catch(() => {}); // notifications are non-critical; the bell just shows local events
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    setEvents(localValue.read(k("events"), [
      { id: "welcome", title: "Welcome to SkillBridge", text: "Your notifications will appear here.", time: new Date().toISOString(), kind: "info" },
    ]));
    setReadIds(localValue.read(k("read"), []));
    setHiddenIds(localValue.read(k("hidden"), []));
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, refresh]);

  const persist = (name, setter) => (value) => {
    setter(value);
    localValue.write(k(name), value);
  };
  const saveRead = persist("read", setReadIds);
  const saveHidden = persist("hidden", setHiddenIds);
  const saveEvents = persist("events", setEvents);

  const items = useMemo(
    () =>
      [...announcements, ...events]
        .filter((n) => !hiddenIds.includes(n.id))
        .map((n) => ({ ...n, read: readIds.includes(n.id) }))
        .sort((a, b) => new Date(b.time) - new Date(a.time)),
    [announcements, events, readIds, hiddenIds]
  );

  const value = {
    items,
    unread: items.filter((n) => !n.read).length,
    refresh,
    markRead: (id) => !readIds.includes(id) && saveRead([...readIds, id]),
    markAllRead: () => saveRead([...new Set([...readIds, ...items.map((n) => n.id)])]),
    dismiss: (id) => saveHidden([...hiddenIds, id]),
    clearAll: () => saveHidden([...new Set([...hiddenIds, ...items.map((n) => n.id)])]),
    notify: (title, text, kind = "success") =>
      saveEvents([{ id: `evt-${Date.now()}`, title, text, time: new Date().toISOString(), kind }, ...events].slice(0, 50)),
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export const useNotifications = () => useContext(NotificationContext);
