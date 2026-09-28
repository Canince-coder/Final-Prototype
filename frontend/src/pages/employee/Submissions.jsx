import { useState } from "react";
import { Eye, FileCheck2, FileText, RefreshCw, Sparkles, Upload } from "lucide-react";
import { getSubmissions, submissionFileUrl, uploadSubmission } from "../../api/employees";
import { employeeProfile } from "../../api/profile";
import { openFile } from "../../api/client";
import useAsync from "../../hooks/useAsync";
import { useToast } from "../../context/ToastContext";
import { useNotifications } from "../../context/NotificationContext";
import { AsyncSection, EmptyState, SkeletonCards } from "../../components/States";
import { DemoNote, PageHeader, ProgressBar, StatusBadge, fmtDate } from "../../components/ui";
import Modal from "../../components/Modal";

const DOC_TYPES = [
  ["OFFER_LETTER", "Offer letter"], ["EXPERIENCE_LETTER", "Experience letter"], ["EMPLOYMENT_CERTIFICATE", "Employment certificate"],
  ["PROJECT", "Project document"], ["OTHER", "Other proof"],
];
const typeLabel = Object.fromEntries(DOC_TYPES);

function UploadForm({ employments, initial, onUploaded }) {
  const toast = useToast();
  const [f, setF] = useState({ file: null, file_type: initial?.file_type || "EMPLOYMENT_CERTIFICATE", description: "", employment_id: initial?.employment_id || "" });
  const [progress, setProgress] = useState(null);
  const [drag, setDrag] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const pick = (file) => {
    if (!file) return;
    if (!/\.(pdf|jpe?g|png|docx|txt)$/i.test(file.name)) return toast("Use a PDF, JPG or PNG file.", "error");
    if (file.size > 5 * 1024 * 1024) return toast("File is larger than 5 MB.", "error");
    setF({ ...f, file });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!f.file) return toast("Choose a file to upload.", "error");
    setProgress(0);
    try {
      const before = await employeeProfile.skills();
      const s = await uploadSubmission(f, (ev) => setProgress(Math.round((ev.loaded / (ev.total || 1)) * 100)));
      onUploaded(s, before);
    } catch (err) {
      toast(err.detail, "error");
      setProgress(null);
    }
  };

  return (
    <form id="upload-form" className="form" onSubmit={submit}>
      <label className={`dropzone ${drag ? "drag" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.txt" onChange={(e) => pick(e.target.files[0])} />
        <Upload size={22} color="var(--primary)" />
        <b>{f.file ? f.file.name : "Choose or drop a file"}</b>
        <span className="small muted">PDF, JPG or PNG · max 5 MB</span>
      </label>
      <div className="form-grid">
        <label>Document type<select value={f.file_type} onChange={set("file_type")}>{DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>Related job (optional)
          <select value={f.employment_id} onChange={set("employment_id")}>
            <option value="">Not linked</option>
            {employments.map((e) => <option key={e.id} value={e.id}>{e.role_title} · {e.company_name}</option>)}
          </select>
        </label>
        <label className="full">Description
          <textarea rows={3} value={f.description} onChange={set("description")} placeholder="e.g. Built REST APIs in Ruby on Rails with PostgreSQL for the billing team." />
          <span className="hint">Skills are detected from this description and the document's text.</span>
        </label>
      </div>
      {progress !== null && <div><p className="small">Uploading... {progress}%</p><ProgressBar value={progress} /></div>}
    </form>
  );
}

function SkillReview({ submission, before, onDone }) {
  const toast = useToast();
  const existing = new Set(before.map((s) => s.skill.name));
  const fresh = submission.extracted_skills.filter((s) => !existing.has(s));
  const [keep, setKeep] = useState(() => new Set(fresh));
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      const drop = fresh.filter((s) => !keep.has(s));
      if (drop.length) {
        const rows = await employeeProfile.skills();
        await Promise.all(rows.filter((r) => drop.includes(r.skill.name)).map((r) => employeeProfile.deleteSkill(r.id)));
      }
      toast(keep.size ? `${keep.size} skill${keep.size > 1 ? "s" : ""} added to My Skills` : "Submission saved");
      onDone();
    } catch (err) {
      toast(err.detail, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={confirm} title="Skills identified" description={`From ${submission.original_filename}`}
      footer={<button className="btn btn-primary" onClick={confirm} disabled={busy}>{busy ? "Saving..." : keep.size ? "Add to My Skills" : "Done"}</button>}>
      <div className="stack">
        {submission.extracted_skills.length === 0 ? (
          <p>No platform skills were found in this document. It has still been submitted for verification.</p>
        ) : (
          <>
            <p>Review the skills we found. Selected skills are added to your profile as <b>pending</b> until an administrator verifies this submission.</p>
            <div className="stack" style={{ gap: 8 }}>
              {fresh.map((s) => (
                <label key={s} className="checkbox card-flat" style={{ padding: "10px 14px" }}>
                  <input type="checkbox" checked={keep.has(s)} onChange={() => setKeep((k) => {
                    const n = new Set(k);
                    if (n.has(s)) n.delete(s);
                    else n.add(s);
                    return n;
                  })} />
                  <b>{s}</b> <span className="badge badge-primary" style={{ marginLeft: "auto" }}>New</span>
                </label>
              ))}
              {submission.extracted_skills.filter((s) => existing.has(s)).map((s) => (
                <div key={s} className="card-flat row-between" style={{ padding: "10px 14px" }}><b>{s}</b><span className="small muted">Already on your profile</span></div>
              ))}
            </div>
          </>
        )}
        <DemoNote>Skills are detected by matching the platform skill list against your text (rule-based), not by an AI model.</DemoNote>
      </div>
    </Modal>
  );
}

export default function Submissions() {
  const toast = useToast();
  const { notify } = useNotifications();
  const state = useAsync(() => Promise.all([getSubmissions(), employeeProfile.employment()]));
  const [uploadFor, setUploadFor] = useState(null); // {} for new, submission for re-upload
  const [review, setReview] = useState(null);

  return (
    <div>
      <PageHeader title="Submission / Skill Assessment" subtitle="Submit proof of employment and project work to verify your experience and skills."
        actions={<button className="btn btn-primary" onClick={() => setUploadFor({})}><Upload size={16} /> Upload employment proof</button>} />
      <AsyncSection state={state} skeleton={<SkeletonCards count={3} label="Loading submissions..." />}>
        {([subs, employments]) => (
          <div className="stack-lg">
            <div className="grid grid-3">
              {[["PENDING", "Pending review"], ["VERIFIED", "Verified"], ["REJECTED", "Rejected"]].map(([s, l]) => (
                <div className="card stat" key={s}><div className="stat-top"><span className="stat-label">{l}</span><StatusBadge status={s} label=" " /></div>
                  <div className="stat-value">{subs.filter((x) => x.verification_status === s).length}</div></div>
              ))}
            </div>
            {subs.length === 0 ? (
              <div className="card"><EmptyState icon={FileCheck2} title="No submissions yet" message="Upload an offer letter, experience letter or employment certificate to get your employment verified."
                action={<button className="btn btn-primary btn-sm" onClick={() => setUploadFor({})}>Upload proof</button>} /></div>
            ) : (
              <div className="grid grid-auto">
                {subs.map((s) => (
                  <article className="card card-hover stack" key={s.id}>
                    <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                      <span className="stat-icon"><FileText size={17} /></span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <b style={{ overflowWrap: "anywhere" }}>{s.original_filename}</b>
                        <p className="small">{typeLabel[s.file_type]} · Uploaded {fmtDate(s.uploaded_at)}</p>
                      </div>
                    </div>
                    <div className="row-between">
                      <span className="small muted">Status</span>
                      <StatusBadge status={s.verification_status} label={s.verification_status === "PENDING" ? "Pending review" : undefined} />
                    </div>
                    {s.reviewed_at && <p className="small">Reviewed {fmtDate(s.reviewed_at)}{s.review_note ? ` · "${s.review_note}"` : ""}</p>}
                    {s.extracted_skills.length > 0 && (
                      <div><div className="eyebrow row" style={{ marginBottom: 6, gap: 5 }}><Sparkles size={12} /> Skills identified</div>
                        <div className="tags">{s.extracted_skills.map((k) => <span className="tag" key={k}>{k}</span>)}</div></div>
                    )}
                    <div className="card-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => openFile(submissionFileUrl(s.id)).catch((e) => toast(e.detail, "error"))}><Eye size={14} /> View</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setUploadFor(s)}><RefreshCw size={14} /> Replace</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <UploadModal employments={employments} target={uploadFor} onClose={() => setUploadFor(null)}
              onUploaded={(s, before) => {
                setUploadFor(null);
                notify("Document submitted", `${s.original_filename} is pending review.`);
                setReview({ s, before });
              }} />
          </div>
        )}
      </AsyncSection>
      {review && <SkillReview submission={review.s} before={review.before} onDone={() => { setReview(null); state.reload(); }} />}
    </div>
  );
}

function UploadModal({ employments, target, onClose, onUploaded }) {
  return (
    <Modal open={!!target} onClose={onClose} size="lg"
      title={target?.id ? "Replace document" : "Upload employment proof"}
      description={target?.id ? "Uploads a new version for review. The earlier file stays on record." : "Offer letter, experience letter, employment certificate or other proof."}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="upload-form">Upload</button></>}>
      {target && <UploadForm employments={employments} initial={target} onUploaded={onUploaded} />}
    </Modal>
  );
}
