import { Award, Building2, Clock, History } from "lucide-react";
import { getEmployeeAnalytics } from "../../api/employees";
import useAsync from "../../hooks/useAsync";
import { AsyncSection, EmptyState, Skeleton } from "../../components/States";
import { PageHeader, StatCard, StatusBadge, fmtDate } from "../../components/ui";
import { BarChartBox, LineChartBox } from "../../components/Charts";
import DataTable from "../../components/DataTable";
import { duration } from "../trainee/Employment";

const months = (a, b) => Math.max(0, (new Date(b || Date.now()) - new Date(a)) / (30.44 * 86400e3));

/** Cumulative years of experience at the end of each calendar year (overlaps counted once). */
function experienceOverTime(history) {
  if (!history.length) return [];
  const now = Date.now();
  // merge overlapping jobs into disjoint [start, end] spans
  const spans = history
    .map((e) => [new Date(e.start_date).getTime(), e.end_date ? new Date(e.end_date).getTime() : now])
    .sort((x, y) => x[0] - y[0])
    .reduce((acc, [s, e]) => {
      const last = acc.at(-1);
      if (last && s <= last[1]) last[1] = Math.max(last[1], e);
      else acc.push([s, e]);
      return acc;
    }, []);
  const out = [];
  for (let y = new Date(spans[0][0]).getFullYear(); y <= new Date(now).getFullYear(); y++) {
    const cutoff = Math.min(now, new Date(y, 11, 31).getTime());
    const ms = spans.reduce((t, [s, e]) => t + Math.max(0, Math.min(e, cutoff) - s), 0);
    out.push({ year: String(y), years: +(ms / (365.25 * 86400e3)).toFixed(1) });
  }
  return out;
}

export default function EmployeeAnalytics() {
  const state = useAsync(getEmployeeAnalytics);
  return (
    <div>
      <PageHeader title="Analytics" subtitle="Your employment history and experience over time." />
      <AsyncSection state={state} skeleton={<div className="card stack"><Skeleton height={220} /></div>}>
        {(a) => {
          const history = [...a.employment_history].sort((x, y) => new Date(y.start_date) - new Date(x.start_date));
          const skillCounts = Object.entries(history.flatMap((e) => e.skills_used).reduce((m, s) => ({ ...m, [s]: (m[s] || 0) + 1 }), {}))
            .map(([skill, jobs]) => ({ skill, jobs })).sort((x, y) => y.jobs - x.jobs);
          const progression = [...history].reverse().map((e) => ({ role: `${e.role_title} (${e.company_name})`, months: Math.round(months(e.start_date, e.end_date)) }));
          const byYear = history.reduce((m, e) => {
            const y = new Date(e.start_date).getFullYear();
            (m[y] ||= []).push(e);
            return m;
          }, {});
          return (
            <div className="stack-lg">
              <div className="grid grid-4">
                <StatCard icon={Clock} label="Total experience" value={`${a.total_experience_years} yrs`} hint={`${a.total_experience_months} months`} />
                <StatCard icon={Building2} tone="info" label="Companies" value={a.companies_count} />
                <StatCard icon={History} tone="warning" label="Past companies" value={a.past_companies.length} />
                <StatCard icon={Award} tone="success" label="Skills gained" value={a.skills_gained.length} />
              </div>

              {history.length === 0 ? (
                <div className="card"><EmptyState icon={History} title="No employment history yet" message="Your employment records will appear here once added." /></div>
              ) : (
                <>
                  <div className="grid grid-main">
                    <section className="card">
                      <div className="card-head"><div><h2>Experience over time</h2><p>Cumulative years worked at each year end</p></div></div>
                      <LineChartBox data={experienceOverTime(a.employment_history)} xKey="year" lines={[{ key: "years", name: "Years of experience" }]} unit=" yrs" />
                    </section>
                    <section className="card">
                      <h2 className="mb-16">Employment timeline</h2>
                      <div className="vtimeline">
                        {Object.keys(byYear).sort((x, y) => y - x).map((year) => (
                          <div key={year}>
                            <div className="vt-year" style={{ marginBottom: 10 }}>{year}</div>
                            {byYear[year].map((e) => (
                              <div className={`vt-item ${e.is_current ? "current" : "done"}`} key={e.id}>
                                <span className="vt-dot" />
                                <b>{e.company_name}</b>
                                <p className="small">{e.role_title} · {duration(e.start_date, e.end_date)}{e.is_current ? " · Current" : ""}</p>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <div className="grid grid-2">
                    <section className="card">
                      <div className="card-head"><div><h2>Skills used</h2><p>Number of jobs where each skill was used</p></div></div>
                      {skillCounts.length ? <BarChartBox data={skillCounts} xKey="skill" bars={[{ key: "jobs", name: "Jobs" }]} height={240} /> : <EmptyState message="No skills recorded against your jobs." />}
                    </section>
                    <section className="card">
                      <div className="card-head"><div><h2>Job-role progression</h2><p>Months in each role, oldest first</p></div></div>
                      <BarChartBox data={progression} xKey="role" bars={[{ key: "months", name: "Months", color: "#2b64a8" }]} height={240} horizontal unit=" mo" />
                    </section>
                  </div>

                  <section>
                    <h2 className="mb-16">Companies</h2>
                    <DataTable rows={history} searchKeys={["company_name", "role_title", "location"]} pageSize={8}
                      columns={[
                        { key: "company_name", label: "Company" },
                        { key: "role_title", label: "Job role" },
                        { key: "start_date", label: "Duration", render: (e) => `${fmtDate(e.start_date, { month: "short", year: "numeric" })} – ${e.is_current ? "Present" : fmtDate(e.end_date, { month: "short", year: "numeric" })} (${duration(e.start_date, e.end_date)})` },
                        { key: "location", label: "Location" },
                        { key: "skills_used", label: "Skills used", sortable: false, render: (e) => e.skills_used.join(", ") || "—" },
                        { key: "verification_status", label: "Status", render: (e) => <StatusBadge status={e.verification_status} /> },
                      ]} />
                  </section>

                  {a.skills_gained.length > 0 && (
                    <section className="card">
                      <h2 className="mb-16">Skills gained</h2>
                      <div className="tags">{a.skills_gained.map((s) => <span className="tag" key={s}>{s}</span>)}</div>
                    </section>
                  )}
                </>
              )}
            </div>
          );
        }}
      </AsyncSection>
    </div>
  );
}
