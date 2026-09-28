import client from "./client";

export const getMyTraineeProfile = () =>
  client.get("/trainees/me").then((r) => r.data);

export const updateMyTraineeProfile = (payload) =>
  client.put("/trainees/me", payload).then((r) => r.data);

export const getMySkills = () =>
  client.get("/trainees/me/skills").then((r) => r.data);

export const addMySkill = (payload) =>
  client.post("/trainees/me/skills", payload).then((r) => r.data);

export const getRecommendedJobs = (limit = 10) =>
  client.get("/trainees/me/recommended-jobs", { params: { limit } }).then((r) => r.data);

export const getTraineeDashboard = () =>
  client.get("/trainees/me/dashboard").then((r) => r.data);

// Training Camp
export const getMyTraining = (status) =>
  client.get("/trainees/me/training", { params: status ? { status } : {} }).then((r) => r.data);

export const getRecommendedTraining = (target_job_id) =>
  client
    .get("/trainees/me/recommended-training", { params: target_job_id ? { target_job_id } : {} })
    .then((r) => r.data);

export const enrollInProgram = (programId) =>
  client.post(`/trainees/me/training/${programId}/enroll`).then((r) => r.data);

export const completeEnrollment = (enrollmentId) =>
  client.post(`/trainees/me/training/enrollments/${enrollmentId}/complete`).then((r) => r.data);

export const dropEnrollment = (enrollmentId) =>
  client.post(`/trainees/me/training/enrollments/${enrollmentId}/drop`).then((r) => r.data);
