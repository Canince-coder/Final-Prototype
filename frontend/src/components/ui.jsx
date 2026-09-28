/** Small presentational building blocks shared by every portal. */
import { Info } from "lucide-react";

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function SectionHead({ title, subtitle, actions }) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p className="small">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, tone = "", hint, onClick, small }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={`card stat ${onClick ? "card-hover" : ""}`} onClick={onClick} type={onClick ? "button" : undefined}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {Icon && <span className={`stat-icon ${tone}`}><Icon size={17} /></span>}
      </div>
      <div className={`stat-value ${small ? "sm" : ""}`}>{value}</div>
      {hint && <span className="small muted">{hint}</span>}
    </Tag>
  );
}

export function Avatar({ name = "", size }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
  return <span className={`avatar ${size === "lg" ? "avatar-lg" : ""}`} aria-hidden="true">{initials}</span>;
}

export function InfoItem({ label, value, children }) {
  return (
    <div className="info-item">
      <span className="label">{label}</span>
      <span className="value">{children ?? (value || <span className="muted">—</span>)}</span>
    </div>
  );
}

const TONES = {
  VERIFIED: "success", COMPLETED: "success", EMPLOYED: "success", ACTIVE: "success", ELIGIBLE: "success",
  PENDING: "warning", ENROLLED: "info", ONGOING: "info", UNVERIFIED: "neutral", INACTIVE: "neutral",
  REJECTED: "danger", DROPPED: "neutral", UNEMPLOYED: "warning", UPCOMING: "primary",
  HIGH: "danger", "VERY HIGH": "danger", MEDIUM: "warning", LOW: "success",
};
const pretty = (s) => String(s).replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export function StatusBadge({ status, label, tone }) {
  if (!status) return null;
  return <span className={`badge badge-dot badge-${tone || TONES[String(status).toUpperCase()] || "neutral"}`}>{label || pretty(status)}</span>;
}

export function ProgressBar({ value, max = 100, tone }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const auto = pct >= 75 ? "success" : pct >= 45 ? "" : "warning";
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-fill ${tone ?? auto}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ScoreRing({ value, max = 100, size = 120, stroke = 10, label, sub, color = "var(--primary)" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${label ?? value} ${sub ?? ""}`}>
      <svg width={size} height={size}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle className="ring-value" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div className="ring-label">
        <span className="ring-num" style={{ fontSize: size * 0.24 }}>{label ?? value}</span>
        {sub && <span className="ring-sub">{sub}</span>}
      </div>
    </div>
  );
}

/** Honest labelling for anything that is not live backend data / not real security. */
export function DemoNote({ children }) {
  return (
    <div className="card-note">
      <Info size={15} />
      <span>{children}</span>
    </div>
  );
}

export function MatchPill({ value }) {
  const tone = value >= 80 ? "success" : value >= 55 ? "info" : value >= 35 ? "warning" : "danger";
  return <span className={`badge badge-${tone}`}>{value}% match</span>;
}

export const fmtDate = (d, opts = { day: "numeric", month: "short", year: "numeric" }) =>
  d ? new Date(d).toLocaleDateString("en-IN", opts) : "—";

export function timeAgo(d) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
  if (s < 172800) return "Yesterday";
  return `${Math.floor(s / 86400)} days ago`;
}
