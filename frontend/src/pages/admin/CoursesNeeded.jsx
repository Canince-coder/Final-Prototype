import { useState } from "react";
import { BookOpen, Pencil, Plus, Power, Trash2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { adminApi } from "../../api/admin";
import { listSkills } from "../../api/catalog";
import { isDemoSession } from "../../api/client";
import useAsync from "../../hooks/useAsync";
import { useToast } from "../../context/ToastContext";
import { AsyncSection, EmptyState, SkeletonCards } from "../../components/States";
import { DemoNote, PageHeader, ProgressBar, SectionHead, StatusBadge } from "../../components/ui";
import DataTable from "../../components/DataTable";
import Modal, { ConfirmModal } from "../../components/Modal";

export const level = (v, [vh, h, m]) => (v >= vh ? "Very High" : v >= h ? "High" : v >= m ? "Medium" : "Low");
export const demandLevel = (d) => level(d, [90, 75, 55]);
export const gapLevel = (g) => level(g, [45, 25, 10]);
export const TrendIcon = ({ t }) => (t === "RISING" ? <TrendingUp size={14} color="var(--success)" /> : t === "DECLINING" ? <TrendingDown size={14} color="var(--danger)" /> : <Minus size={14} color="var(--text-sub)" />);

const DIFFS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const empty = { title: "", description: "", provider: "", duration: "", difficulty: "BEGINNER", status: "ACTIVE", skills: [] };

function CourseForm({ initial, skillNames, onSubmit }) {
  const [f, setF] = useState(() => initial || empty);
  const [pick, setPick] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const addSkill = () => {
    if (pick && !f.skills.some((s) => s.skill_name === pick)) setF({ ...f, skills: [...f.skills, { skill_name: pick, target_level: 3 }] });
    setPick("");
  };
  return (
    <form id="course-form" className="form" onSubmit={(e) => { e.preventDefault(); onSubmit(f); }}>
      <div className="form-grid">
        <label className="full">Course title<input required minLength={3} value={f.title} onChange={set("title")} /></label>
        <label className="full">Description<textarea rows={3} value={f.description || ""} onChange={set("description")} /></label>
        <label>Provider<input required value={f.provider} onChange={set("provider")} /></label>
        <label>Duration<input required value={f.duration} onChange={set("duration")} placeholder="8 weeks" /></label>
        <label>Difficulty<select value={f.difficulty} onChange={set("difficulty")}>{DIFFS.map((d) => <option key={d} value={d}>{d.toLowerCase()}</option>)}</select></label>
        <label>Status<select value={f.status} onChange={set("status")}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
      </div>
      <div className="field">
        <span>Skills covered</span>
        <div className="row">
          <select className="input" style={{ flex: 1, minWidth: 180 }} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Select a skill</option>
            {skillNames.filter((n) => !f.skills.some((s) => s.skill_name === n)).map((n) => <option key={n}>{n}</option>)}
          </select>
          <button type="button" className="btn btn-ghost" onClick={addSkill} disabled={!pick}><Plus size={14} /> Add</button>
        </div>
        <div className="stack mt-8" style={{ gap: 6 }}>
          {f.skills.map((s, i) => (
            <div className="card-flat row-between" style={{ padding: "8px 12px" }} key={s.skill_name}>
              <b>{s.skill_name}</b>
              <div className="row">
                <label className="row small" style={{ fontWeight: 500 }}>Target level
                  <select className="input" style={{ width: 70, padding: "5px 8px" }} value={s.target_level}
                    onChange={(e) => setF({ ...f, skills: f.skills.map((x, j) => (j === i ? { ...x, target_level: Number(e.target.value) } : x)) })}>
                    {[1, 2, 3, 4, 5].map((l) => <option key={l}>{l}</option>)}
                  </select>
                </label>
                <button type="button" className="btn btn-plain btn-sm" aria-label={`Remove ${s.skill_name}`} onClick={() => setF({ ...f, skills: f.skills.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </form>
  );
}

export default function CoursesNeeded() {
  const toast = useToast();
  const [thresholds, setThresholds] = useState({ demand: 50, gap: 20 });
  const recs = useAsync(() => Promise.all([adminApi.courseRecommendations(thresholds.demand, thresholds.gap), adminApi.skillAnalysis(), adminApi.dashboard()]), [thresholds.demand, thresholds.gap]);
  const courses = useAsync(adminApi.courses);
  const skills = useAsync(() => (isDemoSession() ? adminApi.skillAnalysis().then((r) => r.map((x) => x.skill)) : listSkills().then((r) => r.map((x) => x.name))));
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const close = () => setModal(null);

  const run = async (fn, msg) => {
    setBusy(true);
    try {
      await fn();
      toast(msg);
      close();
      courses.reload();
      recs.reload();
    } catch (err) {
      toast(err.detail, "error");
    } finally {
      setBusy(false);
    }
  };

  const toForm = (c) => ({
    title: c.title, description: c.description, provider: c.provider, duration: c.duration, difficulty: c.difficulty, status: c.status,
    skills: c.skills.map((s) => ({ skill_name: s.skill.name, target_level: s.target_level })),
  });

  return (
    <div>
      <PageHeader title="Courses Needed" subtitle="Which courses to introduce, based on industry demand and trainee skill gaps."
        actions={<button className="btn btn-primary" onClick={() => setModal({ type: "form" })}><Plus size={16} /> Add course</button>} />

      <SectionHead title="Course opportunities" subtitle="Skills with high demand and low availability among trainees and employees."
        actions={
          <div className="row" style={{ gap: 16 }}>
            <label className="field" style={{ minWidth: 150 }}>Min. demand {thresholds.demand}
              <input type="range" min={0} max={90} step={5} value={thresholds.demand} onChange={(e) => setThresholds({ ...thresholds, demand: Number(e.target.value) })} /></label>
            <label className="field" style={{ minWidth: 150 }}>Min. gap {thresholds.gap}
              <input type="range" min={0} max={60} step={5} value={thresholds.gap} onChange={(e) => setThresholds({ ...thresholds, gap: Number(e.target.value) })} /></label>
          </div>
        } />
      <AsyncSection state={recs} skeleton={<SkeletonCards count={3} label="Loading course recommendations..." />}>
        {([rows, analysis, dash]) => {
          const people = dash.total_trainees + dash.total_employees;
          return rows.length === 0 ? (
            <div className="card"><EmptyState icon={BookOpen} title="No course gaps at these thresholds" message="Lower the demand or gap thresholds to see more opportunities." /></div>
          ) : (
            <div className="grid grid-auto">
              {rows.map((r) => {
                const a = analysis.find((x) => x.skill === r.skill);
                const holders = a ? a.trainees_count + a.employees_count : 0;
                const requiring = Math.max(0, people - holders);
                return (
                  <article className="card card-hover stack" key={r.skill}>
                    <div className="row-between" style={{ alignItems: "flex-start" }}>
                      <div><span className="eyebrow">Course opportunity</span><h3 className="mt-8">{r.recommended_course}</h3></div>
                      <StatusBadge status={gapLevel(r.skill_gap).toUpperCase()} label={`Gap: ${gapLevel(r.skill_gap)}`} />
                    </div>
                    <div className="stack" style={{ gap: 8 }}>
                      <div className="row-between small"><span>Industry demand</span><b>{r.demand_score}% · {demandLevel(r.demand_score)}</b></div>
                      <ProgressBar value={r.demand_score} tone="" />
                      <div className="row-between small"><span>Trainees & employees with skill</span><b>{holders.toLocaleString("en-IN")} ({r.availability}%)</b></div>
                      <div className="row-between small"><span>Requiring the skill</span><b>{requiring.toLocaleString("en-IN")}</b></div>
                      <div className="row-between small"><span>Trend</span><b className="row" style={{ gap: 4 }}><TrendIcon t={r.trend} />{(r.trend || "n/a").toLowerCase()}</b></div>
                    </div>
                    <p className="small"><b>Reason:</b> {demandLevel(r.demand_score).toLowerCase()} demand + {gapLevel(r.skill_gap).toLowerCase()} skill gap for {r.skill}.
                      {r.existing_courses.length ? ` Existing: ${r.existing_courses.map((c) => c.title).join(", ")}.` : " No course covers it yet."}</p>
                    <div className="card-actions">
                      {r.action === "CREATE_COURSE" ? (
                        <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: "form", prefill: { ...empty, title: r.recommended_course, skills: [{ skill_name: r.skill, target_level: 4 }] } })}>Create course</button>
                      ) : (
                        <span className="badge badge-success">Active course exists: promote it</span>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type: "detail", item: { ...r, holders, requiring, a } })}>View details</button>
                    </div>
                  </article>
                );
              })}
            </div>
          );
        }}
      </AsyncSection>

      <SectionHead title="Course catalogue" subtitle={isDemoSession() ? "Demo catalogue stored in this browser." : "Courses offered to trainees in the Training Camp."} />
      <AsyncSection state={courses} skeleton={<SkeletonCards count={2} label="Loading courses..." />}>
        {(list) => (
          <DataTable rows={list} searchKeys={["title", "provider"]} pageSize={8}
            columns={[
              { key: "title", label: "Course", render: (c) => <div><b>{c.title}</b><div className="small muted">{c.provider}</div></div> },
              { key: "skills_covered", label: "Skills covered", sortable: false, render: (c) => c.skills_covered.join(", ") || "—" },
              { key: "duration", label: "Duration" },
              { key: "difficulty", label: "Difficulty", render: (c) => c.difficulty.toLowerCase() },
              { key: "status", label: "Status", render: (c) => <StatusBadge status={c.status} /> },
              { key: "actions", label: "", sortable: false, render: (c) => (
                <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                  <button className="btn btn-plain btn-sm" onClick={() => setModal({ type: "form", item: c })} aria-label={`Edit ${c.title}`}><Pencil size={14} /></button>
                  <button className="btn btn-plain btn-sm" title={c.status === "ACTIVE" ? "Deactivate" : "Activate"} aria-label={c.status === "ACTIVE" ? `Deactivate ${c.title}` : `Activate ${c.title}`}
                    onClick={() => run(() => adminApi.setCourseStatus(c.id, c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"), c.status === "ACTIVE" ? "Course deactivated" : "Course activated")}><Power size={14} /></button>
                  {isDemoSession() && <button className="btn btn-plain btn-sm" aria-label={`Delete ${c.title}`} onClick={() => setModal({ type: "delete", item: c })}><Trash2 size={14} /></button>}
                </div>
              ) },
            ]} />
        )}
      </AsyncSection>
      {!isDemoSession() && <div className="mt-16"><DemoNote>Courses are deactivated rather than deleted so trainees' enrollment history is kept. Reactivate any time.</DemoNote></div>}

      <Modal open={modal?.type === "form"} onClose={close} size="lg" title={modal?.item ? "Edit course" : "Add course"}
        footer={<><button className="btn btn-ghost" onClick={close}>Cancel</button><button className="btn btn-primary" form="course-form" disabled={busy}>{busy ? "Saving..." : "Save course"}</button></>}>
        {modal?.type === "form" && (
          <CourseForm initial={modal.item ? toForm(modal.item) : modal.prefill} skillNames={skills.data || []}
            onSubmit={(f) => run(() => (modal.item ? adminApi.updateCourse(modal.item.id, f) : adminApi.createCourse(f)), modal.item ? "Course updated" : "Course created")} />
        )}
      </Modal>
      <ConfirmModal open={modal?.type === "delete"} onClose={close} busy={busy} title="Delete course?" message={`Delete "${modal?.item?.title}" from the demo catalogue?`}
        onConfirm={() => run(() => adminApi.deleteCourse(modal.item.id), "Course deleted")} />
      <Modal open={modal?.type === "detail"} onClose={close} title={modal?.item?.recommended_course} description={`Decision support for ${modal?.item?.skill}`}
        footer={<button className="btn btn-primary" onClick={close}>Close</button>}>
        {modal?.type === "detail" && (() => {
          const r = modal.item;
          return (
            <div className="stack">
              <div className="grid grid-2">
                <div className="card-flat"><div className="label">Industry demand</div><div className="stat-value">{r.demand_score}%</div></div>
                <div className="card-flat"><div className="label">Skill gap</div><div className="stat-value">{r.skill_gap}</div><span className="small">{gapLevel(r.skill_gap)}</span></div>
                <div className="card-flat"><div className="label">Have the skill</div><div className="stat-value">{r.holders.toLocaleString("en-IN")}</div></div>
                <div className="card-flat"><div className="label">Jobs requiring it</div><div className="stat-value">{r.a?.jobs_count ?? "—"}</div></div>
              </div>
              <p className="small">Skill gap = demand score − availability (percentage of trainees and employees holding the skill). Demand combines the market demand index with the share of platform jobs requiring the skill.</p>
              {r.a?.market_demand != null && <DemoNote>The market-demand index and trend are demo seed values, not a live labour-market feed.</DemoNote>}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
