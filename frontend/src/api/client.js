import axios from "axios";

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const client = axios.create({ baseURL: BASE_URL });

/** True when the frontend-only demo admin is signed in (no backend token). */
export const isDemoSession = () => {
  try {
    return JSON.parse(localStorage.getItem("sb_user") || "null")?.demo === true;
  } catch {
    return false;
  }
};

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("sb_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Turn backend/network errors into short, user-facing messages.
function friendlyMessage(error) {
  const status = error.response?.status;
  const detail = error.response?.data?.detail;
  if (!error.response) return "Can't reach the server. Check your connection and try again.";
  if (status >= 500) return "Something went wrong on our side. Please try again.";
  if (Array.isArray(detail)) {
    // FastAPI validation error: show the first field problem in plain words
    const first = detail[0] || {};
    const field = (first.loc || []).filter((p) => p !== "body").join(" ");
    return field ? `${field.replace(/_/g, " ")}: ${first.msg}` : first.msg || "Please check the form and try again.";
  }
  if (typeof detail === "string") return detail;
  return "Request failed. Please try again.";
}

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const isLoginAttempt = error.config?.url?.includes("/auth/login");
    if (status === 401 && !isLoginAttempt) {
      localStorage.removeItem("sb_token");
      localStorage.removeItem("sb_user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login?expired=1";
      }
    }
    return Promise.reject({ status, detail: friendlyMessage(error), raw: error });
  }
);

/** Fetch an authenticated file and open it in a new tab (view) or save it (download). */
export async function openFile(url, { download = false, filename } = {}) {
  const res = await client.get(url, { responseType: "blob" });
  const href = URL.createObjectURL(res.data);
  if (download) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename || "file";
    a.click();
  } else {
    window.open(href, "_blank", "noopener");
  }
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

export async function fetchBlobUrl(url) {
  const res = await client.get(url, { responseType: "blob" });
  return URL.createObjectURL(res.data);
}

export default client;
