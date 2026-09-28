import client, { isDemoSession } from "./client";
import { demoAnnouncements } from "../mock/admin";

export const listSkills = () => client.get("/skills").then((r) => r.data);

export const listTrainingPrograms = () => client.get("/training/programs").then((r) => r.data);

/** Announcements visible to the signed-in user (demo admin: local demo store). */
export const listAnnouncements = () =>
  isDemoSession() ? Promise.resolve(demoAnnouncements.list()) : client.get("/announcements").then((r) => r.data);
