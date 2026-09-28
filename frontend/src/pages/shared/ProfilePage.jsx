import { useState } from "react";
import { Copy, Lock, Mail, Pencil, ShieldCheck } from "lucide-react";
import { getMyTraineeProfile, updateMyTraineeProfile } from "../../api/trainees";
import { getEmployeeProfile } from "../../api/employees";
import { changeEmail, verifyPassword } from "../../api/auth";
import { traineeProfile, employeeProfile } from "../../api/profile";
import useAsync from "../../hooks/useAsync";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { fallbackUid, profileExtras } from "../../mock/local";
import { INDIAN_STATES } from "../../data/india";
import { AsyncSection, Skeleton } from "../../components/States";
import { Avatar, DemoNote, InfoItem, PageHeader, ProgressBar, StatusBadge, fmtDate } from "../../components/ui";
import Modal from "../../components/Modal";

const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];

/**
 * Identity check before editing.
 * - Password: verified by the backend (re-uses POST /auth/login; token discarded).
 * - Email / phone code: PROTOTYPE ONLY. No OTP service exists; the code is shown on screen.
 */
function VerifyModal({ open, onClose, onVerified, email, phone }) {
  const [method, setMethod] = useState("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (method === "password") {
      setBusy(true);
      try {
        await verifyPassword(email, password);
        onVerified({ method, password });
        setPassword("");
      } catch (err) {
        setError(err.status === 401 ? "Incorrect password." : err.detail);
      } finally {
        setBusy(false);
      }
    } else if (code === sent) {
      onVerified({ method: "code", password: null });
      setCode("");
      setSent(null);
    } else {
      setError("That code doesn't match.");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Verify your identity" description="Confirm it's you before editing your profile."
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" form="verify-form" disabled={busy || (method === "code" && !sent)}>{busy ? "Verifying..." : "Continue"}</button></>}>
      <div className="segmented mb-16" role="tablist">
        <button role="tab" aria-selected={method === "password"} className={method === "password" ? "active" : ""} onClick={() => { setMethod("password"); setError(""); }}><Lock size={13} /> Password</button>
        <button role="tab" aria-selected={method === "code"} className={method === "code" ? "active" : ""} onClick={() => { setMethod("code"); setError(""); }}><Mail size={13} /> Email / phone code</button>
      </div>
      <form id="verify-form" className="form" onSubmit={submit}>
        {method === "password" ? (
          <label>Enter your password<input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setSent(String(Math.floor(100000 + Math.random() * 900000)))}>
              {sent ? "Resend code" : `Send code to ${email}${phone ? " / " + phone : ""}`}
            </button>
            {sent && (
              <>
                <DemoNote>Prototype: no email/SMS service is connected, so nothing is actually sent and this is <b>not</b> real verification. Your demo code is <b className="mono">{sent}</b>. Changing email or phone still requires password verification, which the server enforces.</DemoNote>
                <label>Verification code<input inputMode="numeric" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} /></label>
              </>
            )}
          </>
        )}
        {error && <div className="alert alert-error" role="alert">{error}</div>}
      </form>
    </Modal>
  );
}

export default function ProfilePage({ role }) {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const isTrainee = role === "TRAINEE";
  const api = isTrainee ? traineeProfile : employeeProfile;
  const state = useAsync(() => Promise.all([isTrainee ? getMyTraineeProfile() : getEmployeeProfile(), api.skills()]), [role]);
  const [extras, setExtras] = useState(() => profileExtras.get(user.id));
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [session, setSession] = useState(null); // {method, password} once verified
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const startEdit = (verified) => {
    const [p] = state.data;
    setSession(verified);
    setVerifyOpen(false);
    setForm({ name: p.user.name, email: p.user.email, phone: p.phone || "", state: p.state || "", district: p.district, education: p.education, ...extras });
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    const [p] = state.data;
    setError("");
    if (form.phone && !/^\+?[0-9 -]{8,15}$/.test(form.phone)) return setError("Enter a valid phone number.");
    const emailChanged = form.email.trim() !== p.user.email;
    const phoneChanged = (form.phone || "") !== (p.phone || "");
    if ((emailChanged || phoneChanged) && !session.password) {
      return setError("Changing email or phone requires verifying with your password. Cancel and verify again with your password.");
    }
    setSaving(true);
    try {
      if (isTrainee) {
        await updateMyTraineeProfile({
          name: form.name, state: form.state || null, district: form.district, education: form.education,
          phone: form.phone, current_password: session.password || undefined,
        });
      }
      if (emailChanged) {
        const me = await changeEmail(session.password, form.email.trim());
        updateUser({ email: me.email });
      }
      if (isTrainee && form.name !== user.name) updateUser({ name: form.name });
      const nextExtras = Object.fromEntries(["dob", "gender", "address", "institution", "graduation_year"].map((k) => [k, form[k] || ""]));
      profileExtras.set(user.id, nextExtras);
      setExtras(nextExtras);
      toast("Profile updated");
      setForm(null);
      setSession(null);
      state.reload();
    } catch (err) {
      setError(err.detail);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title={isTrainee ? "Trainee Profile" : "Profile"} subtitle="Your personal, contact and education details."
        actions={!form && state.data && <button className="btn btn-primary" onClick={() => setVerifyOpen(true)}><Pencil size={15} /> Edit profile</button>} />
      <AsyncSection state={state} skeleton={<div className="card stack"><Skeleton width="30%" height={22} /><Skeleton /><Skeleton width="70%" /></div>}>
        {([p, skills]) => {
          const uid = p.trainee_uid || fallbackUid(user.id);
          const fields = [p.user.name, p.user.email, p.phone, extras.dob, extras.gender, extras.address, p.state, p.district,
            p.education !== "Not specified" && p.education, extras.institution, extras.graduation_year, skills.length > 0];
          const completion = Math.round((fields.filter(Boolean).length / fields.length) * 100);
          return (
            <div className="stack-lg">
              <section className="card">
                <div className="row-between" style={{ alignItems: "flex-start" }}>
                  <div className="row" style={{ gap: 16 }}>
                    <Avatar name={p.user.name} size="lg" />
                    <div>
                      <h2>{p.user.name}</h2>
                      <div className="row mt-8">
                        <span className="uid-chip mono">
                          {uid}
                          <button className="btn btn-plain btn-sm" style={{ padding: 2 }} aria-label="Copy trainee UID"
                            onClick={() => navigator.clipboard?.writeText(uid)?.then(() => toast("UID copied"))}><Copy size={13} /></button>
                        </span>
                        {p.employee_uid && <span className="uid-chip mono" title="Employee ID">{p.employee_uid}</span>}
                        <StatusBadge status={p.employment_status} />
                      </div>
                      <p className="small mt-8">Member since {fmtDate(p.created_at)}</p>
                    </div>
                  </div>
                  <div style={{ minWidth: 200 }}>
                    <div className="row-between small"><span>Profile completion</span><b>{completion}%</b></div>
                    <div className="mt-8"><ProgressBar value={completion} /></div>
                  </div>
                </div>
              </section>

              {!form ? (
                <div className="grid grid-2">
                  <section className="card">
                    <h2 className="mb-16">Personal & contact</h2>
                    <div className="info-list">
                      <InfoItem label="Full name" value={p.user.name} />
                      <InfoItem label="Trainee UID" value={uid} />
                      <InfoItem label="Email" value={p.user.email} />
                      <InfoItem label="Phone" value={p.phone} />
                      <InfoItem label="Date of birth" value={extras.dob && fmtDate(extras.dob)} />
                      <InfoItem label="Gender" value={extras.gender} />
                    </div>
                  </section>
                  <section className="card">
                    <h2 className="mb-16">Address</h2>
                    <div className="info-list">
                      <InfoItem label="Address" value={extras.address} />
                      <InfoItem label="State" value={p.state} />
                      <InfoItem label="District" value={p.district} />
                      <InfoItem label="Employment status"><StatusBadge status={p.employment_status} /></InfoItem>
                    </div>
                  </section>
                  <section className="card">
                    <h2 className="mb-16">Education</h2>
                    <div className="info-list">
                      <InfoItem label="Education" value={p.education} />
                      <InfoItem label="Institution" value={extras.institution} />
                      <InfoItem label="Graduation year" value={extras.graduation_year} />
                    </div>
                  </section>
                  <section className="card">
                    <h2 className="mb-16">Skills</h2>
                    {skills.length ? <div className="tags">{skills.map((s) => <span className="tag" key={s.id}>{s.skill.name}</span>)}</div> : <p className="small">No skills added yet.</p>}
                  </section>
                  <div className="span-2">
                    <DemoNote>Date of birth, gender, address, institution and graduation year are not stored by the backend yet; they are saved in this browser only.</DemoNote>
                  </div>
                </div>
              ) : (
                <form className="card form" onSubmit={save}>
                  <div className="row-between">
                    <h2>Edit profile</h2>
                    <span className="badge badge-success"><ShieldCheck size={13} /> Verified by {session.method === "password" ? "password" : "code (prototype)"}</span>
                  </div>
                  {!isTrainee && <DemoNote>Employee name, location and education can't be edited here yet: the backend has no employee profile update endpoint. Email and the extra fields below can be updated.</DemoNote>}
                  <div className="form-grid">
                    <label>Full name<input required value={form.name} onChange={set("name")} disabled={!isTrainee} /></label>
                    <label>Email<input type="email" required value={form.email} onChange={set("email")} disabled={!session.password} />
                      {!session.password && <span className="hint">Verify with your password to change email.</span>}</label>
                    <label>Phone<input value={form.phone} onChange={set("phone")} disabled={!isTrainee || !session.password} inputMode="tel" /></label>
                    <label>Date of birth<input type="date" value={form.dob || ""} onChange={set("dob")} max={new Date().toISOString().slice(0, 10)} /></label>
                    <label>Gender<select value={form.gender || ""} onChange={set("gender")}><option value="">Select</option>{GENDERS.map((g) => <option key={g}>{g}</option>)}</select></label>
                    <label>State<select value={form.state} onChange={set("state")} disabled={!isTrainee}><option value="">Select state</option>{INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
                    <label>District<input required value={form.district} onChange={set("district")} disabled={!isTrainee} /></label>
                    <label className="full">Address<textarea rows={2} value={form.address || ""} onChange={set("address")} /></label>
                    <label>Education<input required value={form.education} onChange={set("education")} disabled={!isTrainee} /></label>
                    <label>Institution<input value={form.institution || ""} onChange={set("institution")} /></label>
                    <label>Graduation year<input type="number" min={1970} max={2040} value={form.graduation_year || ""} onChange={set("graduation_year")} /></label>
                  </div>
                  {error && <div className="alert alert-error" role="alert">{error}</div>}
                  <div className="row" style={{ justifyContent: "flex-end" }}>
                    <button type="button" className="btn btn-ghost" onClick={() => { setForm(null); setSession(null); setError(""); }}>Cancel</button>
                    <button className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
                  </div>
                </form>
              )}
            </div>
          );
        }}
      </AsyncSection>
      <VerifyModal open={verifyOpen} onClose={() => setVerifyOpen(false)} onVerified={startEdit} email={user.email} phone={state.data?.[0]?.phone} />
    </div>
  );
}
