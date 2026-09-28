import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, RotateCcw, Search, SearchX } from "lucide-react";
import { getRecommendedJobs } from "../../api/trainees";
import { listJobs } from "../../api/jobs";
import { applyToJob } from "../../api/applications";
import useAsync from "../../hooks/useAsync";
import { JOB_TYPES, jobTypeFor } from "../../mock/local";
import { useToast } from "../../context/ToastContext";
import { AsyncSection, EmptyState, SkeletonCards } from "../../components/States";
import { PageHeader } from "../../components/ui";
import JobCard from "../../components/JobCard";
import Modal from "../../components/Modal";

const EXPERIENCE = [
  ["", "Any experience"], ["0", "Freshers"], ["1", "Up to 1 year"], ["2", "Up to 2 years"], ["3", "3+ years"],
];
const SORTS = [["match", "Best skill match"], ["newest", "Newest"], ["experience", "Experience (low → high)"], ["location", "Location (A–Z)"]];
const EMPTY = { q: "", location: "", experience: "", skill: "", minMatch: 0, type: "", sort: "match" };

export function JobQuickView({ job, detail, onClose, onApplied }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  if (!job) return null;
  const apply = async () => {
    setBusy(true);
    try {
      await applyToJob(job.job_id);
      setApplied(true);
      toast("Application submitted");
      onApplied?.();
    } catch (err) {
      if (err.status === 409) setApplied(true);
      else toast(err.detail, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} size="lg" title={job.title} description={`${job.company} · ${job.location}`}
      footer={
        <>
          <Link className="btn btn-ghost" to={`/trainee/jobs/${job.job_id}`}>Full details & skill gap</Link>
          {applied ? <span className="badge badge-success">Applied</span> : (
            <button className="btn btn-primary" onClick={apply} disabled={busy}>{busy ? "Applying..." : "Apply now"}</button>
          )}
        </>
      }>
      <div className="stack-lg">
        <div className="grid grid-3">
          <div className="card-flat"><div className="label">Skill match</div><div className="stat-value">{job.match_percentage}%</div></div>
          <div className="card-flat"><div className="label">Experience</div><div className="value">{detail?.min_experience_years > 0 ? `${detail.min_experience_years}+ years` : "Freshers welcome"}</div></div>
          <div className="card-flat"><div className="label">Salary</div><div className="value">{detail?.salary_min ? `₹${(detail.salary_min / 1e5).toFixed(1)}–${(detail.salary_max / 1e5).toFixed(1)} LPA` : "Not disclosed"}</div></div>
        </div>
        {detail?.description && <p style={{ color: "var(--text-2)" }}>{detail.description}</p>}
        <div>
          <h3 className="mb-16">Requirements</h3>
          <div className="tags">
            {(detail?.requirements || []).map((r) => {
              const cls = job.matching_skills.includes(r.skill.name) ? "tag-success" : job.missing_skills.includes(r.skill.name) ? "tag-danger" : "tag-warning";
              return <span key={r.id} className={`tag ${cls}`}>{r.skill.name} · L{r.required_level}{r.required ? "" : " (optional)"}</span>;
            })}
          </div>
          <p className="hint mt-8">Green: you meet the level · Amber: you have it at a lower level · Red: not in your profile yet.</p>
        </div>
      </div>
    </Modal>
  );
}

export default function RecommendedJobs() {
  const state = useAsync(() => Promise.all([getRecommendedJobs(50), listJobs()]));
  const [f, setF] = useState(EMPTY);
  const [viewing, setViewing] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const [recs, jobs] = state.data || [[], []];
  const details = useMemo(() => Object.fromEntries(jobs.map((j) => [j.id, j])), [jobs]);
  const options = useMemo(() => ({
    locations: [...new Set(recs.map((r) => r.location))].sort(),
    skills: [...new Set(recs.flatMap((r) => r.required_skills))].sort(),
  }), [recs]);

  const shown = useMemo(() => {
    const exp = (r) => Number(details[r.job_id]?.min_experience_years || 0);
    const q = f.q.toLowerCase();
    let out = recs.filter((r) =>
      (!q || `${r.title} ${r.company}`.toLowerCase().includes(q)) &&
      (!f.location || r.location === f.location) &&
      (!f.skill || r.required_skills.includes(f.skill)) &&
      r.match_percentage >= f.minMatch &&
      (!f.type || jobTypeFor(r.title) === f.type) &&
      (f.experience === "" || (f.experience === "3" ? exp(r) >= 3 : exp(r) <= Number(f.experience)))
    );
    const by = {
      match: (a, b) => b.match_percentage - a.match_percentage,
      newest: (a, b) => new Date(details[b.job_id]?.created_at) - new Date(details[a.job_id]?.created_at),
      experience: (a, b) => exp(a) - exp(b),
      location: (a, b) => a.location.localeCompare(b.location),
    };
    return [...out].sort(by[f.sort]);
  }, [recs, details, f]);

  return (
    <div>
      <PageHeader title="Recommended Jobs" subtitle="Ranked by how well your current skills match each role's requirements." />
      <div className="card" style={{ padding: 16, marginBottom: 18 }}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <label className="field grow search">
            <span>Search</span>
            <Search size={15} style={{ top: "auto", bottom: 12, transform: "none" }} />
            <input value={f.q} onChange={set("q")} placeholder="Job title or company" />
          </label>
          <label className="field">Location
            <select value={f.location} onChange={set("location")}><option value="">All locations</option>{options.locations.map((l) => <option key={l}>{l}</option>)}</select>
          </label>
          <label className="field">Experience
            <select value={f.experience} onChange={set("experience")}>{EXPERIENCE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label className="field">Skill
            <select value={f.skill} onChange={set("skill")}><option value="">Any skill</option>{options.skills.map((s) => <option key={s}>{s}</option>)}</select>
          </label>
          <label className="field" title="Job type is derived from the job title (the backend has no job-type field yet)">Job type
            <select value={f.type} onChange={set("type")}><option value="">All types</option>{JOB_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          </label>
          <label className="field">Min. match: {f.minMatch}%
            <input type="range" min={0} max={100} step={5} value={f.minMatch} onChange={(e) => setF({ ...f, minMatch: Number(e.target.value) })} />
          </label>
          <label className="field">Sort by
            <select value={f.sort} onChange={set("sort")}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
        </div>
      </div>

      <AsyncSection state={state} skeleton={<SkeletonCards count={6} label="Loading jobs..." />}>
        {() =>
          recs.length === 0 ? (
            <div className="card"><EmptyState icon={Briefcase} title="No jobs yet" message="There are no open jobs on the platform right now." /></div>
          ) : (
            <>
              <p className="small mb-16">Showing {shown.length} of {recs.length} jobs</p>
              {shown.length === 0 ? (
                <div className="card">
                  <EmptyState icon={SearchX} title="No jobs match these filters" message="Try widening your filters."
                    action={<button className="btn btn-ghost btn-sm" onClick={() => setF(EMPTY)}><RotateCcw size={14} /> Reset filters</button>} />
                </div>
              ) : (
                <div className="job-grid">
                  {shown.map((j) => (
                    <JobCard key={j.job_id} job={j} onView={setViewing}
                      meta={{ experience: Number(details[j.job_id]?.min_experience_years || 0), type: jobTypeFor(j.title) }} />
                  ))}
                </div>
              )}
            </>
          )
        }
      </AsyncSection>
      <JobQuickView job={viewing} detail={viewing && details[viewing.job_id]} onClose={() => setViewing(null)} />
    </div>
  );
}
