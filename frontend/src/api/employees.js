import client from "./client";

const get = (p, params) => client.get(`/employees/me${p}`, { params }).then((r) => r.data);

export const getEmployeeProfile = () => get("");
export const getEmployeeDashboard = () => get("/dashboard");
export const getEmployeeJobs = (eligible_only = false) => get("/jobs", { eligible_only, limit: 100 });
export const getEmployeeAnalytics = () => get("/analytics");

export const getSubmissions = () => get("/submissions");
export const submissionFileUrl = (id) => `/employees/me/submissions/${id}/file`;

export const uploadSubmission = ({ file, file_type, description, employment_id }, onUploadProgress) => {
  const form = new FormData();
  form.append("file", file);
  form.append("file_type", file_type);
  if (description) form.append("description", description);
  if (employment_id) form.append("employment_id", employment_id);
  return client.post("/employees/me/submissions", form, { onUploadProgress }).then((r) => r.data);
};
