import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getJob, getJobMatch } from "../../api/jobs";
import { applyToJob } from "../../api/applications";
import { Loading, ErrorState } from "../../components/States";
import { MatchBadge } from "../../components/Badges";

export default function JobDetails() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [match, setMatch] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [applied, setApplied] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([getJob(jobId), getJobMatch(jobId)])
      .then(([j, m]) => {
        setJob(j);
        setMatch(m);
      })
      .catch((err) => setError(err.detail || "Unable to load this job."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [jobId]);

  const handleApply = async () => {
    setApplying(true);
    setApplyError("");
    try {
      await applyToJob(jobId);
      setApplied(true);
    } catch (err) {
      if (err.status === 409) {
        setApplied(true);
      } else {
        setApplyError(err.detail || "Could not submit your application.");
      }
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <Loading label="Loading job..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{job.title}</h1>
          <p className="page-sub">
            {job.employer.company_name} · {job.location}
          </p>
        </div>
        <MatchBadge percentage={match.match_percentage} />
      </div>

      <div className="detail-grid">
        <div className="card">
          <h2>About this role</h2>
          {(job.salary_min || job.salary_max) && (
            <p className="job-salary">
              ₹{job.salary_min ?? "—"} - ₹{job.salary_max ?? "—"}
            </p>
          )}
          <p>{job.description || "No description provided."}</p>

          <h3>Requirements</h3>
          <ul className="requirement-list">
            {job.requirements.map((req) => (
              <li key={req.id}>
                {req.skill.name} — Level {req.required_level}
                {req.required ? "" : " (optional)"}
              </li>
            ))}
          </ul>

          <div className="detail-actions">
            {applied ? (
              <div className="alert alert-success">You've applied to this job.</div>
            ) : (
              <button className="btn btn-primary" onClick={handleApply} disabled={applying}>
                {applying ? "Applying..." : "Apply Now"}
              </button>
            )}
            <Link to={`/trainee/jobs/${jobId}/skill-gap`} className="btn btn-secondary">
              View Skill Gap
            </Link>
          </div>
          {applyError && <div className="alert alert-error">{applyError}</div>}
        </div>

        <div className="card">
          <h2>Your Match: {match.match_percentage}%</h2>

          <h3 className="match-section-title strengths">Strengths</h3>
          {match.strengths.length === 0 ? (
            <p className="job-card-sub">No matched skills yet.</p>
          ) : (
            <ul className="match-list">
              {match.strengths.map((s) => (
                <li key={s.skill_id}>✓ {s.skill_name}</li>
              ))}
            </ul>
          )}

          <h3 className="match-section-title gaps">Skill Gaps</h3>
          {match.skill_gaps.length === 0 ? (
            <p className="job-card-sub">No gaps — great fit!</p>
          ) : (
            <ul className="match-list">
              {match.skill_gaps.map((s) => (
                <li key={s.skill_id}>
                  ⚠ {s.skill_name} — Required {s.required_level}, You have {s.candidate_level}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
