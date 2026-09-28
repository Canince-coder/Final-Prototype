import { useEffect, useRef, useState } from "react";
import {
  Briefcase, Building2, CalendarDays, Check, Download, Eye, FileText, MapPin, Pencil, Plus, RefreshCw, Trash2, Upload, X,
} from "lucide-react";
import { traineeProfile } from "../../api/profile";
import { listJobs } from "../../api/jobs";
import { fetchBlobUrl, openFile } from "../../api/client";
import useAsync from "../../hooks/useAsync";
import { useToast } from "../../context/ToastContext";
import { useNotifications } from "../../context/NotificationContext";
import { TARGET_ROLES } from "../../mock/local";
import { AsyncSection, EmptyState, Skeleton } from "../../components/States";
import { DemoNote, PageHeader, ProgressBar, ScoreRing, SectionHead, StatusBadge, fmtDate } from "../../components/ui";
import Modal, { ConfirmModal } from "../../components/Modal";

const TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "APPRENTICESHIP", "SELF_EMPLOYED"];
const nice = (s) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export function duration(start, end) {
  const months = Math.max(1, Math.round((new Date(end || Date.now()) - new Date(start)) / (30.44 * 86400e3)));
  const y = Math.floor(months / 12), m = months % 12;
  return [y && `${y} yr${y > 1 ? "s" : ""}`, m && `${m} mo`].filter(Boolean).join(" ") || "< 1 mo";
}

export function EmploymentCard({ e, onEdit, onDelete }) {
  return (
    <article className="card card-hover stack">
      <div className="row-between" style={{ alignItems: "flex-start" }}>
        <div>
          <h3>{e.role_title}</h3>
          <p className="job-card-sub"><Building2 size={13} /> {e.company_name}</p>
        </div>
        <StatusBadge status={e.verification_status} />
      </div>
      <div className="job-meta">
        <span><CalendarDays size={13} /> {fmtDate(e.start_date, { month: "short", year: "numeric" })} – {e.is_current ? "Present" : fmtDate(e.end_date, { month: "short", year: "numeric" })}</span>
        <span>{duration(e.start_date, e.end_date)}</span>
        <span><MapPin size={13} /> {e.location}</span>
        <span><Briefcase size={13} /> {nice(e.employment_type)}</span>
      </div>
      {e.skills_used.length > 0 && <div className="tags">{e.skills_used.map((s) => <span className="tag" key={s}>{s}</span>)}</div>}
      {(onEdit || onDelete) && (
        <div className="card-actions">
          {onEdit && <button className="btn btn-ghost btn-sm" onClick={() => onEdit(e)}><Pencil size={13} /> Edit</button>}
          {onDelete && <button className="btn btn-plain btn-sm" onClick={() => onDelete(e)} aria-label={`Delete ${e.role_title} at ${e.company_name}`}><Trash2 size={13} /> Delete</button>}
        </div>
      )}
    </article>
  );
}

function EmploymentForm({ initial, onSubmit }) {
  const [f, setF] = useState(() => initial
    ? { ...initial, skills_used: initial.skills_used.join(", "), end_date: initial.end_date || "", salary: initial.salary ?? "", current: initial.is_current }
    : { company_name: "", role_title: "", location: "", start_date: "", end_date: "", employment_type: "FULL_TIME", skills_used: "", salary: "", current: false });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form id="employment-form" className="form-grid form" onSubmit={(e) => {
      e.preventDefault();
      onSubmit({
        company_name: f.company_name.trim(), role_title: f.role_title.trim(), location: f.location.trim(),
        start_date: f.start_date, end_date: f.current ? null : f.end_date || null, employment_type: f.employment_type,
        skills_used: f.skills_used.split(",").map((s) => s.trim()).filter(Boolean), salary: f.salary === "" ? null : Number(f.salary),
      });
    }}>
      <label>Company<input required value={f.company_name} onChange={set("company_name")} /></label>
      <label>Job role<input required value={f.role_title} onChange={set("role_title")} /></label>
      <label>Location<input required value={f.location} onChange={set("location")} /></label>
      <label>Employment type<select value={f.employment_type} onChange={set("employment_type")}>{TYPES.map((t) => <option key={t} value={t}>{nice(t)}</option>)}</select></label>
      <label>Start date<input type="date" required max={today} value={f.start_date} onChange={set("start_date")} /></label>
      <label>End date<input type="date" max={today} min={f.start_date} value={f.end_date} onChange={set("end_date")} disabled={f.current} required={!f.current} /></label>
      <label className="checkbox full"><input type="checkbox" checked={f.current} onChange={(e) => setF({ ...f, current: e.target.checked })} /> I currently work here</label>
      <label className="full">Skills used<input value={f.skills_used} onChange={set("skills_used")} placeholder="Python, SQL, Git" /><span className="hint">Comma separated. Recognised skills are added to your profile.</span></label>
      <label>Annual salary (₹, optional)<input type="number" min={0} value={f.salary} onChange={set("salary")} /></label>
    </form>
  );
}

function ResumeCard({ api, resume, reload }) {
  const toast = useToast();
  const [progress, setProgress] = useState(null);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const input = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) return toast("Upload a PDF, DOCX or TXT file.", "error");
    if (file.size > 5 * 1024 * 1024) return toast("File is larger than 5 MB.", "error");
    setProgress(0);
    try {
      await api.uploadResume(file, (e) => setProgress(Math.round((e.loaded / (e.total || 1)) * 100)));
      toast(resume ? "Resume replaced" : "Resume uploaded");
      reload();
    } catch (err) {
      toast(err.detail, "error");
    } finally {
      setProgress(null);
    }
  };

  const showPreview = async () => {
    try {
      setPreview({ loading: true });
      setPreview({ url: await fetchBlobUrl(api.resumeFileUrl), type: resume.content_type });
    } catch (err) {
      setPreview(null);
      toast(err.detail, "error");
    }
  };
  useEffect(() => () => preview?.url && URL.revokeObjectURL(preview.url), [preview]);

  const picker = (
    <input ref={input} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e) => { upload(e.target.files[0]); e.target.value = ""; }} />
  );

  if (!resume) {
    return (
      <label className={`dropzone ${drag ? "drag" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]); }}>
        {picker}
        <Upload size={22} color="var(--primary)" />
        <b>{progress !== null ? `Uploading resume... ${progress}%` : "Upload your resume"}</b>
        <span className="small muted">Drag & drop or click · PDF, DOCX or TXT · max 5 MB</span>
        {progress !== null && <div style={{ width: "60%" }}><ProgressBar value={progress} /></div>}
      </label>
    );
  }

  const canPreview = /pdf|image/.test(resume.content_type);
  return (
    <div className="stack">
      {picker}
      <div className="row" style={{ gap: 14 }}>
        <span className="stat-icon"><FileText size={18} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <b style={{ overflowWrap: "anywhere" }}>{resume.original_filename}</b>
          <p className="small">{(resume.size_bytes / 1024).toFixed(0)} KB · Last updated {fmtDate(resume.uploaded_at)}</p>
        </div>
        {resume.text_extracted ? <span className="badge badge-success">Readable</span> : <span className="badge badge-warning">Text not readable</span>}
      </div>
      {progress !== null && <div><p className="small">Uploading resume... {progress}%</p><ProgressBar value={progress} /></div>}
      <div className="row">
        {canPreview && <button className="btn btn-ghost btn-sm" onClick={showPreview}><Eye size={14} /> Preview</button>}
        <button className="btn btn-ghost btn-sm" onClick={() => openFile(api.resumeFileUrl, { download: true, filename: resume.original_filename }).catch((e) => toast(e.detail, "error"))}><Download size={14} /> Download</button>
        <button className="btn btn-ghost btn-sm" onClick={() => input.current.click()} disabled={progress !== null}><RefreshCw size={14} /> Replace</button>
        <button className="btn btn-plain btn-sm" onClick={() => setConfirm(true)}><Trash2 size={14} /> Remove</button>
      </div>
      {!resume.text_extracted && <p className="hint">We couldn't read text from this file (e.g. a scanned PDF), so it can't be analysed. Upload a text-based PDF, DOCX or TXT.</p>}
      <Modal open={!!preview} onClose={() => setPreview(null)} title="Resume preview" size="lg">
        {preview?.loading ? <Skeleton height={400} /> : preview && (
          /image/.test(preview.type)
            ? <img src={preview.url} alt="Resume preview" style={{ width: "100%" }} />
            : <iframe src={preview.url} title="Resume preview" style={{ width: "100%", height: "70vh", border: "1px solid var(--border)", borderRadius: 10 }} />
        )}
      </Modal>
      <ConfirmModal open={confirm} onClose={() => setConfirm(false)} title="Remove resume?" confirmLabel="Remove"
        message="Your resume and its last analysis will be deleted."
        onConfirm={async () => { await api.deleteResume().then(() => toast("Resume removed")).catch((e) => toast(e.detail, "error")); setConfirm(false); reload(); }} />
    </div>
  );
}

function AtsResult({ a }) {
  const sectionPresent = (name) => a.strengths.some((s) => s.toLowerCase().includes(`${name} section`));
  const bars = [
    ["Keyword match", a.score_breakdown.keyword_coverage],
    ["Skills", a.score_breakdown.skill_coverage],
    ["Resume sections", a.score_breakdown.section_coverage],
    ["Formatting", a.score_breakdown.formatting],
    ["Job compatibility", a.ats_score],
  ];
  return (
    <div className="stack-lg">
      <div className="grid grid-main" style={{ alignItems: "center" }}>
        <div className="row" style={{ gap: 22 }}>
          <ScoreRing value={a.ats_score} label={a.ats_score} sub="/ 100 ATS score" size={140} stroke={11}
            color={a.ats_score >= 75 ? "var(--success)" : a.ats_score >= 50 ? "var(--primary)" : "var(--danger)"} />
          <div style={{ flex: 1, minWidth: 220 }}>
            {bars.map(([l, v]) => (
              <div className="progress-row" key={l}><span className="name">{l}</span><ProgressBar value={v} /><span className="pct">{v}%</span></div>
            ))}
          </div>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          {["experience", "projects", "education"].map((s) => (
            <div className="row-between card-flat" style={{ padding: "10px 14px" }} key={s}>
              <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{s}</span>
              {sectionPresent(s) ? <span className="badge badge-success">Section found</span> : <span className="badge badge-warning">Missing</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card-flat">
          <h3 className="mb-16">Required skills for {a.target_role}</h3>
          {a.matched_skills.length + a.missing_skills.length === 0 ? <p className="small">No platform skills were found in the job description.</p> : (
            <ul className="skill-check">
              {a.matched_skills.map((s) => <li key={s}><Check size={15} className="ok" /> {s}</li>)}
              {a.missing_skills.map((s) => <li key={s}><X size={15} className="miss" /> {s}</li>)}
            </ul>
          )}
          {a.missing_keywords.length > 0 && (
            <>
              <div className="eyebrow mt-16" style={{ marginBottom: 8 }}>Missing keywords</div>
              <div className="tags">{a.missing_keywords.map((k) => <span className="tag tag-warning" key={k}>{k}</span>)}</div>
            </>
          )}
        </div>
        <div className="card-flat">
          <h3 className="mb-16">Resume suggestions</h3>
          <ul className="bullets primary">{a.suggestions.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
        <div className="card-flat">
          <h3 className="mb-16">Strengths & weaknesses</h3>
          <ul className="bullets success">{a.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
          <ul className="bullets warning mt-16">{a.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
        <div className="card-flat">
          <h3 className="mb-16">Recommended next steps</h3>
          {a.recommended_skills.length > 0 && <><div className="eyebrow" style={{ marginBottom: 8 }}>Skills</div><div className="tags mb-16">{a.recommended_skills.map((s) => <span className="tag" key={s}>{s}</span>)}</div></>}
          <div className="eyebrow" style={{ marginBottom: 8 }}>Projects</div>
          {a.recommended_projects.length ? <ul className="bullets primary">{a.recommended_projects.map((p) => <li key={p}>{p}</li>)}</ul> : <p className="small">No project gaps found.</p>}
        </div>
      </div>
      <DemoNote>Prototype ATS analysis from SkillBridge's rule-based engine (<code>{a.engine}</code>): skill, keyword and section matching, not an AI model.</DemoNote>
    </div>
  );
}

function AtsSection({ api, resume, jobs, reload }) {
  const toast = useToast();
  const { notify } = useNotifications();
  const [role, setRole] = useState(TARGET_ROLES[0]);
  const [jobId, setJobId] = useState("");
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(resume?.last_analysis || null);

  const analyze = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const job = jobs.find((j) => j.id === jobId);
      const r = await api.analyzeResume({ target_role: job?.title || role, job_description: jd, job_id: jobId || null });
      setResult(r);
      notify("Your resume analysis is complete", `ATS score ${r.ats_score}/100 for ${r.target_role}.`);
      reload?.();
    } catch (err) {
      toast(err.detail, "error");
    } finally {
      setBusy(false);
    }
  };

  if (!resume) return <EmptyState icon={FileText} message="Upload a resume above to run an ATS analysis." />;
  return (
    <div className="stack-lg">
      <form className="toolbar" onSubmit={analyze} style={{ marginBottom: 0 }}>
        <label className="field">Target role
          <select value={jobId ? "" : role} onChange={(e) => { setRole(e.target.value); setJobId(""); }} disabled={!!jobId}>
            {TARGET_ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label className="field">Or a job on the platform
          <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">None</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} · {j.employer.company_name}</option>)}
          </select>
        </label>
        <label className="field grow">Job description (optional)
          <input value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste key requirements to compare against" />
        </label>
        <button className="btn btn-primary" disabled={busy || !resume.text_extracted}>{busy ? "Analysing resume..." : "Analyse resume"}</button>
      </form>
      {result ? <AtsResult a={result} /> : <EmptyState message="Choose a target role and run the analysis." />}
    </div>
  );
}

export default function Employment() {
  const api = traineeProfile;
  const toast = useToast();
  const state = useAsync(() => Promise.all([
    api.employment(),
    api.resume().catch((e) => (e.status === 404 ? null : Promise.reject(e))),
    listJobs(),
  ]));
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);

  const saveEmployment = async (payload) => {
    setBusy(true);
    try {
      if (modal.item) await api.updateEmployment(modal.item.id, payload);
      else await api.addEmployment(payload);
      toast(modal.item ? "Employment updated" : "Employment added");
      setModal(null);
      state.reload();
    } catch (err) {
      toast(err.detail, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Employment" subtitle="Your employment history, resume and ATS analysis."
        actions={<button className="btn btn-primary" onClick={() => setModal({ type: "form" })}><Plus size={16} /> Add employment</button>} />
      <AsyncSection state={state} skeleton={<div className="card stack"><Skeleton width="30%" height={20} /><Skeleton /><Skeleton width="60%" /></div>}>
        {([jobs, resume, platformJobs]) => {
          const current = jobs.filter((j) => j.is_current);
          const past = jobs.filter((j) => !j.is_current);
          return (
            <div className="stack-lg">
              <section>
                <SectionHead title="Current employment" actions={<StatusBadge status={current.length ? "EMPLOYED" : "UNEMPLOYED"} />} />
                {current.length === 0 ? (
                  <div className="card"><EmptyState icon={Building2} title="Not currently employed" message="Add your current job when you start working." /></div>
                ) : (
                  <div className="grid grid-auto">{current.map((e) => <EmploymentCard key={e.id} e={e} onEdit={(x) => setModal({ type: "form", item: x })} onDelete={(x) => setModal({ type: "delete", item: x })} />)}</div>
                )}
              </section>

              <section>
                <SectionHead title="Past employment" />
                {past.length === 0 ? (
                  <div className="card"><EmptyState message="No previous jobs recorded." /></div>
                ) : (
                  <div className="grid grid-auto">{past.map((e) => <EmploymentCard key={e.id} e={e} onEdit={(x) => setModal({ type: "form", item: x })} onDelete={(x) => setModal({ type: "delete", item: x })} />)}</div>
                )}
              </section>

              <section className="card">
                <div className="card-head"><div><h2>Resume</h2><p>Keep an up-to-date resume for applications and analysis.</p></div></div>
                <ResumeCard api={api} resume={resume} reload={state.reload} />
              </section>

              <section className="card">
                <div className="card-head"><div><h2>ATS resume analysis</h2><p>See how your resume reads to an applicant-tracking system for a target role.</p></div></div>
                <AtsSection key={resume?.id || "none"} api={api} resume={resume} jobs={platformJobs} />
              </section>
            </div>
          );
        }}
      </AsyncSection>

      <Modal open={modal?.type === "form"} onClose={() => setModal(null)} size="lg" title={modal?.item ? "Edit employment" : "Add employment"}
        description="Edited records return to unverified until re-verified."
        footer={<><button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" form="employment-form" disabled={busy}>{busy ? "Saving..." : "Save"}</button></>}>
        {modal?.type === "form" && <EmploymentForm initial={modal.item} onSubmit={saveEmployment} />}
      </Modal>
      <ConfirmModal open={modal?.type === "delete"} onClose={() => setModal(null)} busy={busy} title="Delete employment record?"
        message={`Delete ${modal?.item?.role_title} at ${modal?.item?.company_name}?`}
        onConfirm={async () => {
          setBusy(true);
          await api.deleteEmployment(modal.item.id).then(() => toast("Record deleted")).catch((e) => toast(e.detail, "error"));
          setBusy(false);
          setModal(null);
          state.reload();
        }} />
    </div>
  );
}
