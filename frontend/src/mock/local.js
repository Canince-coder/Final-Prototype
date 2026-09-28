/**
 * Frontend-only data for fields the backend does not store.
 * Everything here lives in this browser's localStorage and is labelled in the UI.
 */
import { localValue } from "./store";

// Extra profile fields (DOB, gender, address, institution, graduation year)
export const PROFILE_EXTRA_FIELDS = ["dob", "gender", "address", "institution", "graduation_year"];
export const profileExtras = {
  get: (userId) => localValue.read(`sb_profile_extras_${userId}`, {}),
  set: (userId, data) => localValue.write(`sb_profile_extras_${userId}`, data),
};

// Fallback UID if the backend ever returns none (it normally provides TRN-/EMP- ids)
export function fallbackUid(userId, prefix = "TRN") {
  const key = `sb_uid_${prefix}_${userId}`;
  let uid = localValue.read(key, null);
  if (!uid) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    uid = `${prefix}-${new Date().getFullYear()}-` + Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    localValue.write(key, uid);
  }
  return uid;
}

// Announcement category/priority: not stored by the backend
export const announcementMeta = {
  all: () => localValue.read("sb_announcement_meta", {}),
  get: (id) => localValue.read("sb_announcement_meta", {})[id] || {},
  set(id, meta) {
    const all = localValue.read("sb_announcement_meta", {});
    localValue.write("sb_announcement_meta", { ...all, [id]: meta });
  },
};

// Job type is not modelled by the backend; derived from the title (demo)
export const JOB_TYPES = ["Full-time", "Internship", "Contract", "Part-time"];
export function jobTypeFor(title = "") {
  const t = title.toLowerCase();
  if (t.includes("intern")) return "Internship";
  if (t.includes("contract")) return "Contract";
  if (t.includes("part-time") || t.includes("part time")) return "Part-time";
  return "Full-time";
}

// Target roles offered for resume analysis (plus live job titles)
export const TARGET_ROLES = [
  "Software Developer", "Backend Developer", "Frontend Developer", "Full Stack Developer",
  "Data Analyst", "Data Scientist", "Cloud Engineer", "DevOps Engineer", "Accounts Assistant", "Electrician",
];

// UI preferences
export const prefs = {
  get: (userId) => localValue.read(`sb_prefs_${userId}`, { emailAlerts: true, jobAlerts: true, trainingAlerts: true, compact: false }),
  set: (userId, p) => localValue.write(`sb_prefs_${userId}`, p),
};
