/**
 * DEMO DATA for the admin portal.
 * Used (a) entirely when the frontend-only demo admin is signed in, and
 * (b) for the few admin figures the backend does not provide (sectors,
 * average skill level, monthly placement trend) - always labelled "Demo data".
 * Shapes mirror the real API responses so pages have one rendering path.
 */
import { collection, localValue, newId } from "./store";

const STATES = [
  // state, total, employed, districts[[name, total, employed]], sectors, avgSkill (0-5)
  ["Rajasthan", 2450, 1720, [["Jaipur", 980, 742], ["Jodhpur", 610, 418], ["Udaipur", 480, 321], ["Kota", 380, 239]],
    { "IT & Software": 34, Manufacturing: 22, Retail: 18, Construction: 14, Healthcare: 12 }, 3.4],
  ["Maharashtra", 3820, 2870, [["Pune", 1340, 1072], ["Mumbai Suburban", 1210, 944], ["Nagpur", 760, 521], ["Nashik", 510, 333]],
    { "IT & Software": 41, Manufacturing: 24, "Banking & Finance": 15, Retail: 11, Logistics: 9 }, 3.7],
  ["Karnataka", 3160, 2490, [["Bengaluru Urban", 1720, 1445], ["Mysuru", 620, 446], ["Dharwad", 470, 318], ["Mangaluru", 350, 281]],
    { "IT & Software": 52, Manufacturing: 16, Healthcare: 12, Retail: 11, Logistics: 9 }, 3.9],
  ["Uttar Pradesh", 4210, 2320, [["Lucknow", 1180, 732], ["Kanpur Nagar", 1040, 551], ["Varanasi", 890, 463], ["Noida", 1100, 574]],
    { Manufacturing: 29, Retail: 23, "IT & Software": 19, Construction: 17, Agriculture: 12 }, 3.0],
  ["Tamil Nadu", 3040, 2210, [["Chennai", 1450, 1102], ["Coimbatore", 890, 641], ["Madurai", 700, 467]],
    { Manufacturing: 33, "IT & Software": 31, Automotive: 16, Healthcare: 11, Retail: 9 }, 3.6],
  ["Bihar", 2380, 1090, [["Patna", 1050, 546], ["Gaya", 690, 290], ["Muzaffarpur", 640, 254]],
    { Retail: 27, Construction: 25, Agriculture: 21, Manufacturing: 16, "IT & Software": 11 }, 2.7],
  ["Kerala", 1720, 1195, [["Ernakulam", 720, 540], ["Thiruvananthapuram", 610, 409], ["Kozhikode", 390, 246]],
    { Healthcare: 26, "IT & Software": 25, Tourism: 21, Retail: 16, Logistics: 12 }, 3.5],
  ["Gujarat", 2690, 1990, [["Ahmedabad", 1180, 920], ["Surat", 930, 688], ["Vadodara", 580, 382]],
    { Manufacturing: 38, Textiles: 19, "IT & Software": 17, Logistics: 15, Retail: 11 }, 3.4],
  ["West Bengal", 2560, 1510, [["Kolkata", 1320, 858], ["Howrah", 690, 373], ["Siliguri", 550, 279]],
    { "IT & Software": 24, Manufacturing: 22, Retail: 21, Logistics: 18, Healthcare: 15 }, 3.1],
];

const rate = (e, t) => (t ? Math.round((e / t) * 1000) / 10 : 0);
const row = (state, district, total, employed) => ({
  state, ...(district ? { district } : {}), total_trainees: total, employed_trainees: employed,
  unemployed_trainees: total - employed, employment_rate: rate(employed, total), demo_records: total,
});

export const demoEmploymentByState = () => STATES.map(([s, t, e]) => row(s, null, t, e));

export const demoEmploymentByDistrict = (state) =>
  STATES.filter(([s]) => !state || s.toLowerCase() === state.toLowerCase())
    .flatMap(([s, , , ds]) => ds.map(([d, t, e]) => row(s, d, t, e)));

/** Sector split + average skill level per state. Demo data in both modes. */
export const demoStateExtras = (state) => {
  const found = STATES.find(([s]) => s.toLowerCase() === (state || "").toLowerCase());
  const fallback = { "IT & Software": 30, Manufacturing: 25, Retail: 20, Construction: 15, Healthcare: 10 };
  const sectors = found ? found[4] : fallback;
  return {
    sectors: Object.entries(sectors).map(([name, value]) => ({ name, value })),
    avgSkill: found ? found[5] : 3.2,
  };
};

/** Month-by-month placements (demo). */
export const demoPlacementTrend = () =>
  ["Apr", "May", "Jun", "Jul", "Aug", "Sep"].map((month, i) => ({
    month, placements: [1180, 1320, 1410, 1590, 1720, 1860][i], trainees: [2900, 3050, 3180, 3260, 3370, 3450][i],
  }));

export const demoAdminDashboard = () => {
  const states = demoEmploymentByState();
  const total = states.reduce((a, r) => a + r.total_trainees, 0);
  const employed = states.reduce((a, r) => a + r.employed_trainees, 0);
  return {
    total_trainees: total - 4180, total_employees: 4180, employed, unemployed: total - employed,
    employment_rate: rate(employed, total), total_jobs: 412, active_courses: demoCourses.list().filter((c) => c.status === "ACTIVE").length,
    pending_submissions: 37, active_announcements: demoAnnouncements.list().filter((a) => a.is_active).length,
    employment_by_state: states, demo_data_note: "All figures are demo data.",
  };
};

// Skill demand dataset (demo) ------------------------------------------------
const SKILLS = [
  // skill, industry demand %, trainees with skill, employees with skill, jobs, trend
  ["Python", 92, 1240, 610, 184, "RISING"], ["Java", 84, 980, 720, 152, "STABLE"],
  ["SQL", 88, 1150, 690, 171, "STABLE"], ["JavaScript", 86, 1080, 640, 163, "STABLE"],
  ["React", 79, 840, 390, 118, "RISING"], ["AWS", 91, 620, 280, 142, "RISING"],
  ["Docker", 82, 510, 260, 109, "RISING"], ["Machine Learning", 89, 730, 210, 96, "RISING"],
  ["Data Analysis", 85, 910, 350, 124, "RISING"], ["Cybersecurity", 87, 340, 150, 88, "RISING"],
  ["Node.js", 74, 620, 300, 81, "STABLE"], ["C++", 60, 700, 420, 44, "STABLE"],
  ["Ruby", 45, 120, 90, 12, "DECLINING"], ["Excel", 65, 1600, 900, 70, "DECLINING"],
];
const PROFILES = 5200;

// Admin edits to the demo dataset, kept in this browser: {skill: {demand, trainees, employees, jobs, trend}}
export const demoSkillOverrides = {
  all: () => localValue.read("sb_demo_skill_overrides", {}),
  set(skill, values) {
    localValue.write("sb_demo_skill_overrides", { ...this.all(), [skill]: values });
  },
  reset: () => localStorage.removeItem("sb_demo_skill_overrides"),
};

export const demoSkillAnalysis = () => {
  const o = demoSkillOverrides.all();
  const base = SKILLS.map(([skill, demand, trainees, employees, jobs, trend]) => ({ skill, demand, trainees, employees, jobs, trend, ...o[skill] }));
  Object.entries(o).forEach(([skill, v]) => !base.some((b) => b.skill === skill) && base.push({ skill, ...v }));
  return base.map(({ skill, demand, trainees, employees, jobs, trend }) => {
    const availability = Math.round(((trainees + employees) / PROFILES) * 100);
    return {
      skill_id: `demo-${skill}`, skill, demand_score: demand, market_demand: demand, internal_demand: Math.round((jobs / 412) * 100),
      jobs_count: jobs, trainees_count: trainees, employees_count: employees, availability,
      skill_gap: Math.max(0, demand - availability), trend,
    };
  }).sort((a, b) => b.skill_gap - a.skill_gap);
};

export const demoCourseRecommendations = (minDemand = 50, minGap = 20) =>
  demoSkillAnalysis()
    .filter((r) => r.demand_score >= minDemand && r.skill_gap >= minGap)
    .map((r) => {
      const existing = demoCourses.list().filter((c) => c.skills_covered.includes(r.skill));
      return {
        skill: r.skill, demand_score: r.demand_score, skill_gap: r.skill_gap, availability: r.availability, trend: r.trend,
        recommended_course: r.availability >= 10 ? `Advanced ${r.skill} Development` : `Foundations of ${r.skill}`,
        existing_courses: existing.map((c) => ({ id: c.id, title: c.title, status: c.status })),
        action: existing.some((c) => c.status === "ACTIVE") ? "PROMOTE_EXISTING" : "CREATE_COURSE",
      };
    });

// Courses (demo CRUD store; same shape as backend ProgramOut) -----------------
const course = (title, provider, duration, difficulty, skills, description) => {
  const skillRows = skills.map(([name, level]) => ({ skill_id: `demo-${name}`, target_level: level, skill: { id: `demo-${name}`, name } }));
  return { id: newId(), name: title, title, description, provider, duration, difficulty, status: "ACTIVE",
    skills: skillRows, skills_covered: skills.map(([n]) => n), created_at: new Date().toISOString() };
};
export const demoCourses = collection("sb_demo_courses", () => [
  course("Advanced Python", "Skill India Digital", "8 weeks", "ADVANCED", [["Python", 4]], "Advanced Python, testing and packaging."),
  course("Java Development", "NIELIT", "10 weeks", "INTERMEDIATE", [["Java", 4], ["SQL", 3]], "Core Java, Spring Boot and JDBC."),
  course("Data Analytics", "NASSCOM FutureSkills", "8 weeks", "INTERMEDIATE", [["Data Analysis", 4], ["SQL", 4], ["Excel", 3]], "SQL, spreadsheets and dashboards."),
  course("Machine Learning", "IIT Madras Pravartak", "12 weeks", "ADVANCED", [["Machine Learning", 4], ["Python", 4]], "Supervised learning and deployment."),
  course("Cloud Computing", "AWS re/Start", "12 weeks", "INTERMEDIATE", [["AWS", 4], ["Docker", 3]], "AWS core services and containers."),
  course("Cybersecurity Essentials", "CDAC", "6 weeks", "BEGINNER", [["Cybersecurity", 3]], "Network security fundamentals."),
  course("Web Development", "Skill India Digital", "10 weeks", "BEGINNER", [["JavaScript", 3], ["React", 3]], "HTML, CSS, JavaScript and React."),
  course("DevOps Foundations", "NSDC", "6 weeks", "INTERMEDIATE", [["Docker", 3], ["AWS", 2]], "CI/CD, containers and monitoring."),
  course("Database Management", "NIELIT", "6 weeks", "BEGINNER", [["SQL", 3]], "Relational design and SQL."),
]);

export const demoAnnouncements = collection("sb_demo_announcements", () => [
  { id: newId(), title: "Advanced Python Training", message: "Registration for the upcoming Advanced Python training program is now open.",
    target_audience: "TRAINEES", is_active: true, created_at: new Date(Date.now() - 2 * 3600e3).toISOString(), expires_at: null,
    category: "Training", priority: "HIGH" },
  { id: newId(), title: "Employment proof verification drive", message: "Upload your offer or experience letters by the end of the month.",
    target_audience: "EMPLOYEES", is_active: true, created_at: new Date(Date.now() - 26 * 3600e3).toISOString(), expires_at: null,
    category: "Verification", priority: "MEDIUM" },
  { id: newId(), title: "Portal maintenance", message: "The portal will be unavailable on Sunday 02:00–04:00 IST.",
    target_audience: "ALL", is_active: true, created_at: new Date(Date.now() - 3 * 86400e3).toISOString(), expires_at: null,
    category: "General", priority: "LOW" },
]);

// People lists (demo) ----------------------------------------------------------
const FIRST = ["Aarav", "Diya", "Kabir", "Ananya", "Rohan", "Isha", "Vikram", "Meera", "Arjun", "Sneha", "Karan", "Pooja"];
const LAST = ["Sharma", "Reddy", "Singh", "Iyer", "Gupta", "Das", "Khan", "Joshi", "Menon", "Yadav"];
const EDU = ["B.Tech", "BCA", "Diploma", "ITI Electrician", "B.Com", "MCA", "12th Pass"];
export const demoProfiles = (role) => {
  let seed = role === "EMPLOYEE" ? 7 : 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: role === "EMPLOYEE" ? 28 : 60 }, (_, i) => {
    const [state, , , districts] = STATES[i % STATES.length];
    const employed = role === "EMPLOYEE" || rnd() < 0.6;
    return {
      id: `demo-${role}-${i}`, name: `${FIRST[Math.floor(rnd() * FIRST.length)]} ${LAST[Math.floor(rnd() * LAST.length)]}`,
      email: `demo.${role.toLowerCase()}${i + 1}@example.org`, role,
      trainee_uid: `TRN-2026-${String(100 + i).padStart(5, "0")}`,
      employee_uid: role === "EMPLOYEE" ? `EMP-2026-${String(40 + i).padStart(5, "0")}` : null,
      state, district: districts[Math.floor(rnd() * districts.length)][0], education: EDU[Math.floor(rnd() * EDU.length)],
      employment_status: employed ? "EMPLOYED" : "UNEMPLOYED", is_demo: true,
    };
  });
};
