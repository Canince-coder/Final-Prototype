import { useMemo, useState } from "react";
import { Briefcase, Check, Info, TrendingUp, X } from "lucide-react";
import { getEmployeeJobs } from "../../api/employees";
import useAsync from "../../hooks/useAsync";
import { jobTypeFor } from "../../mock/local";
import { AsyncSection, EmptyState, SkeletonCards } from "../../components/States";
import { PageHeader, ProgressBar } from "../../components/ui";
import JobCard from "../../components/JobCard";
import Modal from "../../components/Modal";

const EDU = ["None", "10th", "12th / ITI / Diploma", "Graduate", "Postgraduate", "Doctorate"];

function Breakdown({ job }) {
  const skill = Math.round(job.match_percentage * 0.6);
  const exp = job.experience_required_years <= 0 ? 25 : Math.round(Math.min(1, job.experience_years / job.experience_required_years) * 25);
  const edu = job.education_level_required <= 0 ? 15 : Math.round(Math.min(1, job.education_level / job.education_level_required) * 15);
  return (
    <div className="stack-lg">
      <div className="grid grid-3">
        <div className="card-flat"><div className="label">Skill match (60%)</div><div className="stat-value">{skill}<span className="small muted"> / 60</span></div><ProgressBar value={skill} max={60} /></div>
        <div className="card-flat"><div className="label">Experience (25%)</div><div className="stat-value">{exp}<span className="small muted"> / 25</span></div><ProgressBar value={exp} max={25} /></div>
        <div className="card-flat"><div className="label">Education (15%)</div><div className="stat-value">{edu}<span className="small muted"> / 15</span></div><ProgressBar value={edu} max={15} /></div>
      </div>
      <div className="alert alert-info"><Info size={16} /> Eligibility {job.eligibility_score}% ≈ skills {skill} + experience {exp} + education {edu}. Roles at 60% or above are marked eligible.</div>
      <div className="grid grid-2">
        <div>
          <h3 className="mb-16">Required skills</h3>
          <ul className="skill-check">
            {job.matching_skills.map((s) => <li key={s}><Check size={15} className="ok" /> {s}</li>)}
            {job.skills_to_improve.map((s) => <li key={s}><TrendingUp size={15} className="gap" /> {s} <span className="small muted">(below required level)</span></li>)}
            {job.missing_skills.map((s) => <li key={s}><X size={15} className="miss" /> {s}</li>)}
          </ul>
        </div>
        <div className="stack">
          <div className="card-flat"><div className="label">Experience</div><div className="value">{job.experience_years} yrs (needs {job.experience_required_years})</div></div>
          <div className="card-flat"><div className="label">Education</div><div className="value">{EDU[job.education_level]} (needs {EDU[job.education_level_required]})</div></div>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeJobs() {
  const state = useAsync(() => getEmployeeJobs(false));
  const [eligibleOnly, setEligibleOnly] = useState(true);
  const [viewing, setViewing] = useState(null);
  const jobs = useMemo(() => (state.data || []).filter((j) => !eligibleOnly || j.eligible), [state.data, eligibleOnly]);

  return (
    <div>
      <PageHeader title="Jobs" subtitle="Roles you're applicable for, scored on skill match + experience + education."
        actions={
          <div className="segmented" role="tablist">
            <button role="tab" aria-selected={eligibleOnly} className={eligibleOnly ? "active" : ""} onClick={() => setEligibleOnly(true)}>Eligible</button>
            <button role="tab" aria-selected={!eligibleOnly} className={!eligibleOnly ? "active" : ""} onClick={() => setEligibleOnly(false)}>All jobs</button>
          </div>
        } />
      <AsyncSection state={state} skeleton={<SkeletonCards count={6} label="Loading jobs..." />}>
        {() => jobs.length === 0 ? (
          <div className="card"><EmptyState icon={Briefcase} title={eligibleOnly ? "No eligible roles yet" : "No jobs"}
            message={eligibleOnly ? "Verified skills and more experience raise your eligibility. Switch to All jobs to see every role." : "There are no open jobs."} /></div>
        ) : (
          <div className="job-grid">
            {jobs.map((j) => <JobCard key={j.job_id} job={j} onView={setViewing} meta={{ experience: j.experience_required_years, type: jobTypeFor(j.title) }} />)}
          </div>
        )}
      </AsyncSection>
      <Modal open={!!viewing} onClose={() => setViewing(null)} size="lg" title={viewing?.title} description={viewing && `${viewing.company} · ${viewing.location}`}
        footer={<button className="btn btn-primary" onClick={() => setViewing(null)}>Close</button>}>
        {viewing && <Breakdown job={viewing} />}
      </Modal>
    </div>
  );
}
