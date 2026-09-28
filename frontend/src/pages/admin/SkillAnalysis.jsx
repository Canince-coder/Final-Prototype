import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, Pencil, Plus, RotateCcw, Target, TrendingUp } from "lucide-react";
import { adminApi } from "../../api/admin";
import { isDemoSession } from "../../api/client";
import useAsync from "../../hooks/useAsync";
import { useToast } from "../../context/ToastContext";
import { demoSkillOverrides } from "../../mock/admin";
import { AsyncSection, EmptyState, Skeleton } from "../../components/States";
import { DemoNote, PageHeader, ProgressBar, SectionHead, StatCard, StatusBadge } from "../../components/ui";
import { BarChartBox } from "../../components/Charts";
import DataTable from "../../components/DataTable";
import Modal from "../../components/Modal";
import { TrendIcon, demandLevel, gapLevel } from "./CoursesNeeded";

const TRENDS = ["RISING", "STABLE", "DECLINING"];

function SkillForm({ initial, demo, onSubmit }) {
  const [f, setF] = useState(initial);
  const set = (k, num) => (e) => setF({ ...f, [k]: num ? Number(e.target.value) : e.target.value });
  return (
    <form id="skill-form" className="form-grid form" onSubmit={(e) => { e.preventDefault(); onSubmit(f); }}>
      <label className="full">Skill name<input required value={f.name} onChange={set("name")} disabled={!!initial.name && demo} /></label>
      <label>Industry demand (0–100)<input type="number" min={0} max={100} required value={f.demand} onChange={set("demand", true)} /></label>
      <label>Trend<select value={f.trend} onChange={set("trend")}>{TRENDS.map((t) => <option key={t} value={t}>{t.toLowerCase()}</option>)}</select></label>
      {demo && (
        <>
          <label>Trainees with skill<input type="number" min={0} value={f.trainees} onChange={set("trainees", true)} /></label>
          <label>Employees with skill<input type="number" min={0} value={f.employees} onChange={set("employees", true)} /></label>
          <label>Jobs requiring skill<input type="number" min={0} value={f.jobs} onChange={set("jobs", true)} /></label>
        </>
      )}
    </form>
  );
}

export default function SkillAnalysis() {
  const navigate = useNavigate();
  const toast = useToast();
  const demo = isDemoSession();
  const state = useAsync(() => Promise.all([adminApi.skillAnalysis(), adminApi.courses()]));
  const [modal, setModal] = useState(null);

  const saveSkill = async (f) => {
    try {
      if (demo) {
        demoSkillOverrides.set(f.name, { demand: f.demand, trainees: f.trainees, employees: f.employees, jobs: f.jobs, trend: f.trend });
      } else {
        await adminApi.createSkill({ name: f.name, market_demand: f.demand, trend: f.trend });
      }
      toast(modal.item ? "Skill data updated" : "Skill added");
      setModal(null);
      state.reload();
    } catch (err) {
      toast(err.detail, "error");
    }
  };

  return (
    <div>
      <PageHeader title="Skill Analysis" subtitle="Industry demand vs skill availability, to decide which courses to introduce."
        actions={<>
          {demo && <button className="btn btn-ghost" onClick={() => { demoSkillOverrides.reset(); state.reload(); toast("Demo data reset"); }}><RotateCcw size={15} /> Reset demo data</button>}
          <button className="btn btn-primary" onClick={() => setModal({ type: "form" })}><Plus size={16} /> Add skill</button>
        </>} />
      <AsyncSection state={state} skeleton={<div className="card"><Skeleton height={260} /></div>}>
        {([rows, courses]) => {
          if (!rows.length) return <div className="card"><EmptyState title="No skills yet" message="Add skills to start tracking demand." /></div>;
          const topDemand = [...rows].sort((a, b) => b.demand_score - a.demand_score)[0];
          const topGap = [...rows].sort((a, b) => b.skill_gap - a.skill_gap)[0];
          const opportunities = rows.filter((r) => r.demand_score >= 70 && r.skill_gap >= 25).sort((a, b) => b.skill_gap - a.skill_gap).slice(0, 4);
          const courseFor = (skill) => courses.find((c) => c.status === "ACTIVE" && c.skills_covered.includes(skill));
          return (
            <div className="stack-lg">
              <DemoNote>{demo
                ? "Demo dataset: every figure on this page is illustrative demo data, editable in this browser."
                : "Job, trainee and employee counts come from the platform database. The industry-demand index and trend are demo seed values until a labour-market data feed is connected."}</DemoNote>

              <div className="grid grid-4">
                <StatCard icon={Flame} label="Highest demand" value={topDemand.skill} small hint={`${topDemand.demand_score}% demand`} />
                <StatCard icon={Target} tone="warning" label="Largest skill gap" value={topGap.skill} small hint={`Gap ${topGap.skill_gap} · ${gapLevel(topGap.skill_gap)}`} />
                <StatCard icon={TrendingUp} tone="success" label="Rising skills" value={rows.filter((r) => r.trend === "RISING").length} />
                <StatCard icon={Target} tone="info" label="Course opportunities" value={opportunities.length} onClick={() => navigate("/admin/courses")} />
              </div>

              <section className="card">
                <div className="card-head"><div><h2>Demand vs availability</h2><p>Top 10 skills by gap. Availability = % of trainees and employees holding the skill.</p></div></div>
                <BarChartBox data={rows.slice(0, 10).map((r) => ({ skill: r.skill, Demand: r.demand_score, Availability: r.availability }))} xKey="skill" unit="%" height={300}
                  bars={[{ key: "Demand", name: "Industry demand" }, { key: "Availability", name: "Availability", color: "#2b64a8" }]} />
              </section>

              <section>
                <SectionHead title="Course decision support" subtitle="High demand + large skill gap. Every figure behind the suggestion is shown." />
                {opportunities.length === 0 ? <div className="card"><EmptyState message="No skills currently combine high demand with a large gap." /></div> : (
                  <div className="grid grid-auto">
                    {opportunities.map((r) => {
                      const existing = courseFor(r.skill);
                      return (
                        <article className="card card-hover stack" key={r.skill}>
                          <span className="eyebrow">Course opportunity</span>
                          <h3>{existing ? existing.title : r.availability >= 10 ? `Advanced ${r.skill} Development` : `${r.skill} Fundamentals`}</h3>
                          <div className="stack" style={{ gap: 8 }}>
                            <div className="row-between small"><span>Industry demand</span><b>{r.demand_score}%</b></div>
                            <div className="row-between small"><span>Trainees with skill</span><b>{r.trainees_count.toLocaleString("en-IN")}</b></div>
                            <div className="row-between small"><span>Jobs requiring it</span><b>{r.jobs_count}</b></div>
                            <div className="row-between small"><span>Skill gap</span><StatusBadge status={gapLevel(r.skill_gap).toUpperCase()} label={gapLevel(r.skill_gap)} /></div>
                          </div>
                          <p className="small"><b>Reason for consideration:</b> {demandLevel(r.demand_score).toLowerCase()} demand + {gapLevel(r.skill_gap).toLowerCase()} skill gap
                            {r.trend === "RISING" ? ", and demand is rising" : ""}.{existing ? " An active course already covers it; consider promoting it." : ""}</p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <DataTable rows={rows} rowKey="skill" searchKeys={["skill"]} pageSize={12} initialSort={{ key: "skill_gap", dir: "desc" }}
                columns={[
                  { key: "skill", label: "Skill", render: (r) => <b>{r.skill}</b> },
                  { key: "demand_score", label: "Industry demand", render: (r) => (
                    <div className="row" style={{ gap: 8, minWidth: 130, flexWrap: "nowrap" }}><div style={{ flex: 1 }}><ProgressBar value={r.demand_score} tone="" /></div><b>{r.demand_score}%</b></div>) },
                  { key: "jobs_count", label: "Jobs", num: true },
                  { key: "trainees_count", label: "Trainees with skill", num: true, render: (r) => r.trainees_count.toLocaleString("en-IN") },
                  { key: "employees_count", label: "Employees with skill", num: true, render: (r) => r.employees_count.toLocaleString("en-IN") },
                  { key: "skill_gap", label: "Skill gap", render: (r) => <StatusBadge status={gapLevel(r.skill_gap).toUpperCase()} label={`${gapLevel(r.skill_gap)} (${r.skill_gap})`} /> },
                  { key: "trend", label: "Trend", render: (r) => <span className="row" style={{ gap: 5 }}><TrendIcon t={r.trend} />{(r.trend || "n/a").toLowerCase()}</span> },
                  ...(demo ? [{ key: "edit", label: "", sortable: false, mobile: false, render: (r) => (
                    <button className="btn btn-plain btn-sm" aria-label={`Edit ${r.skill}`} onClick={() => setModal({ type: "form", item: r })}><Pencil size={14} /></button>) }] : []),
                ]} />
            </div>
          );
        }}
      </AsyncSection>

      <Modal open={modal?.type === "form"} onClose={() => setModal(null)} title={modal?.item ? `Edit ${modal.item.skill}` : "Add skill"}
        description={demo ? "Changes apply to the demo dataset in this browser." : "Adds the skill to the platform vocabulary with a demand index."}
        footer={<><button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" form="skill-form">Save</button></>}>
        {modal?.type === "form" && (
          <SkillForm demo={demo} onSubmit={saveSkill} initial={modal.item
            ? { name: modal.item.skill, demand: modal.item.demand_score, trend: modal.item.trend || "STABLE", trainees: modal.item.trainees_count, employees: modal.item.employees_count, jobs: modal.item.jobs_count }
            : { name: "", demand: 60, trend: "STABLE", trainees: 0, employees: 0, jobs: 0 }} />
        )}
      </Modal>
    </div>
  );
}
