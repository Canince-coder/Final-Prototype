import client from "./client";

export const login = (email, password) =>
  client.post("/auth/login", { email, password }).then((r) => r.data);

export const register = (payload) =>
  client.post("/auth/register", payload).then((r) => r.data);

export const getMe = () => client.get("/auth/me").then((r) => r.data);

/** Server-side password check: re-uses the login endpoint, discards the token. */
export const verifyPassword = (email, password) =>
  client.post("/auth/login", { email, password }).then(() => true);

export const changePassword = (current_password, new_password) =>
  client.post("/auth/change-password", { current_password, new_password });

export const changeEmail = (current_password, new_email) =>
  client.post("/auth/change-email", { current_password, new_email }).then((r) => r.data);
