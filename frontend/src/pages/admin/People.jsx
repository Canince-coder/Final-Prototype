import { useMemo, useState } from "react";
import { Users, UserCheck, UserX } from "lucide-react";
import { adminApi } from "../../api/admin";
import useAsync from "../../hooks/useAsync";
import { AsyncSection, Skeleton } from "../../components/States";
import { PageHeader, StatCard, StatusBadge } from "../../components/ui";
import DataTable from "../../components/DataTable";

export default function People({ role }) {
  const isTrainee = role === "TRAINEE";
  const state = useAsync(() => adminApi.profiles({ role }), [role]);
  const [f, setF] = useState({ state: "", status: "" });

  const rows = state.data || [];
  const states = useMemo(() => [...new Set(rows.map((r) => r.state || "Unknown"))].sort(), [rows]);
  const shown = rows.filter((r) => (!f.state || (r.state || "Unknown") === f.state) && (!f.status || r.employment_status === f.status));
  const employed = shown.filter((r) => r.employment_status === "EMPLOYED").length;

  return (
    <div>
      <PageHeader title={isTrainee ? "Trainees" : "Employees"} subtitle={`All ${isTrainee ? "trainee" : "employee"} profiles by location and employment status.`} />
      <AsyncSection state={state} skeleton={<div className="card stack"><Skeleton height={20} width="30%" /><Skeleton height={200} /></div>}>
        {() => (
          <div className="stack-lg">
            <div className="grid grid-3">
              <StatCard icon={Users} label="Showing" value={shown.length} hint={`of ${rows.length}`} />
              <StatCard icon={UserCheck} tone="success" label="Employed" value={employed} />
              <StatCard icon={UserX} tone="warning" label="Employment rate" value={`${shown.length ? Math.round((employed / shown.length) * 1000) / 10 : 0}%`} />
            </div>
            <DataTable rows={shown} searchKeys={["name", "email", "trainee_uid", "employee_uid", "district"]} pageSize={12}
              toolbar={
                <div className="row">
                  <label className="field" style={{ minWidth: 160 }}><span className="sr-only">State</span>
                    <select value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}><option value="">All states</option>{states.map((s) => <option key={s}>{s}</option>)}</select>
                  </label>
                  <label className="field" style={{ minWidth: 160 }}><span className="sr-only">Employment status</span>
                    <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                      <option value="">Any status</option><option value="EMPLOYED">Employed</option><option value="UNEMPLOYED">Unemployed</option>
                    </select>
                  </label>
                </div>
              }
              columns={[
                { key: "name", label: "Name", render: (r) => <div><b>{r.name}</b><div className="small muted">{r.email}</div></div> },
                { key: isTrainee ? "trainee_uid" : "employee_uid", label: isTrainee ? "Trainee UID" : "Employee ID", render: (r) => <span className="mono small">{(isTrainee ? r.trainee_uid : r.employee_uid) || "—"}</span> },
                ...(isTrainee ? [] : [{ key: "trainee_uid", label: "Trainee UID", render: (r) => <span className="mono small">{r.trainee_uid || "—"}</span> }]),
                { key: "state", label: "State", render: (r) => r.state || "Unknown" },
                { key: "district", label: "District" },
                { key: "education", label: "Education" },
                { key: "employment_status", label: "Status", render: (r) => <StatusBadge status={r.employment_status} /> },
                { key: "is_demo", label: "Data", render: (r) => (r.is_demo ? <span className="badge badge-warning">Demo</span> : <span className="badge badge-success">Live</span>) },
              ]} />
          </div>
        )}
      </AsyncSection>
    </div>
  );
}
