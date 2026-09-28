import { NotAvailable } from "../../components/States";

export default function EmployerAnalytics() {
  return (
    <div>
      <div className="page-header">
        <h1>Employer Analytics</h1>
      </div>
      <div className="card">
        <NotAvailable endpoint="GET /employers/me/analytics" />
      </div>
    </div>
  );
}
