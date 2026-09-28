import { useEffect, useState } from "react";
import { getMyApplications, updateApplicationStatus } from "../../api/applications";
import { Loading, ErrorState, EmptyState } from "../../components/States";
import { StatusTimeline } from "../../components/Badges";

export default function Applications() {
  const [apps, setApps] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    setError("");
    getMyApplications()
      .then(setApps)
      .catch((err) => setError(err.detail || "Unable to load your applications."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const withdraw = async (id) => {
    setBusyId(id);
    try {
      await updateApplicationStatus(id, "WITHDRAWN");
      load();
    } catch (err) {
      setError(err.detail || "Could not withdraw this application.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>My Applications</h1>
      </div>
      {loading && <Loading />}
      {error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && apps.length === 0 && (
        <EmptyState message="You haven't applied to any jobs yet." />
      )}
      {!loading && !error && (
        <div className="applications-list">
          {apps.map((app) => (
            <div className="card application-card" key={app.id}>
              <div className="application-head">
                <div>
                  <h3>{app.job.title}</h3>
                  <p className="job-card-sub">
                    {app.job.employer.company_name} · {app.job.location}
                  </p>
                  <p className="job-card-sub">
                    Applied {new Date(app.applied_at).toLocaleDateString()}
                  </p>
                </div>
                {["APPLIED", "SHORTLISTED", "INTERVIEW"].includes(app.status) && (
                  <button
                    className="btn btn-ghost btn-danger"
                    disabled={busyId === app.id}
                    onClick={() => withdraw(app.id)}
                  >
                    {busyId === app.id ? "Withdrawing..." : "Withdraw"}
                  </button>
                )}
              </div>
              <StatusTimeline status={app.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
