import client from "./client";

// NOTE: The current backend (Phase 1-7 only) does not expose employment
// endpoints (POST /employment, GET /trainees/me/employment). These calls
// are wired up so the UI works the moment the backend adds them, but for
// now they will fail with a 404 - the Employment page handles that and
// shows a clear "not available yet" state instead of fake data.

export const getMyEmployment = () =>
  client.get("/trainees/me/employment").then((r) => r.data);

export const createEmployment = (payload) =>
  client.post("/employment", payload).then((r) => r.data);
