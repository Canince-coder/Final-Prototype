import { useNavigate } from "react-router-dom";
import { ArrowRight, Award, BadgeCheck, Briefcase, Clock, FileClock, GraduationCap } from "lucide-react";
import { getEmployeeDashboard, getEmployeeJobs } from "../../api/employees";
import useAsync from "../../hooks/useAsync";
import { useAuth } from "../../context/AuthContext";
import { AsyncSection, EmptyState, Skeleton } from "../../components/States";
import { Avatar, InfoItem, PageHeader, ProgressBar, SectionHead, StatCard, StatusBadge } from "../../components/ui";
import JobCard from "../../components/JobCard";
import { EmploymentCard } from "../trainee/Employment";
import { skillPercent } from "../trainee/Dashboard";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const state = useAsync(() => Promise.all([getEmployeeDashboard(), getEmployeeJobs(true)]));

  return (
    <div>
      <PageHeader title={`Welcome back, ${(user?.name || "").split(" ")[0]}`} subtitle="Your employment record, verified skills and career opportunities." />
      <AsyncSection state={state} skeleton={<div className="card stack"><Skeleton width="35%" height={22} /><Skeleton /><Skeleton width="60%" /></div>}>
        {([d, eligible]) => {
          const current = d.current_employment[0];
          const verified = d.skills.filter((s) => s.verification_status === "VERIFIED").length;
          return (
            <div className="stack-lg">
              <section className="card">
                <div className="row" style={{ gap: 16, marginBottom: 20 }}>
                  <Avatar name={d.name} size="lg" />
                  <div>
                    <h2>{d.name}</h2>
                    <div className="row mt-8">
                      <span className="uid-chip mono" title="Employee ID">{d.employee_id || "—"}</span>
                      <span className="uid-chip mono" title="Trainee ID">{d.trainee_uid || "—"}</span>
                      <StatusBadge status={d.employment_status} />
                    </div>
                  </div>
                </div>
                <div className="info-list cols-3">
                  <InfoItem label="Current company" value={current?.company_name} />
                  <InfoItem label="Job role" value={current?.role_title} />
                  <InfoItem label="Location" value={current?.location || [d.district, d.state].filter(Boolean).join(", ")} />
                  <InfoItem label="Experience" value={`${d.total_experience_years} years`} />
                  <InfoItem label="Email" value={d.email} />
                  <InfoItem label="Education" value={d.education} />
                </div>
              </section>

              <div className="grid grid-6">
                <StatCard icon={Clock} label="Years of experience" value={d.total_experience_years} onClick={() => navigate("/employee/analytics")} />
                <StatCard icon={Award} tone="info" label="Skills" value={d.skills.length} />
                <StatCard icon={BadgeCheck} tone="success" label="Verified skills" value={verified} />
                <StatCard icon={Briefcase} label="Job opportunities" value={eligible.length} hint="Eligible roles" onClick={() => navigate("/employee/jobs")} />
                <StatCard icon={GraduationCap} tone="info" label="Training completed" value={d.related_trainee_info.trainings_completed} />
                <StatCard icon={FileClock} tone="warning" label="Pending reviews" value={d.pending_submissions} onClick={() => navigate("/employee/submissions")} />
              </div>

              <div className="grid grid-main">
                <section>
                  <SectionHead title="Current employment" actions={<button className="btn btn-plain btn-sm" onClick={() => navigate("/employee/analytics")}>History <ArrowRight size={14} /></button>} />
                  {d.current_employment.length ? (
                    <div className="stack">{d.current_employment.map((e) => <EmploymentCard key={e.id} e={e} />)}</div>
                  ) : (
                    <div className="card"><EmptyState message="No current employment recorded." /></div>
                  )}
                </section>
                <section className="card">
                  <div className="card-head"><div><h2>Skills</h2><p>{verified} of {d.skills.length} verified</p></div></div>
                  {d.skills.length === 0 ? <EmptyState message="No skills yet. Upload employment proof to have skills detected." /> : (
                    d.skills.slice(0, 8).map((s) => (
                      <div className="progress-row" key={s.id}>
                        <span className="name">{s.skill.name}</span>
                        <ProgressBar value={skillPercent(s)} tone={s.verification_status === "VERIFIED" ? "success" : ""} />
                        <StatusBadge status={s.verification_status} />
                      </div>
                    ))
                  )}
                </section>
              </div>

              <section>
                <SectionHead title="Top opportunities" actions={<button className="btn btn-plain btn-sm" onClick={() => navigate("/employee/jobs")}>All jobs <ArrowRight size={14} /></button>} />
                {d.top_jobs.length === 0 ? <div className="card"><EmptyState message="No jobs available right now." /></div> : (
                  <div className="job-grid">{d.top_jobs.slice(0, 3).map((j) => <JobCard key={j.job_id} job={j} compact onView={() => navigate("/employee/jobs")} />)}</div>
                )}
              </section>
            </div>
          );
        }}
      </AsyncSection>
    </div>
  );
}
