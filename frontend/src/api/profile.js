import client from "./client";

/**
 * Personal-profile endpoints that exist for both roles:
 *   profileApi("/trainees/me")  and  profileApi("/employees/me")
 */
export function profileApi(base) {
  const get = (p, params) => client.get(base + p, { params }).then((r) => r.data);
  return {
    // skills
    skills: () => get("/skills"),
    addSkill: (payload) => client.post(`${base}/skills`, payload).then((r) => r.data),
    updateSkill: (id, proficiency_level) =>
      client.patch(`${base}/skills/${id}`, { proficiency_level }).then((r) => r.data),
    deleteSkill: (id) => client.delete(`${base}/skills/${id}`),
    // projects + assessment
    projects: () => get("/projects"),
    submitProject: (payload) => client.post(`${base}/projects`, payload).then((r) => r.data),
    reassessProject: (id) => client.post(`${base}/projects/${id}/assess`).then((r) => r.data),
    deleteProject: (id) => client.delete(`${base}/projects/${id}`),
    // employment history
    employment: () => get("/employment"),
    addEmployment: (payload) => client.post(`${base}/employment`, payload).then((r) => r.data),
    updateEmployment: (id, payload) => client.put(`${base}/employment/${id}`, payload).then((r) => r.data),
    deleteEmployment: (id) => client.delete(`${base}/employment/${id}`),
    // resume
    resume: () => get("/resume"),
    uploadResume: (file, onUploadProgress) => {
      const form = new FormData();
      form.append("file", file);
      return client.post(`${base}/resume`, form, { onUploadProgress }).then((r) => r.data);
    },
    deleteResume: () => client.delete(`${base}/resume`),
    resumeFileUrl: `${base}/resume/file`,
    analyzeResume: (payload) => client.post(`${base}/resume/analyze`, payload).then((r) => r.data),
  };
}

export const traineeProfile = profileApi("/trainees/me");
export const employeeProfile = profileApi("/employees/me");
