import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Briefcase, FileClock, Megaphone, Percent, UserCheck, UserX, Users } from "lucide-react";
import { adminApi } from "../../api/admin";
import useAsync from "../../hooks/useAsync";
import { demoPlacementTrend, demoStateExtras } from "../../mock/admin";
import { AsyncSection, ErrorState, Loading, Skeleton } from "../../components/States";
import { DemoNote, PageHeader, ProgressBar, StatCard, StatusBadge } from "../../components/ui";
import { BarChartBox, DonutChart, DonutLegend, LineChartBox } from "../../components/Charts";
import DataTable from "../../components/DataTable";

const n = (x) => x.toLocaleString("en-IN");
const DemoTag = () => <span className="badge badge-warning" title="Not from the backend">Demo data</span>;

function StateAnalysis({ rows, national }) {
  const [state, setState] = useState(rows[0]?.state || "");
  const districts = useAsync(() => (state ? adminApi.employmentByDistrict(state) : Promise.resolve([])), [state]);
  useEffect(() => { if (!rows.some((r) => r.state === state)) setState(rows[0]?.state || ""); }, [rows, state]);
  const row = rows.find((r) => r.state === state);
  const extras = demoStateExtras(state);
  if (!row) return null;

  return (
    <section className="card">
      <div className="card-head">
        <div><h2>State-wise analysis</h2><p>Drill into one state's placement outcomes.</p></div>
        <label className="field" style={{ minWidth: 220 }}>
          <span className="sr-only">Select state</span>
          <select value={state} onChange={(e) => setState(e.target.value)}>{rows.map((r) => <option key={r.state}>{r.state}</option>)}</select>
        </label>
      </div>
      <div className="grid grid-4 mb-16">
        <div className="card-flat"><div className="label">Total trainees</div><div className="stat-value">{n(row.total_trainees)}</div></div>
        <div className="card-flat"><div className="label">Employed</div><div className="stat-value" style={{ color: "var(--success)" }}>{n(row.employed_trainees)}</div></div>
        <div className="card-flat"><div className="label">Unemployed</div><div className="stat-value" style={{ color: "var(--warning)" }}>{n(row.unemployed_trainees)}</div></div>
        <div className="card-flat"><div className="label">Employment rate</div><div className="stat-value">{row.employment_rate}%</div>
          <p className="small">{row.employment_rate >= national ? "Above" : "Below"} national {national}%</p></div>
      </div>
      <div className="grid grid-3">
        <div>
          <h3 className="mb-16">By district</h3>
          {districts.loading ? <Loading label="Loading districts..." /> : districts.error ? <ErrorState message={districts.error} onRetry={districts.reload} /> : (
            <BarChartBox data={districts.data.map((d) => ({ district: d.district, Employed: d.employed_trainees, Unemployed: d.unemployed_trainees }))}
              xKey="district" stacked height={240} bars={[{ key: "Employed", name: "Employed", color: "#1d7f47" }, { key: "Unemployed", name: "Unemployed", color: "#d4a03a" }]} />
          )}
        </div>
        <div>
          <div className="row-between mb-16"><h3>Major employment sectors</h3><DemoTag /></div>
          <DonutChart data={extras.sectors} height={170} />
          <div className="mt-16"><DonutLegend data={extras.sectors} /></div>
        </div>
        <div className="stack">
          <div className="row-between"><h3>Average skill level</h3><DemoTag /></div>
          <div className="card-flat">
            <div className="stat-value">{extras.avgSkill.toFixed(1)} <span className="small muted">/ 5</span></div>
            <div className="mt-8"><ProgressBar value={extras.avgSkill} max={5} /></div>
          </div>
          <h3 className="mt-8">Rate vs national</h3>
          <BarChartBox data={[{ name: state, rate: row.employment_rate }, { name: "National", rate: national }]} xKey="name"
            bars={[{ key: "rate", name: "Employment rate" }]} height={150} unit="%" />
        </div>
      </div>
    </section>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const state = useAsync(adminApi.dashboard);

  return (
    <div>
      <PageHeader title="Employment analytics" subtitle="State-wise placement outcomes across the platform." />
      <AsyncSection state={state} skeleton={<div className="grid grid-4">{Array.from({ length: 4 }, (_, i) => <div className="card stat" key={i}><Skeleton width="50%" /><Skeleton height={26} width="40%" /></div>)}</div>}>
        {(d) => {
          const people = d.total_trainees + d.total_employees;
          const states = d.employment_by_state;
          const hasDemo = states.some((r) => r.demo_records > 0);
          return (
            <div className="stack-lg">
              <div className="grid grid-4">
                <StatCard icon={Users} label="Total trainees" value={n(d.total_trainees)} hint={`+ ${n(d.total_employees)} employees`} onClick={() => navigate("/admin/trainees")} />
                <StatCard icon={UserCheck} tone="success" label="Employed" value={n(d.employed)} />
                <StatCard icon={UserX} tone="warning" label="Unemployed" value={n(d.unemployed)} />
                <StatCard icon={Percent} tone="info" label="Employment rate" value={`${d.employment_rate}%`} hint="Employed ÷ total × 100" />
                <StatCard icon={Briefcase} label="Open jobs" value={d.total_jobs} />
                <StatCard icon={BookOpen} tone="info" label="Active courses" value={d.active_courses} onClick={() => navigate("/admin/courses")} />
                <StatCard icon={FileClock} tone="warning" label="Pending verifications" value={d.pending_submissions} />
                <StatCard icon={Megaphone} label="Active announcements" value={d.active_announcements} onClick={() => navigate("/admin/announcements")} />
              </div>

              {hasDemo && <DemoNote>{d.demo_data_note} Rows with a "Demo" badge below include seeded demo profiles.</DemoNote>}

              <div className="grid grid-main">
                <section className="card">
                  <div className="card-head"><div><h2>State employment overview</h2><p>Employed vs unemployed trainees per state</p></div></div>
                  <BarChartBox data={states.map((r) => ({ state: r.state, Employed: r.employed_trainees, Unemployed: r.unemployed_trainees }))}
                    xKey="state" stacked height={300} bars={[{ key: "Employed", name: "Employed", color: "#1d7f47" }, { key: "Unemployed", name: "Unemployed", color: "#d4a03a" }]} />
                </section>
                <section className="card">
                  <div className="card-head"><div><h2>Overall placement</h2><p>{n(people)} people on the platform</p></div></div>
                  <DonutChart height={200} centerLabel={`${d.employment_rate}%`} centerSub="employed"
                    data={[{ name: "Employed", value: d.employed, color: "#1d7f47" }, { name: "Unemployed", value: d.unemployed, color: "#d4a03a" }]} />
                  <div className="mt-16"><DonutLegend data={[{ name: "Employed", value: d.employed, color: "#1d7f47" }, { name: "Unemployed", value: d.unemployed, color: "#d4a03a" }]} /></div>
                </section>
              </div>

              <DataTable rows={states} rowKey="state" searchKeys={["state"]} pageSize={10} initialSort={{ key: "total_trainees", dir: "desc" }}
                columns={[
                  { key: "state", label: "State", render: (r) => <b>{r.state}</b> },
                  { key: "total_trainees", label: "Total", num: true, render: (r) => n(r.total_trainees) },
                  { key: "employed_trainees", label: "Employed", num: true, render: (r) => n(r.employed_trainees) },
                  { key: "unemployed_trainees", label: "Unemployed", num: true, render: (r) => n(r.unemployed_trainees) },
                  { key: "employment_rate", label: "Employment rate", render: (r) => (
                    <div className="row" style={{ gap: 10, minWidth: 140 }}><div style={{ flex: 1 }}><ProgressBar value={r.employment_rate} /></div><b>{r.employment_rate}%</b></div>
                  ) },
                  { key: "demo_records", label: "Data", render: (r) => (r.demo_records > 0 ? <StatusBadge status="PENDING" tone="warning" label="Demo" /> : <StatusBadge status="ACTIVE" label="Live" />) },
                ]} />

              <StateAnalysis rows={states} national={d.employment_rate} />

              <section className="card">
                <div className="card-head"><div><h2>Placements trend</h2><p>Monthly placements vs active trainees</p></div><DemoTag /></div>
                <LineChartBox data={demoPlacementTrend()} xKey="month" lines={[{ key: "placements", name: "Placements" }, { key: "trainees", name: "Active trainees" }]} />
              </section>
            </div>
          );
        }}
      </AsyncSection>
    </div>
  );
}
