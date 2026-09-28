import { createContext, useContext, useEffect, useState } from "react";
import { login as apiLogin, getMe } from "../api/auth";

const AuthContext = createContext(null);

export const ROLE_LABEL = { TRAINEE: "Trainee", EMPLOYEE: "Employee", ADMIN: "Administrator", EMPLOYER: "Employer" };

// Frontend-only demo admin (prototype). Credentials come from frontend/.env; it
// gets NO backend token and every admin page runs on labelled demo data.
// This is not a security boundary: anything in a Vite env var ships to the browser.
const DEMO_ADMIN_USER = import.meta.env.VITE_DEMO_ADMIN_USER;
const DEMO_ADMIN_PASSWORD = import.meta.env.VITE_DEMO_ADMIN_PASSWORD;
export const demoAdminEnabled = Boolean(DEMO_ADMIN_USER && DEMO_ADMIN_PASSWORD);

const clearStorage = () => {
  localStorage.removeItem("sb_token");
  localStorage.removeItem("sb_user");
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sb_user") || "null");
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("sb_token");
    if (!token) {
      // only the demo admin session lives without a token
      if (!user?.demo) {
        clearStorage();
        setUser(null);
      }
      setLoading(false);
      return;
    }
    getMe()
      .then((me) => {
        setUser(me);
        localStorage.setItem("sb_user", JSON.stringify(me));
      })
      .catch(() => {
        clearStorage();
        setUser(null);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * @param expectedRole role chosen on the login screen; the backend role must match
   *                     (legacy EMPLOYER accounts may sign in from any option).
   */
  const login = async (identifier, password, expectedRole) => {
    if (expectedRole === "ADMIN" && demoAdminEnabled && identifier === DEMO_ADMIN_USER && password === DEMO_ADMIN_PASSWORD) {
      const demoUser = { id: "demo-admin", name: "Demo Administrator", email: "admin (demo)", role: "ADMIN", demo: true };
      localStorage.removeItem("sb_token");
      localStorage.setItem("sb_user", JSON.stringify(demoUser));
      setUser(demoUser);
      return demoUser;
    }
    try {
      const { access_token, role } = await apiLogin(identifier, password);
      if (expectedRole && role !== expectedRole && role !== "EMPLOYER") {
        throw {
          status: 403,
          detail: `This account is registered as ${ROLE_LABEL[role] || role}. Choose "${ROLE_LABEL[role] || role}" to sign in.`,
        };
      }
      localStorage.setItem("sb_token", access_token);
      const me = await getMe();
      localStorage.setItem("sb_user", JSON.stringify(me));
      setUser(me);
      return me;
    } catch (error) {
      clearStorage();
      setUser(null);
      throw error;
    }
  };

  const logout = () => {
    clearStorage();
    setUser(null);
  };

  const updateUser = (changes) => {
    setUser((u) => {
      const next = { ...u, ...changes };
      localStorage.setItem("sb_user", JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export const homePath = (role) => `/${(role || "").toLowerCase()}/dashboard`;
