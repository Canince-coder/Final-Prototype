import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getRecommendedJobs } from "../../api/trainees";
import { getMyApplications } from "../../api/applications";
import { Loading, ErrorState, EmptyState } from "../../components/States";
import { MatchBadge, StatusBadge } from "../../components/Badges";

export default function TraineeDashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState(null);
  const [applications, setApplications] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([getRecommendedJobs(6), getMyApplications()])
      .then(([j, a]) => {
        setJobs(j);
        setApplications(a);
      })
      .catch((err) => setError(err.detail || "Unable to load your dashboard."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <Loading label="Loading your dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const topJob = jobs?.[0];
  const recentApplications = (applications || []).slice(0, 3);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Welcome back, {user?.name?.split(" ")[0]}</h1>
          <p className="page-sub">Here's how your job search is going.</p>
        </div>
      </div>

      {topJob && (
        <div className="card highlight-card">
          <div className="highlight-info">
            <span className="eyebrow">Top matching job</span>
            <h2>{topJob.job}</h2>
            <p>{topJob.employer} · {topJob.location}</p>
            <Link to={`/trainee/jobs/${topJob.job_id}`} className="btn btn-primary">
              View Job
            </Link>
          </div>
          <MatchBadge percentage={topJob.match_percentage} />
        </div>
      )}

      <div className="section-head">
        <h2>Recommended for you</h2>
        <Link to="/trainee/jobs">See all</Link>
      </div>
      {jobs && jobs.length === 0 && <EmptyState message="No recommended jobs found." />}
      <div className="job-grid">
        {(jobs || []).map((job) => (
          <div className="card job-card" key={job.job_id}>
            <div className="job-card-top">
              <div>
                <h3>{job.job}</h3>
                <p className="job-card-sub">{job.employer} · {job.location}</p>
              </div>
              <MatchBadge percentage={job.match_percentage} />
            </div>
            {job.top_skill_gaps?.length > 0 && (
              <div className="job-card-gaps">
                <span className="eyebrow">Top skill gaps</span>
                <p>{job.top_skill_gaps.join(", ")}</p>
              </div>
            )}
            <Link to={`/trainee/jobs/${job.job_id}`} className="btn btn-secondary btn-block">
              View Job
            </Link>
          </div>
        ))}
      </div>

      <div className="section-head">
        <h2>Recent applications</h2>
        <Link to="/trainee/applications">See all</Link>
      </div>
      {recentApplications.length === 0 ? (
        <EmptyState message="You haven't applied to any jobs yet." />
      ) : (
        <div className="table-card">
          {recentApplications.map((app) => (
            <div className="table-row" key={app.id}>
              <div>
                <strong>{app.job.title}</strong>
                <p className="job-card-sub">{app.job.employer.company_name}</p>
              </div>
              <StatusBadge status={app.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
