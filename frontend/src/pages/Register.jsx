import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, BriefcaseBusiness, Eye, EyeOff, GraduationCap } from "lucide-react";
import { register } from "../api/auth";
import { INDIAN_STATES } from "../data/india";
import { AuthAside } from "./Login";
import { useToast } from "../context/ToastContext";

const initialState = { name: "", email: "", password: "", role: "TRAINEE", state: "", district: "", education: "", phone: "" };

export default function Register() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(initialState);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.phone && !/^\+?[0-9 -]{8,15}$/.test(form.phone)) {
      setError("Enter a valid phone number.");
      return;
    }
    setLoading(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === "" ? undefined : v]));
      await register(payload);
      toast("Account created. Please sign in.");
      navigate("/login");
    } catch (err) {
      setError(err.detail || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <AuthAside />
      <main className="auth-main">
        <div className="auth-card auth-card-wide">
          <h1>Create your account</h1>
          <p className="page-sub">Administrator accounts are issued by the platform team.</p>
          {error && <div className="alert alert-error mt-16" role="alert"><AlertCircle size={16} /> {error}</div>}
          <form onSubmit={handleSubmit} className="form mt-16">
            <div className="role-options" role="radiogroup" aria-label="Account type" style={{ flexDirection: "row", margin: 0 }}>
              {[["TRAINEE", GraduationCap, "Trainee"], ["EMPLOYEE", BriefcaseBusiness, "Employee"]].map(([key, Icon, label]) => (
                <button type="button" key={key} role="radio" aria-checked={form.role === key}
                  className={`role-option ${form.role === key ? "active" : ""}`} onClick={() => setForm({ ...form, role: key })}>
                  <span className="role-icon"><Icon size={18} /></span><b>{label}</b>
                </button>
              ))}
            </div>
            <div className="form-grid">
              <label className="full">Full name<input required value={form.name} onChange={update("name")} autoComplete="name" /></label>
              <label>Email<input type="email" required value={form.email} onChange={update("email")} autoComplete="email" /></label>
              <label>Phone<input value={form.phone} onChange={update("phone")} autoComplete="tel" inputMode="tel" /></label>
              <label className="full">
                Password
                <div className="input-affix">
                  <input type={showPw ? "text" : "password"} required minLength={8} value={form.password} onChange={update("password")} autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"}>
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span className="hint">At least 8 characters.</span>
              </label>
              <label>
                State
                <select value={form.state} onChange={update("state")}>
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label>District<input value={form.district} onChange={update("district")} /></label>
              <label className="full">Highest education<input value={form.education} onChange={update("education")} placeholder="e.g. B.Tech Computer Science" /></label>
            </div>
            <button className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
          <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
      </main>
    </div>
  );
}
