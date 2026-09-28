import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getJobSkillGap } from "../../api/jobs";
import { Loading, ErrorState, EmptyState } from "../../components/States";
import SkillBar from "../../components/SkillBar";
import { MatchBadge } from "../../components/Badges";

export default function SkillGap() {
  const { jobId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError("");
    getJobSkillGap(jobId)
      .then(setData)
      .catch((err) => setError(err.detail || "Unable to load the skill gap report."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [jobId]);

  if (loading) return <Loading label="Building your skill gap report..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Skill Gap Report</h1>
          <p className="page-sub">{data.job_title}</p>
        </div>
        <MatchBadge percentage={data.match_percentage} />
      </div>

      <div className="card skillgap-card">
        {data.skill_gaps.length === 0 ? (
          <EmptyState message="You meet every required skill for this role." />
        ) : (
          data.skill_gaps.map((s) => (
            <SkillBar
              key={s.skill_id}
              name={s.skill_name}
              have={s.candidate_level}
              need={s.required_level}
              required={s.required}
            />
          ))
        )}
      </div>

      <Link to={`/trainee/jobs/${jobId}`} className="btn btn-secondary">
        Back to Job Details
      </Link>
    </div>
  );
}
