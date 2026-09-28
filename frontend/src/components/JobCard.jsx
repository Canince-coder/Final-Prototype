import { Briefcase, Check, Clock, MapPin, TrendingUp, X } from "lucide-react";
import { ProgressBar } from "./ui";

/** Works with both RecommendedJobOut (trainee) and EmployeeJobOut (employee) shapes. */
export default function JobCard({ job, meta = {}, onView, actions, compact }) {
  const pct = job.eligibility_score ?? job.match_percentage;
  const tone = pct >= 80 ? "success" : pct >= 55 ? "info" : "warning";
  return (
    <article className="card card-hover job-card">
      <div className="job-card-top">
        <div style={{ minWidth: 0 }}>
          <h3>{job.title}</h3>
          <p className="job-card-sub">{job.company}</p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div className="stat-value" style={{ fontSize: "1.35rem", color: `var(--${tone === "info" ? "info" : tone})` }}>{pct}%</div>
          <div className="small muted">{job.eligibility_score !== undefined ? "Eligibility" : "Skill match"}</div>
        </div>
      </div>
      <ProgressBar value={pct} tone={tone === "info" ? "info" : tone} />
      <div className="job-meta">
        <span><MapPin size={13} /> {job.location}</span>
        {meta.experience !== undefined && <span><Clock size={13} /> {meta.experience > 0 ? `${meta.experience}+ yrs` : "Freshers"}</span>}
        {meta.type && <span><Briefcase size={13} /> {meta.type}</span>}
      </div>

      {!compact && (
        <div className="grid grid-2" style={{ gap: 12 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Matched</div>
            <ul className="skill-check">
              {job.matching_skills.length === 0 && <li className="muted">None yet</li>}
              {job.matching_skills.map((s) => <li key={s}><Check size={14} className="ok" />{s}</li>)}
            </ul>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>To improve</div>
            <ul className="skill-check">
              {job.skills_to_improve.length + job.missing_skills.length === 0 && <li className="muted">No gaps</li>}
              {job.skills_to_improve.map((s) => <li key={s}><TrendingUp size={14} className="gap" />{s} <span className="small muted">(level up)</span></li>)}
              {job.missing_skills.map((s) => <li key={s}><X size={14} className="miss" />{s}</li>)}
            </ul>
          </div>
        </div>
      )}

      {job.eligibility_score !== undefined && !compact && (
        <div className="tags">
          <span className={`tag ${job.experience_met ? "tag-success" : "tag-warning"}`}>
            Experience {job.experience_years} / {job.experience_required_years} yrs
          </span>
          <span className={`tag ${job.education_met ? "tag-success" : "tag-warning"}`}>
            Education {job.education_met ? "met" : "below requirement"}
          </span>
        </div>
      )}

      <div className="card-actions">
        {onView && <button className="btn btn-primary btn-sm" onClick={() => onView(job)}>View job</button>}
        {actions}
      </div>
    </article>
  );
}
