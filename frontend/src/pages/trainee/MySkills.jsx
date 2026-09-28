import { useState } from "react";
import { Award, BadgeCheck, ChevronDown, FolderGit2, Gauge, Pencil, Plus, RotateCw, Trash2 } from "lucide-react";
import { traineeProfile } from "../../api/profile";
import { listSkills } from "../../api/catalog";
import useAsync from "../../hooks/useAsync";
import { useToast } from "../../context/ToastContext";
import { useNotifications } from "../../context/NotificationContext";
import { AsyncSection, EmptyState, SkeletonCards } from "../../components/States";
import { DemoNote, PageHeader, ProgressBar, ScoreRing, SectionHead, StatCard, StatusBadge, fmtDate } from "../../components/ui";
import { RadarBox } from "../../components/Charts";
import Modal, { ConfirmModal } from "../../components/Modal";

const DIMENSIONS = [
  ["technical_complexity", "Technical Complexity"],
  ["implementation_quality", "Implementation Quality"],
  ["problem_solving", "Problem Solving"],
  ["technology_usage", "Technology Usage"],
  ["project_completeness", "Project Completeness"],
];
const SOURCE_LABEL = {
  SELF_REPORTED: "Self-reported", PROJECT_ASSESSMENT: "Project assessment", TRAINING: "Training",
  DOCUMENT: "Document", EMPLOYMENT: "Employment", RESUME: "Resume",
};

export function AssessmentView({ project }) {
  const a = project.assessment;
  if (!a) return <p>Not assessed yet.</p>;
  return (
    <div className="stack-lg">
      <div className="grid grid-2" style={{ alignItems: "center" }}>
        <div className="row" style={{ gap: 18 }}>
          <ScoreRing value={a.overall_score} max={5} label={a.overall_score.toFixed(2)} sub="out of 5" size={128} />
          <div className="stack" style={{ gap: 6 }}>
            <span className="eyebrow">Overall score</span>
            <div className="tags">{a.detected_skills.map((s) => <span className="tag" key={s}>{s}</span>)}</div>
            {a.detected_skills.length === 0 && <span className="small muted">No platform skills detected</span>}
          </div>
        </div>
        <RadarBox height={230} data={DIMENSIONS.map(([k, l]) => ({ axis: l.split(" ")[0], value: a[k] }))} />
      </div>
      <div>
        {DIMENSIONS.map(([k, label]) => (
          <div className="progress-row" key={k}>
            <span className="name">{label}</span>
            <ProgressBar value={a[k]} max={5} />
            <span className="pct">{a[k].toFixed(1)} / 5</span>
          </div>
        ))}
      </div>
      <div className="stack">
        {[["Strengths", a.strengths, "success"], ["Weaknesses", a.weaknesses, "warning"], ["Recommendations", a.recommendations, "primary"]].map(([title, items, tone]) => (
          <details className="expand" key={title} open={title === "Recommendations"}>
            <summary>{title} ({items.length}) <ChevronDown size={16} /></summary>
            <div className="expand-body">
              {items.length ? <ul className={`bullets ${tone}`}>{items.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="small">None.</p>}
            </div>
          </details>
        ))}
      </div>
      <DemoNote>
        Prototype assessment from SkillBridge's rule-based engine (<code>{a.engine}</code>). It scores keywords and structure in
        your description; no AI model is involved. Detected skills are added to My Skills as unverified.
      </DemoNote>
    </div>
  );
}

function ProjectForm({ onSubmit, busy }) {
  const [form, setForm] = useState({ title: "", description: "", technologies: "", repository_url: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <form id="project-form" className="form" onSubmit={(e) => {
      e.preventDefault();
      onSubmit({
        title: form.title.trim(), description: form.description.trim(),
        technologies: form.technologies.split(",").map((t) => t.trim()).filter(Boolean),
        repository_url: form.repository_url.trim() || null,
      });
    }}>
      <label>Project title<input required minLength={3} value={form.title} onChange={set("title")} placeholder="Smart Traffic Management System" /></label>
      <label>Description
        <textarea required minLength={20} rows={5} value={form.description} onChange={set("description")}
          placeholder="What problem does it solve, how did you build it, what is the result?" />
        <span className="hint">Mention the problem, features, testing and deployment; the assessment reads this text.</span>
      </label>
      <label>Technologies used<input value={form.technologies} onChange={set("technologies")} placeholder="Python, FastAPI, PostgreSQL, Docker" /><span className="hint">Comma separated</span></label>
      <label>Repository URL (optional)<input type="url" value={form.repository_url} onChange={set("repository_url")} placeholder="https://github.com/..." /></label>
      {busy && <div className="alert alert-info"><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Assessing project...</div>}
    </form>
  );
}

export default function MySkills({ api = traineeProfile }) {
  const toast = useToast();
  const { notify } = useNotifications();
  const state = useAsync(() => Promise.all([api.skills(), api.projects()]));
  const catalog = useAsync(listSkills);
  const [modal, setModal] = useState(null); // {type, item}
  const [busy, setBusy] = useState(false);
  const [newSkill, setNewSkill] = useState({ skill_name: "", proficiency_level: 3 });
  const close = () => setModal(null);

  const run = async (fn, success) => {
    setBusy(true);
    try {
      const result = await fn();
      if (success) toast(success);
      state.reload();
      return result;
    } catch (err) {
      toast(err.detail, "error");
    } finally {
      setBusy(false);
    }
  };

  const submitProject = async (payload) => {
    const project = await run(() => api.submitProject(payload));
    if (project) {
      notify("Project assessment complete", `"${project.title}" scored ${project.overall_score} / 5.`);
      setModal({ type: "assessment", item: project });
    }
  };

  return (
    <div>
      <PageHeader title="My Skills" subtitle="Your skill profile, competency scores and project assessments."
        actions={<>
          <button className="btn btn-ghost" onClick={() => setModal({ type: "project" })}><FolderGit2 size={16} /> Submit project</button>
          <button className="btn btn-primary" onClick={() => setModal({ type: "add" })}><Plus size={16} /> Add skill</button>
        </>} />

      <AsyncSection state={state} skeleton={<SkeletonCards count={6} label="Loading your skills..." />}>
        {([skills, projects]) => {
          const assessed = skills.filter((s) => s.competency_score != null);
          const avg = assessed.length ? (assessed.reduce((a, s) => a + s.competency_score, 0) / assessed.length).toFixed(1) : "—";
          const assessedOn = (s) => {
            const dates = s.projects.map((p) => projects.find((x) => x.id === p.id)?.assessed_at).filter(Boolean).sort();
            return dates.length ? `Assessed ${fmtDate(dates.at(-1))}` : `Added ${fmtDate(s.created_at)}`;
          };
          return (
            <div className="stack-lg">
              <div className="grid grid-4">
                <StatCard icon={Award} label="Total skills" value={skills.length} />
                <StatCard icon={BadgeCheck} tone="success" label="Verified" value={skills.filter((s) => s.verification_status === "VERIFIED").length} />
                <StatCard icon={Gauge} tone="info" label="Avg. competency" value={avg === "—" ? avg : `${avg} / 5`} hint={`${assessed.length} assessed`} />
                <StatCard icon={FolderGit2} tone="warning" label="Projects assessed" value={projects.filter((p) => p.assessment).length} />
              </div>

              {skills.length === 0 ? (
                <div className="card"><EmptyState icon={Award} title="No skills yet" message="Add skills you have, or submit a project to have them detected."
                  action={<button className="btn btn-primary btn-sm" onClick={() => setModal({ type: "add" })}>Add your first skill</button>} /></div>
              ) : (
                <div className="grid grid-auto">
                  {skills.map((s) => {
                    const score = s.competency_score ?? s.proficiency_level;
                    return (
                      <article className="card card-hover stack" key={s.id}>
                        <div className="row-between">
                          <h3>{s.skill.name}</h3>
                          <StatusBadge status={s.verification_status} />
                        </div>
                        <div className="row" style={{ alignItems: "baseline", gap: 6 }}>
                          <span className="stat-value">{score.toFixed(1)}</span><span className="muted">/ 5</span>
                          <span className="small muted" style={{ marginLeft: "auto" }}>{s.competency_score != null ? "Assessed competency" : "Self-rated level"}</span>
                        </div>
                        <ProgressBar value={score} max={5} />
                        <div className="job-meta">
                          <span>Source: {SOURCE_LABEL[s.source] || s.source}</span>
                          <span>Projects: {s.projects.length}</span>
                          <span>{assessedOn(s)}</span>
                        </div>
                        {s.projects.length > 0 && <div className="tags">{s.projects.map((p) => <span className="tag" key={p.id}>{p.title}</span>)}</div>}
                        <div className="card-actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type: "edit", item: s })}><Pencil size={13} /> Edit level</button>
                          <button className="btn btn-plain btn-sm" onClick={() => setModal({ type: "delete", item: s })} aria-label={`Remove ${s.skill.name}`}><Trash2 size={13} /> Remove</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              <div>
                <SectionHead title="Project competency assessment" subtitle="Each project is scored out of 5 on five parameters."
                  actions={<button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: "project" })}><Plus size={14} /> Submit project</button>} />
                {projects.length === 0 ? (
                  <div className="card"><EmptyState icon={FolderGit2} title="No projects submitted" message="Submit a project to receive a competency assessment." /></div>
                ) : (
                  <div className="grid grid-auto">
                    {projects.map((p) => (
                      <article className="card card-hover" key={p.id}>
                        <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
                          <ScoreRing value={p.overall_score ?? 0} max={5} size={78} stroke={7} label={p.overall_score?.toFixed(1) ?? "—"} sub="/ 5" />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <h3>{p.title}</h3>
                            <p className="small">{fmtDate(p.assessed_at || p.created_at)}</p>
                            <div className="tags mt-8">{p.technologies.slice(0, 4).map((t) => <span className="tag" key={t}>{t}</span>)}</div>
                          </div>
                        </div>
                        <div className="card-actions mt-16">
                          <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: "assessment", item: p })}>View assessment</button>
                          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(() => api.reassessProject(p.id), "Project re-assessed")}><RotateCw size={13} /> Re-assess</button>
                          <button className="btn btn-plain btn-sm" onClick={() => setModal({ type: "deleteProject", item: p })} aria-label={`Delete ${p.title}`}><Trash2 size={13} /></button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        }}
      </AsyncSection>

      {/* Add skill */}
      <Modal open={modal?.type === "add"} onClose={close} title="Add a skill" description="Choose from the platform skill list and rate yourself."
        footer={<><button className="btn btn-ghost" onClick={close}>Cancel</button>
          <button className="btn btn-primary" form="add-skill" disabled={busy || !newSkill.skill_name}>{busy ? "Adding..." : "Add skill"}</button></>}>
        <form id="add-skill" className="form" onSubmit={async (e) => {
          e.preventDefault();
          await run(() => api.addSkill(newSkill), "Skill added");
          setNewSkill({ skill_name: "", proficiency_level: 3 });
          close();
        }}>
          <label>Skill
            <select required value={newSkill.skill_name} onChange={(e) => setNewSkill({ ...newSkill, skill_name: e.target.value })}>
              <option value="">{catalog.loading ? "Loading skills..." : "Select a skill"}</option>
              {(catalog.data || []).filter((c) => !(state.data?.[0] || []).some((s) => s.skill_id === c.id)).map((c) => <option key={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Proficiency: {newSkill.proficiency_level} / 5
            <input type="range" min={1} max={5} value={newSkill.proficiency_level} onChange={(e) => setNewSkill({ ...newSkill, proficiency_level: Number(e.target.value) })} />
            <span className="hint">1 = beginner · 3 = can work independently · 5 = expert</span>
          </label>
        </form>
      </Modal>

      {/* Edit level */}
      <Modal open={modal?.type === "edit"} onClose={close} title={`Edit ${modal?.item?.skill?.name}`}
        description="Changing a verified skill's level returns it to unverified."
        footer={<><button className="btn btn-ghost" onClick={close}>Cancel</button><button className="btn btn-primary" form="edit-skill" disabled={busy}>Save</button></>}>
        {modal?.type === "edit" && (
          <form id="edit-skill" className="form" onSubmit={async (e) => {
            e.preventDefault();
            await run(() => api.updateSkill(modal.item.id, Number(new FormData(e.target).get("level"))), "Skill updated");
            close();
          }}>
            <label>Proficiency level
              <select name="level" defaultValue={modal.item.proficiency_level}>{[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>{l}</option>)}</select>
            </label>
          </form>
        )}
      </Modal>

      <ConfirmModal open={modal?.type === "delete"} onClose={close} busy={busy} title="Remove skill?"
        message={`Remove ${modal?.item?.skill?.name} from your profile? This can't be undone.`}
        onConfirm={async () => { await run(() => api.deleteSkill(modal.item.id), "Skill removed"); close(); }} />

      <ConfirmModal open={modal?.type === "deleteProject"} onClose={close} busy={busy} title="Delete project?"
        message={`Delete "${modal?.item?.title}" and its assessment? Skills already added stay on your profile.`}
        onConfirm={async () => { await run(() => api.deleteProject(modal.item.id), "Project deleted"); close(); }} />

      {/* Submit project */}
      <Modal open={modal?.type === "project"} onClose={close} size="lg" title="Submit a project for assessment"
        description="Your project will be scored out of 5 on five competency parameters."
        footer={<><button className="btn btn-ghost" onClick={close}>Cancel</button><button className="btn btn-primary" form="project-form" disabled={busy}>{busy ? "Assessing..." : "Submit & assess"}</button></>}>
        {modal?.type === "project" && <ProjectForm onSubmit={submitProject} busy={busy} />}
      </Modal>

      <Modal open={modal?.type === "assessment"} onClose={close} size="lg" title="Project Competency Assessment" description={modal?.item?.title}
        footer={<button className="btn btn-primary" onClick={close}>Done</button>}>
        {modal?.type === "assessment" && (
          <>
            {modal.item.skills_updated?.length > 0 && (
              <div className="alert alert-success mb-16">Added or updated on your profile: {modal.item.skills_updated.join(", ")}</div>
            )}
            <AssessmentView project={modal.item} />
          </>
        )}
      </Modal>
    </div>
  );
}
