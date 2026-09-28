import { useState } from "react";
import { Megaphone, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { adminApi } from "../../api/admin";
import { isDemoSession } from "../../api/client";
import useAsync from "../../hooks/useAsync";
import { useToast } from "../../context/ToastContext";
import { useNotifications } from "../../context/NotificationContext";
import { announcementMeta } from "../../mock/local";
import { AsyncSection, EmptyState, SkeletonCards } from "../../components/States";
import { DemoNote, PageHeader, StatusBadge, fmtDate } from "../../components/ui";
import Modal, { ConfirmModal } from "../../components/Modal";

const AUDIENCE = { ALL: "All users", TRAINEES: "All trainees", EMPLOYEES: "All employees" };
const CATEGORIES = ["General", "Training", "Jobs", "Verification", "Events", "Maintenance"];
const PRIORITIES = ["HIGH", "MEDIUM", "LOW"];

const withMeta = (a) => ({ category: "General", priority: "MEDIUM", ...announcementMeta.get(a.id), ...(a.category ? { category: a.category, priority: a.priority } : {}), ...a });
const statusOf = (a) => (!a.is_active ? "INACTIVE" : a.expires_at && new Date(a.expires_at) < new Date() ? "EXPIRED" : "ACTIVE");

function AnnouncementForm({ initial, onSubmit }) {
  const [f, setF] = useState(() => initial
    ? { ...initial, expires_at: initial.expires_at ? initial.expires_at.slice(0, 10) : "" }
    : { title: "", message: "", category: "General", target_audience: "TRAINEES", expires_at: "", priority: "MEDIUM", is_active: true });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form id="announcement-form" className="form" onSubmit={(e) => { e.preventDefault(); onSubmit(f); }}>
      <label>Title<input required minLength={3} maxLength={200} value={f.title} onChange={set("title")} placeholder="Advanced Python Training" /></label>
      <label>Description<textarea required rows={4} maxLength={5000} value={f.message} onChange={set("message")} placeholder="Registration for the upcoming training program is now open." /></label>
      <div className="form-grid">
        <label>Category<select value={f.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Target audience<select value={f.target_audience} onChange={set("target_audience")}>{Object.entries(AUDIENCE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>Expiry date (optional)<input type="date" value={f.expires_at} min={new Date().toISOString().slice(0, 10)} onChange={set("expires_at")} /></label>
        <label>Priority<select value={f.priority} onChange={set("priority")}>{PRIORITIES.map((p) => <option key={p} value={p}>{p.toLowerCase()}</option>)}</select></label>
        <label className="checkbox full"><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Publish now (visible to the audience)</label>
      </div>
    </form>
  );
}

export default function Announcements() {
  const toast = useToast();
  const { refresh } = useNotifications();
  const state = useAsync(adminApi.announcements);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [audience, setAudience] = useState("");
  const close = () => setModal(null);

  const save = async (f) => {
    setBusy(true);
    const payload = {
      title: f.title.trim(), message: f.message.trim(), target_audience: f.target_audience, is_active: f.is_active,
      expires_at: f.expires_at ? new Date(`${f.expires_at}T23:59:59`).toISOString() : null,
      ...(isDemoSession() ? { category: f.category, priority: f.priority } : {}),
    };
    try {
      const saved = modal.item ? await adminApi.updateAnnouncement(modal.item.id, payload) : await adminApi.createAnnouncement(payload);
      announcementMeta.set(saved.id, { category: f.category, priority: f.priority });
      toast(modal.item ? "Announcement updated" : "Announcement published");
      close();
      state.reload();
      refresh();
    } catch (err) {
      toast(err.detail, "error");
    } finally {
      setBusy(false);
    }
  };

  const quick = async (fn, msg) => {
    try {
      await fn();
      toast(msg);
      state.reload();
      refresh();
    } catch (err) {
      toast(err.detail, "error");
    }
  };

  return (
    <div>
      <PageHeader title="Announcements" subtitle="Publish notices that appear in users' notification bells."
        actions={<button className="btn btn-primary" onClick={() => setModal({ type: "form" })}><Plus size={16} /> New announcement</button>} />
      <div className="segmented mb-16" role="tablist">
        {[["", "All"], ...Object.entries(AUDIENCE)].map(([v, l]) => (
          <button key={v} role="tab" aria-selected={audience === v} className={audience === v ? "active" : ""} onClick={() => setAudience(v)}>{v ? l.replace("All ", "") : l}</button>
        ))}
      </div>
      <AsyncSection state={state} skeleton={<SkeletonCards count={3} label="Loading announcements..." />}>
        {(rows) => {
          const list = rows.map(withMeta).filter((a) => !audience || a.target_audience === audience);
          return list.length === 0 ? (
            <div className="card"><EmptyState icon={Megaphone} title="No announcements" message="Create an announcement to notify trainees and employees."
              action={<button className="btn btn-primary btn-sm" onClick={() => setModal({ type: "form" })}>New announcement</button>} /></div>
          ) : (
            <div className="stack">
              {list.map((a) => (
                <article className="card card-hover" key={a.id}>
                  <div className="row-between" style={{ alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="row" style={{ marginBottom: 6 }}>
                        <h3>{a.title}</h3>
                        <StatusBadge status={a.priority} label={`${a.priority.toLowerCase()} priority`} />
                        <StatusBadge status={statusOf(a)} tone={statusOf(a) === "EXPIRED" ? "neutral" : undefined} />
                      </div>
                      <p style={{ color: "var(--text-2)" }}>{a.message}</p>
                      <div className="job-meta mt-8">
                        <span>{a.category}</span><span>Target: {AUDIENCE[a.target_audience]}</span>
                        <span>Created {fmtDate(a.created_at)}</span>{a.expires_at && <span>Expires {fmtDate(a.expires_at)}</span>}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn btn-plain btn-sm" aria-label={`Edit ${a.title}`} onClick={() => setModal({ type: "form", item: a })}><Pencil size={14} /></button>
                      <button className="btn btn-plain btn-sm" title={a.is_active ? "Unpublish" : "Publish"} aria-label={a.is_active ? "Unpublish" : "Publish"}
                        onClick={() => quick(() => adminApi.updateAnnouncement(a.id, { is_active: !a.is_active }), a.is_active ? "Unpublished" : "Published")}><Power size={14} /></button>
                      <button className="btn btn-plain btn-sm" aria-label={`Delete ${a.title}`} onClick={() => setModal({ type: "delete", item: a })}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          );
        }}
      </AsyncSection>
      <div className="mt-16">
        <DemoNote>{isDemoSession()
          ? "Demo mode: announcements are stored in this browser only and are not sent to real users."
          : "Title, message, audience, expiry and status are saved on the server. Category and priority are not stored by the backend yet; they are kept in this browser."}</DemoNote>
      </div>

      <Modal open={modal?.type === "form"} onClose={close} size="lg" title={modal?.item ? "Edit announcement" : "New announcement"}
        footer={<><button className="btn btn-ghost" onClick={close}>Cancel</button><button className="btn btn-primary" form="announcement-form" disabled={busy}>{busy ? "Saving..." : modal?.item ? "Save" : "Publish"}</button></>}>
        {modal?.type === "form" && <AnnouncementForm initial={modal.item} onSubmit={save} />}
      </Modal>
      <ConfirmModal open={modal?.type === "delete"} onClose={close} title="Delete announcement?" message={`"${modal?.item?.title}" will be removed for all users.`}
        onConfirm={async () => { await quick(() => adminApi.deleteAnnouncement(modal.item.id), "Announcement deleted"); close(); }} />
    </div>
  );
}
