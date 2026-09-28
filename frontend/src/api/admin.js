/**
 * Admin data layer. Real backend endpoints normally; when the frontend-only
 * demo admin is signed in (no backend token) every call is served from
 * src/mock/admin.js instead. Pages never branch on the mode themselves.
 */
import client, { isDemoSession } from "./client";
import {
  demoAdminDashboard,
  demoAnnouncements,
  demoCourseRecommendations,
  demoCourses,
  demoEmploymentByDistrict,
  demoEmploymentByState,
  demoProfiles,
  demoSkillAnalysis,
} from "../mock/admin";

const get = (p, params) => client.get(`/admin${p}`, { params }).then((r) => r.data);
const demo = (fn) => Promise.resolve().then(fn);

// Course payload from the UI form -> backend shape / demo shape
const courseToDemo = (c) => ({
  name: c.title, title: c.title, description: c.description, provider: c.provider, duration: c.duration,
  difficulty: c.difficulty, status: c.status,
  skills: c.skills.map((s) => ({ skill_id: `demo-${s.skill_name}`, target_level: s.target_level, skill: { id: `demo-${s.skill_name}`, name: s.skill_name } })),
  skills_covered: c.skills.map((s) => s.skill_name),
});

export const adminApi = {
  dashboard: () => (isDemoSession() ? demo(demoAdminDashboard) : get("/dashboard")),
  employmentByState: () => (isDemoSession() ? demo(demoEmploymentByState) : get("/analytics/employment-by-state")),
  employmentByDistrict: (state) =>
    isDemoSession() ? demo(() => demoEmploymentByDistrict(state)) : get("/analytics/employment-by-district", { state }),
  profiles: (params) =>
    isDemoSession()
      ? demo(() =>
          demoProfiles(params.role).filter(
            (p) => (!params.state || p.state === params.state) && (!params.employment_status || p.employment_status === params.employment_status)
          )
        )
      : get("/trainees", { limit: 500, ...params }),

  skillAnalysis: () => (isDemoSession() ? demo(demoSkillAnalysis) : get("/skills/analysis")),
  courseRecommendations: (min_demand = 50, min_gap = 20) =>
    isDemoSession() ? demo(() => demoCourseRecommendations(min_demand, min_gap)) : get("/skills/course-recommendations", { min_demand, min_gap }),

  courses: () => (isDemoSession() ? demo(demoCourses.list) : get("/courses")),
  createCourse: (c) => (isDemoSession() ? demo(() => demoCourses.create(courseToDemo(c))) : client.post("/admin/courses", c).then((r) => r.data)),
  updateCourse: (id, c) =>
    isDemoSession() ? demo(() => demoCourses.update(id, courseToDemo(c))) : client.patch(`/admin/courses/${id}`, c).then((r) => r.data),
  // backend: soft-deactivate; demo: removed from the demo store
  deleteCourse: (id) => (isDemoSession() ? demo(() => demoCourses.remove(id)) : client.delete(`/admin/courses/${id}`)),
  setCourseStatus: (id, status) =>
    isDemoSession() ? demo(() => demoCourses.update(id, { status })) : client.patch(`/admin/courses/${id}`, { status }).then((r) => r.data),

  announcements: () => (isDemoSession() ? demo(demoAnnouncements.list) : get("/announcements")),
  createAnnouncement: (a) =>
    isDemoSession() ? demo(() => demoAnnouncements.create(a)) : client.post("/admin/announcements", a).then((r) => r.data),
  updateAnnouncement: (id, a) =>
    isDemoSession() ? demo(() => demoAnnouncements.update(id, a)) : client.patch(`/admin/announcements/${id}`, a).then((r) => r.data),
  deleteAnnouncement: (id) =>
    isDemoSession() ? demo(() => demoAnnouncements.remove(id)) : client.delete(`/admin/announcements/${id}`),

  createSkill: (payload) => client.post("/admin/skills", payload).then((r) => r.data),
};
