import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, BadgeCheck, BriefcaseBusiness, ChevronRight, Eye, EyeOff, GraduationCap, Info,
  LineChart, ShieldCheck, Target,
} from "lucide-react";
import { demoAdminEnabled, homePath, ROLE_LABEL, useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";

const ROLES = [
  { key: "TRAINEE", icon: GraduationCap, title: "Trainee", desc: "Track skills, training and job matches" },
  { key: "EMPLOYEE", icon: BriefcaseBusiness, title: "Employee", desc: "Verify employment and grow your career" },
  { key: "ADMIN", icon: ShieldCheck, title: "Administrator", desc: "Monitor outcomes and plan courses" },
];

export function AuthAside() {
  return (
    <aside className="auth-aside">
      <div className="landing-brand">
        <span className="brand-mark">SB</span>
        <span>SkillBridge</span>
      </div>
      <div>
        <h2>From skilling to employment, in one place.</h2>
        <p>A single platform for trainees, employees and administrators to track skills, training and placement outcomes.</p>
        <div className="auth-aside-points mt-24">
          <div><Target size={18} /><p><b>Skill-based job matching</b>See exactly which skills match a role and which to improve.</p></div>
          <div><BadgeCheck size={18} /><p><b>Verified competencies</b>Projects, training and documents build a verified skill profile.</p></div>
          <div><LineChart size={18} /><p><b>Outcome analytics</b>State and district employment insight for administrators.</p></div>
        </div>
      </div>
      <p className="small">Smart India Hackathon · Problem 26135</p>
    </aside>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState(null);
  const [email, setEmail] = useState(() => localStorage.getItem("sb_remember_email") || "");
  const [remember, setRemember] = useState(() => Boolean(localStorage.getItem("sb_remember_email")));
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email.trim(), password, role);
      if (remember && !user.demo) localStorage.setItem("sb_remember_email", email.trim());
      else localStorage.removeItem("sb_remember_email");
      navigate(homePath(user.role));
    } catch (err) {
      setError(err.status === 401 ? "Incorrect email or password." : err.detail || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const selected = ROLES.find((r) => r.key === role);

  return (
    <div className="auth-page">
      <AuthAside />
      <main className="auth-main">
        <div className="auth-card">
          {params.get("expired") && (
            <div className="alert alert-warning mb-16"><Info size={16} /> Your session has expired. Please sign in again.</div>
          )}

          {!selected ? (
            <>
              <h1>Welcome back</h1>
              <p className="page-sub">Continue as</p>
              <div className="role-options" role="radiogroup" aria-label="Choose your role">
                {ROLES.map(({ key, icon: Icon, title, desc }) => (
                  <button key={key} type="button" role="radio" aria-checked={role === key} className={`role-option ${role === key ? "active" : ""}`} onClick={() => setRole(key)}>
                    <span className="role-icon"><Icon size={20} /></span>
                    <span><b>{title}</b><span>{desc}</span></span>
                    <ChevronRight size={18} className="chev" />
                  </button>
                ))}
              </div>
              <p className="auth-switch">New to SkillBridge? <Link to="/register">Create an account</Link></p>
            </>
          ) : (
            <>
              <button type="button" className="back-link" onClick={() => { setRole(null); setError(""); }}>
                <ArrowLeft size={15} /> Change role
              </button>
              <div className="row" style={{ gap: 12, marginBottom: 6 }}>
                <span className="role-option" style={{ padding: 0, border: "none", width: "auto", background: "none", boxShadow: "none" }}>
                  <span className="role-icon"><selected.icon size={20} /></span>
                </span>
                <div>
                  <h1 style={{ fontSize: "1.4rem" }}>{selected.title} sign in</h1>
                  <p className="small">{selected.desc}</p>
                </div>
              </div>

              {error && <div className="alert alert-error mt-16" role="alert"><AlertCircle size={16} /> {error}</div>}

              <form onSubmit={handleSubmit} className="form mt-16" noValidate={false}>
                <label>
                  {role === "ADMIN" && demoAdminEnabled ? "Email or username" : "Email"}
                  <input
                    type={role === "ADMIN" ? "text" : "email"}
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={role === "ADMIN" ? "admin@example.com" : "you@example.com"}
                  />
                </label>
                <label>
                  <span className="row-between">Password
                    <button type="button" className="btn btn-plain btn-sm" style={{ padding: 0 }} onClick={() => setForgotOpen(true)}>Forgot password?</button>
                  </span>
                  <div className="input-affix">
                    <input
                      type={showPw ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
                <label className="checkbox">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  Remember my email on this device
                </label>
                <button className="btn btn-primary btn-block btn-lg" disabled={loading}>
                  {loading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: "rgba(255,255,255,.4)", borderTopColor: "#fff" }} /> Signing in...</> : `Sign in as ${ROLE_LABEL[role]}`}
                </button>
              </form>

              {role === "ADMIN" && demoAdminEnabled && (
                <p className="hint mt-16">
                  Prototype: the demo admin (<code>admin</code>) opens the admin portal with demo data only. Real admin accounts sign in with their email.
                </p>
              )}
              {role !== "ADMIN" && (
                <p className="auth-switch">No account? <Link to="/register">Register</Link></p>
              )}
            </>
          )}
        </div>
      </main>

      <Modal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Reset your password"
        footer={<button className="btn btn-primary" onClick={() => setForgotOpen(false)}>OK</button>}
      >
        <div className="stack">
          <p>Self-service password reset isn't available in this prototype yet: the backend has no reset-email service.</p>
          <p>Please contact your training centre or platform administrator to reset your password. Signed-in users can change their password under <b>Settings</b>.</p>
        </div>
      </Modal>
    </div>
  );
}
