import { useState } from "react";
import { Award, BookOpen, Building2, CalendarDays, GraduationCap, Target } from "lucide-react";
import { completeEnrollment, dropEnrollment, enrollInProgram, getMyTraining, getRecommendedTraining } from "../../api/trainees";
import { listTrainingPrograms } from "../../api/catalog";
import useAsync from "../../hooks/useAsync";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useNotifications } from "../../context/NotificationContext";
import { AsyncSection, EmptyState, SkeletonCards } from "../../components/States";
import { DemoNote, PageHeader, ProgressBar, SectionHead, StatusBadge, fmtDate } from "../../components/ui";
import Modal, { ConfirmModal } from "../../components/Modal";

const STATUS = { ENROLLED: "ONGOING", COMPLETED: "COMPLETED", DROPPED: "DROPPED" };
const TABS = [["", "All"], ["ONGOING", "Ongoing"], ["COMPLETED", "Completed"], ["DROPPED", "Dropped"]];

// "6 weeks" / "3 months" -> days
const durationDays = (d = "") => {
  const m = d.match(/(\d+)\s*(day|week|month)/i);
  if (!m) return null;
  return Number(m[1]) * { day: 1, week: 7, month: 30 }[m[2].toLowerCase()];
};

function progressOf(e) {
  if (e.status === "COMPLETED") return { pct: 100, est: false, end: e.completed_at };
  const days = durationDays(e.program.duration);
  if (!days) return { pct: null, est: true, end: null };
  const start = new Date(e.enrolled_at);
  const end = new Date(start.getTime() + days * 86400e3);
  const pct = Math.min(95, Math.max(0, Math.round(((Date.now() - start) / (end - start)) * 100)));
  return { pct: e.status === "DROPPED" ? null : pct, est: true, end };
}

function ProgramSkills({ program }) {
  return <div className="tags">{program.skills.map((ps) => <span className="tag" key={ps.skill_id}>{ps.skill.name} · L{ps.target_level}</span>)}</div>;
}

export default function TrainingCamp() {
  const { user } = useAuth();
  const toast = useToast();
  const { notify } = useNotifications();
  const state = useAsync(() => Promise.all([getMyTraining(), getRecommendedTraining(), listTrainingPrograms()]));
  const [tab, setTab] = useState("");
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [certificate, setCertificate] = useState(null);

  const act = async (id, fn, message) => {
    setBusy(id);
    try {
      const res = await fn();
      toast(message);
      state.reload();
      return res;
    } catch (err) {
      toast(err.detail, "error");
    } finally {
      setBusy(null);
    }
  };

  const enroll = async (program) => {
    const res = await act(program.id, () => enrollInProgram(program.id), `Enrolled in ${program.name}`);
    if (res) notify("Enrollment confirmed", `You're enrolled in "${program.name}".`);
  };

  return (
    <div>
      <PageHeader title="Training Camp" subtitle="Your training programs and recommendations based on your skill gaps." />
      <AsyncSection state={state} skeleton={<SkeletonCards count={3} label="Loading training programs..." />}>
        {([enrollments, rec, catalog]) => {
          const shown = enrollments.filter((e) => !tab || STATUS[e.status] === tab);
          const taken = new Set(enrollments.filter((e) => e.status !== "DROPPED").map((e) => e.program.id));
          const others = catalog.filter((p) => !taken.has(p.id) && !rec.recommendations.some((r) => r.program.id === p.id));
          return (
            <div className="stack-lg">
              <section>
                <SectionHead title="My training programs" actions={
                  <div className="segmented" role="tablist">
                    {TABS.map(([v, l]) => <button key={v} role="tab" aria-selected={tab === v} className={tab === v ? "active" : ""} onClick={() => setTab(v)}>{l}</button>)}
                  </div>
                } />
                {shown.length === 0 ? (
                  <div className="card">
                    <EmptyState icon={GraduationCap} title={tab ? "Nothing in this list" : "No training programs yet"}
                      message={tab ? "No programs with this status." : "You haven't participated in any training programs yet."}
                      action={!tab && <a className="btn btn-primary btn-sm" href="#recommended">Explore training</a>} />
                  </div>
                ) : (
                  <div className="grid grid-auto">
                    {shown.map((e) => {
                      const p = progressOf(e);
                      return (
                        <article className="card card-hover stack" key={e.id}>
                          <div className="row-between" style={{ alignItems: "flex-start" }}>
                            <h3 style={{ flex: 1 }}>{e.program.name}</h3>
                            <StatusBadge status={STATUS[e.status]} />
                          </div>
                          <div className="job-meta">
                            <span><Building2 size={13} /> {e.program.provider}</span>
                            <span><CalendarDays size={13} /> {fmtDate(e.enrolled_at)} – {p.end ? `${fmtDate(p.end)}${e.status === "ENROLLED" ? " (est.)" : ""}` : "—"}</span>
                          </div>
                          <ProgramSkills program={e.program} />
                          {p.pct !== null && (
                            <div>
                              <div className="row-between small"><span>Completion{p.est && e.status === "ENROLLED" ? " (estimated from schedule)" : ""}</span><b>{p.pct}%</b></div>
                              <div className="mt-8"><ProgressBar value={p.pct} /></div>
                            </div>
                          )}
                          <div className="card-actions">
                            {e.status === "ENROLLED" && (
                              <>
                                <button className="btn btn-primary btn-sm" disabled={busy === e.id}
                                  onClick={async () => {
                                    const r = await act(e.id, () => completeEnrollment(e.id), "Marked as completed");
                                    if (r?.skills_updated?.length) notify("Training completed", `Skills updated: ${r.skills_updated.join(", ")}.`);
                                  }}>Mark completed</button>
                                <button className="btn btn-plain btn-sm" onClick={() => setConfirm(e)}>Drop</button>
                              </>
                            )}
                            {e.status === "COMPLETED" && <button className="btn btn-ghost btn-sm" onClick={() => setCertificate(e)}><Award size={14} /> Certificate</button>}
                            {e.status === "DROPPED" && <button className="btn btn-ghost btn-sm" disabled={busy === e.program.id} onClick={() => enroll(e.program)}>Re-enroll</button>}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section id="recommended">
                <SectionHead title="Recommended training programs" subtitle="Recommended based on your current skill profile, your skill gaps and the requirements of your closest job matches." />
                {rec.target_jobs.length > 0 && (
                  <div className="card-flat mb-16 row" style={{ gap: 14 }}>
                    <Target size={18} color="var(--primary)" />
                    <span className="small">Target roles: <b>{rec.target_jobs.map((j) => j.title).join(", ")}</b> · Skill gaps: <b>{rec.skill_gaps.join(", ") || "none"}</b></span>
                  </div>
                )}
                {rec.recommendations.length === 0 ? (
                  <div className="card"><EmptyState icon={Target} title="No recommendations right now" message={rec.skill_gaps.length ? "No active program covers your current skill gaps." : "You have no skill gaps against your closest job matches."} /></div>
                ) : (
                  <div className="grid grid-auto">
                    {rec.recommendations.map(({ program, skills_addressed, relevance_score }) => {
                      const coverage = Math.round((skills_addressed.length / Math.max(rec.skill_gaps.length, 1)) * 100);
                      return (
                        <article className="card card-hover stack" key={program.id}>
                          <div className="row-between"><h3>{program.name}</h3><span className="badge badge-primary">{coverage}% gap coverage</span></div>
                          <p className="small">{program.description}</p>
                          <div className="job-meta"><span><Building2 size={13} /> {program.provider}</span><span><CalendarDays size={13} /> {program.duration}</span><span>{program.difficulty.toLowerCase()}</span></div>
                          <div className="small">Closes gaps in <b>{skills_addressed.join(", ")}</b> ({relevance_score} skill level{relevance_score > 1 ? "s" : ""})</div>
                          <div className="card-actions"><button className="btn btn-primary btn-sm" disabled={busy === program.id} onClick={() => enroll(program)}>{busy === program.id ? "Enrolling..." : "Enroll"}</button></div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              {others.length > 0 && (
                <section>
                  <SectionHead title="All programs" subtitle="Other active programs you can join." />
                  <div className="grid grid-auto">
                    {others.map((program) => (
                      <article className="card card-hover stack" key={program.id}>
                        <div className="row-between"><h3>{program.name}</h3><BookOpen size={16} color="var(--text-sub)" /></div>
                        <div className="job-meta"><span><Building2 size={13} /> {program.provider}</span><span><CalendarDays size={13} /> {program.duration}</span><span>{program.difficulty.toLowerCase()}</span></div>
                        <ProgramSkills program={program} />
                        <div className="card-actions"><button className="btn btn-ghost btn-sm" disabled={busy === program.id} onClick={() => enroll(program)}>Enroll</button></div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>
          );
        }}
      </AsyncSection>

      <ConfirmModal open={!!confirm} onClose={() => setConfirm(null)} title="Drop this program?" confirmLabel="Drop program" busy={busy === confirm?.id}
        message={`You can re-enroll in "${confirm?.program.name}" later.`}
        onConfirm={async () => { await act(confirm.id, () => dropEnrollment(confirm.id), "Program dropped"); setConfirm(null); }} />

      <Modal open={!!certificate} onClose={() => setCertificate(null)} title="Completion certificate" size="lg"
        footer={<><button className="btn btn-ghost" onClick={() => window.print()}>Print</button><button className="btn btn-primary" onClick={() => setCertificate(null)}>Close</button></>}>
        {certificate && (
          <div className="stack">
            <div className="certificate">
              <span className="eyebrow">Certificate of completion</span>
              <h2>{certificate.program.name}</h2>
              <p>This is to certify that <b>{user?.name}</b> completed the program offered by <b>{certificate.program.provider}</b> on {fmtDate(certificate.completed_at)}.</p>
              <div className="tags mt-16" style={{ justifyContent: "center" }}>{certificate.program.skills.map((s) => <span className="tag" key={s.skill_id}>{s.skill.name}</span>)}</div>
            </div>
            <DemoNote>Prototype certificate generated in the browser from your enrollment record. It is not an official document issued by the training provider.</DemoNote>
          </div>
        )}
      </Modal>
    </div>
  );
}
