import client from "./client";

export const listJobs = () => client.get("/jobs").then((r) => r.data);

export const getJob = (jobId) => client.get(`/jobs/${jobId}`).then((r) => r.data);

export const getJobMatch = (jobId) =>
  client.get(`/jobs/${jobId}/match`).then((r) => r.data);

export const getJobSkillGap = (jobId) =>
  client.get(`/jobs/${jobId}/skill-gap`).then((r) => r.data);
