import client from "./client";

export const applyToJob = (jobId) =>
  client.post(`/jobs/${jobId}/apply`).then((r) => r.data);

export const getMyApplications = () =>
  client.get("/trainees/me/applications").then((r) => r.data);

export const updateApplicationStatus = (applicationId, status) =>
  client
    .patch(`/applications/${applicationId}/status`, { status })
    .then((r) => r.data);
