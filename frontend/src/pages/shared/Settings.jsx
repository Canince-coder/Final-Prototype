import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogOut } from "lucide-react";
import { changePassword } from "../../api/auth";
import { ROLE_LABEL, useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { prefs } from "../../mock/local";
import { DemoNote, InfoItem, PageHeader } from "../../components/ui";

function PasswordForm() {
  const toast = useToast();
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (f.next.length < 8) return setError("New password must be at least 8 characters.");
    if (f.next !== f.confirm) return setError("New passwords don't match.");
    setBusy(true);
    try {
      await changePassword(f.current, f.next);
      toast("Password changed");
      setF({ current: "", next: "", confirm: "" });
    } catch (err) {
      setError(err.status === 403 ? "Current password is incorrect." : err.detail);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <label>Current password<input type={show ? "text" : "password"} required value={f.current} onChange={set("current")} autoComplete="current-password" /></label>
      <label>New password
        <div className="input-affix">
          <input type={show ? "text" : "password"} required minLength={8} value={f.next} onChange={set("next")} autoComplete="new-password" />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide passwords" : "Show passwords"}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
      </label>
      <label>Confirm new password<input type={show ? "text" : "password"} required value={f.confirm} onChange={set("confirm")} autoComplete="new-password" /></label>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div><button className="btn btn-primary" disabled={busy}>{busy ? "Updating..." : "Update password"}</button></div>
    </form>
  );
}

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [p, setP] = useState(() => prefs.get(user.id));
  const toggle = (k) => {
    const next = { ...p, [k]: !p[k] };
    setP(next);
    prefs.set(user.id, next);
    toast("Preference saved");
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Account security and preferences." />
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <section className="card">
          <h2 className="mb-16">Account</h2>
          <div className="info-list">
            <InfoItem label="Name" value={user.name} />
            <InfoItem label="Role" value={ROLE_LABEL[user.role]} />
            <InfoItem label="Email" value={user.email} />
            <InfoItem label="Session" value={user.demo ? "Demo (frontend only)" : "Signed in"} />
          </div>
          <button className="btn btn-danger mt-24" onClick={() => { logout(); navigate("/login"); }}><LogOut size={15} /> Sign out</button>
        </section>

        <section className="card">
          <h2 className="mb-16">Change password</h2>
          {user.demo
            ? <DemoNote>The demo admin exists only in the frontend prototype and has no backend account, so its password can't be changed here.</DemoNote>
            : <PasswordForm />}
        </section>

        <section className="card">
          <h2 className="mb-16">Notification preferences</h2>
          <div className="stack">
            {[["emailAlerts", "Email alerts for announcements"], ["jobAlerts", "New job matches"], ["trainingAlerts", "Training program updates"]].map(([k, l]) => (
              <label className="checkbox field" key={k}><input type="checkbox" checked={p[k]} onChange={() => toggle(k)} /> {l}</label>
            ))}
          </div>
          <p className="hint mt-16">Saved on this device. Email delivery isn't connected in this prototype.</p>
        </section>
      </div>
    </div>
  );
}
