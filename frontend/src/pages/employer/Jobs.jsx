import { useEffect, useState } from "react";
import { listJobs } from "../../api/jobs";
import { Loading, ErrorState, EmptyState } from "../../components/States";

export default function EmployerJobs() {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError("");
    listJobs()
      .then(setJobs)
      .catch((err) => setError(err.detail || "Unable to load jobs."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;


  return (
    <div>
      <div className="page-header">
        <h1>Jobs</h1>
      </div>
      <div className="alert alert-warning">
        The backend doesn't yet expose an employer-specific job listing endpoint
        (e.g. <code>GET /employers/me/jobs</code>), so this shows all jobs from{" "}
        <code>GET /jobs</code>. Once that endpoint exists, swap the call here to
        filter to just this employer's postings.
      </div>
      {jobs.length === 0 ? (
        <EmptyState message="No jobs found." />
      ) : (
        <div className="job-grid">
          {jobs.map((job) => (
            <div className="card job-card" key={job.id}>
              <h3>{job.title}</h3>
              <p className="job-card-sub">{job.employer.company_name} · {job.location}</p>
              <p className="job-card-sub">Role: {job.job_role.title}</p>
              <div className="requirement-tags">
                {job.requirements.slice(0, 4).map((r) => (
                  <span key={r.id} className="tag">{r.skill.name} L{r.required_level}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
