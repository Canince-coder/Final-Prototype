import { useNavigate } from "react-router-dom";
import { Award, BadgeCheck, Briefcase, Building2, FileText, GraduationCap, Lightbulb, ArrowRight } from "lucide-react";
import { getTraineeDashboard } from "../../api/trainees";
import { getMyApplications } from "../../api/applications";
import useAsync from "../../hooks/useAsync";
import { useAuth } from "../../context/AuthContext";
import { fallbackUid } from "../../mock/local";
import { AsyncSection, EmptyState, Skeleton } from "../../components/States";
import { Avatar, InfoItem, PageHeader, ProgressBar, SectionHead, StatCard, StatusBadge } from "../../components/ui";
import { RadarBox } from "../../components/Charts";
import JobCard from "../../components/JobCard";

export const skillPercent = (s) => Math.round(((s.competency_score ?? s.proficiency_level) / 5) * 100);

export function recommendationText(jobs, training) {
  const top = jobs[0];
  if (!top || top.match_percentage === 0) {
    return "Add your skills (or submit a project to have them detected) to start receiving job recommendations based on your skill profile.";
  }
  const gaps = [...top.skills_to_improve, ...top.missing_skills].slice(0, 2);
  const strong = jobs.filter((j) => j.match_percentage >= 70).length;
  let text = strong > 1
    ? `Your current skill profile matches ${strong} roles at 70% or more, led by ${top.title} (${top.match_percentage}%).`
    : `Your closest match is ${top.title} at ${top.company} (${top.match_percentage}%).`;
  if (gaps.length) text += ` Improving ${gaps.join(" and ")} would increase your eligibility for this and similar positions.`;
  else text += " You meet every listed requirement, so consider applying.";
  if (training[0]) text += ` "${training[0].program.name}" covers ${training[0].skills_addressed.join(", ")}.`;
  return text;
}

function DashboardSkeleton() {
  return (
    <div className="stack-lg" role="status" aria-label="Loading dashboard">
      <div className="grid grid-main">
        <div className="card stack"><Skeleton width="40%" height={20} /><Skeleton /><Skeleton width="70%" /><Skeleton width="60%" /></div>
        <div className="card stack"><Skeleton width="50%" height={20} /><Skeleton /><Skeleton width="80%" /></div>
      </div>
      <div className="grid grid-6">{Array.from({ length: 6 }, (_, i) => <div className="card stat" key={i}><Skeleton width="60%" /><Skeleton width="40%" height={24} /></div>)}</div>
    </div>
  );
}

export default function TraineeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const state = useAsync(() => Promise.all([getTraineeDashboard(), getMyApplications()]));
  const first = (user?.name || "").split(" ")[0];

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${first}`}
        subtitle="Here's an overview of your skills, training and employment journey."
        actions={<button className="btn btn-ghost" onClick={() => navigate("/trainee/profile")}>View profile</button>}
      />
      <AsyncSection state={state} skeleton={<DashboardSkeleton />}>
        {([d, applications]) => {
          const verified = d.current_skills.filter((s) => s.verification_status === "VERIFIED").length;
          const programs = d.training_status.enrolled + d.training_status.completed;
          const topSkills = [...d.current_skills].sort((a, b) => skillPercent(b) - skillPercent(a));
          return (
            <div className="stack-lg">
              <div className="grid grid-main">
                <section className="card" aria-label="Trainee information">
                  <div className="row" style={{ gap: 14, marginBottom: 18 }}>
                    <Avatar name={d.name} size="lg" />
                    <div style={{ minWidth: 0 }}>
                      <h2>{d.name}</h2>
                      <div className="row mt-8">
                        <span className="uid-chip mono" title="Your unique Trainee UID">{d.trainee_uid || fallbackUid(user.id)}</span>
                        <StatusBadge status={d.employment_status} />
                      </div>
                    </div>
                  </div>
                  <div className="info-list cols-3">
                    <InfoItem label="Email" value={d.email} />
                    <InfoItem label="Location" value={d.location} />
                    <InfoItem label="Education" value={d.education} />
                  </div>
                </section>

                <section className="card" aria-label="Recommended for you">
                  <div className="row" style={{ marginBottom: 10 }}>
                    <span className="stat-icon warning"><Lightbulb size={17} /></span>
                    <h2>Recommended for you</h2>
                  </div>
                  <p style={{ color: "var(--text-2)" }}>{recommendationText(d.recommended_jobs, d.recommended_training)}</p>
                  <div className="row mt-16">
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate("/trainee/jobs")}>See matching jobs <ArrowRight size={14} /></button>
                    <button className="btn btn-plain btn-sm" onClick={() => navigate("/trainee/training")}>Training options</button>
                  </div>
                </section>
              </div>

              <div className="grid grid-6">
                <StatCard icon={Award} label="Total skills" value={d.competency.skills_count} onClick={() => navigate("/trainee/skills")} />
                <StatCard icon={BadgeCheck} tone="success" label="Verified skills" value={verified} />
                <StatCard icon={GraduationCap} tone="info" label="Training programs" value={programs} hint={`${d.training_status.completed} completed`} onClick={() => navigate("/trainee/training")} />
                <StatCard icon={Briefcase} label="Recommended jobs" value={d.recommended_jobs.length} onClick={() => navigate("/trainee/jobs")} />
                <StatCard icon={FileText} tone="info" label="Applications" value={applications.length} onClick={() => navigate("/trainee/applications")} />
                <StatCard icon={Building2} tone={d.employment_status === "EMPLOYED" ? "success" : "warning"} label="Employment" small
                  value={d.employment_status === "EMPLOYED" ? "Employed" : "Seeking"} onClick={() => navigate("/trainee/employment")} />
              </div>

              <div className="grid grid-main">
                <section className="card">
                  <div className="card-head">
                    <div><h2>Skill overview</h2><p>Assessed competency where available, otherwise your self-rated level.</p></div>
                    <button className="btn btn-plain btn-sm" onClick={() => navigate("/trainee/skills")}>Manage</button>
                  </div>
                  {topSkills.length === 0 ? (
                    <EmptyState title="No skills yet" message="Add your skills to get job matches." action={<button className="btn btn-primary btn-sm" onClick={() => navigate("/trainee/skills")}>Add skills</button>} />
                  ) : (
                    topSkills.slice(0, 8).map((s) => (
                      <div className="progress-row" key={s.id}>
                        <span className="name" title={s.skill.name}>{s.skill.name}</span>
                        <ProgressBar value={skillPercent(s)} />
                        <span className="pct">{skillPercent(s)}%</span>
                      </div>
                    ))
                  )}
                </section>
                <section className="card">
                  <div className="card-head"><div><h2>Skill profile</h2><p>Top skills on a 0–5 scale</p></div></div>
                  {topSkills.length >= 3 ? (
                    <RadarBox data={topSkills.slice(0, 6).map((s) => ({ axis: s.skill.name, value: +(s.competency_score ?? s.proficiency_level).toFixed(1) }))} />
                  ) : (
                    <EmptyState message="Add at least three skills to see your skill profile chart." />
                  )}
                </section>
              </div>

              <div>
                <SectionHead title="Top job matches" actions={<button className="btn btn-plain btn-sm" onClick={() => navigate("/trainee/jobs")}>View all <ArrowRight size={14} /></button>} />
                {d.recommended_jobs.length === 0 ? (
                  <div className="card"><EmptyState message="No jobs available right now." /></div>
                ) : (
                  <div className="job-grid">
                    {d.recommended_jobs.slice(0, 3).map((j) => (
                      <JobCard key={j.job_id} job={j} compact onView={() => navigate(`/trainee/jobs/${j.job_id}`)} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        }}
      </AsyncSection>
    </div>
  );
}
