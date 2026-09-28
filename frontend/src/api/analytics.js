import client from "./client";

// NOTE: None of these analytics endpoints exist in the current backend
// repo (no app/routers/analytics.py, not registered in app/main.py).
// Calls are left in place for when the backend adds them; every page
// that uses them treats a failure as "not available yet" rather than
// inventing numbers.

export const getAnalyticsOverview = () =>
  client.get("/analytics/overview").then((r) => r.data);

export const getApplicationsByStatus = () =>
  client.get("/analytics/applications-by-status").then((r) => r.data);

export const getSkillsDemandSupply = () =>
  client.get("/analytics/skills-demand-supply").then((r) => r.data);

export const getEmployerAnalytics = () =>
  client.get("/employers/me/analytics").then((r) => r.data);
