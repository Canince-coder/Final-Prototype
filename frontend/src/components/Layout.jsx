import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Award, BarChart3, Bell, BookOpen, Briefcase, Building2, FileCheck2, GraduationCap, IdCard, LayoutDashboard,
  LogOut, Megaphone, Menu, PieChart, Settings, UserRound, Users,
} from "lucide-react";
import { ROLE_LABEL, useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import NotificationBell from "./NotificationBell";
import ErrorBoundary from "./ErrorBoundary";
import { Avatar } from "./ui";

const NAV_ITEMS = {
  TRAINEE: [
    { to: "/trainee/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/trainee/jobs", label: "Recommended Jobs", icon: Briefcase },
    { to: "/trainee/skills", label: "My Skills", icon: Award },
    { to: "/trainee/training", label: "Training Camp", icon: GraduationCap },
    { to: "/trainee/profile", label: "Trainee Profile", icon: UserRound },
    { to: "/trainee/employment", label: "Employment", icon: Building2 },
    { to: "/trainee/notifications", label: "Notifications", icon: Bell, badge: true },
    { to: "/trainee/settings", label: "Settings", icon: Settings },
  ],
  EMPLOYEE: [
    { to: "/employee/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/employee/jobs", label: "Jobs", icon: Briefcase },
    { to: "/employee/submissions", label: "Submission / Skill Assessment", icon: FileCheck2 },
    { to: "/employee/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/employee/profile", label: "Profile", icon: UserRound },
    { to: "/employee/notifications", label: "Notifications", icon: Bell, badge: true },
    { to: "/employee/settings", label: "Settings", icon: Settings },
  ],
  ADMIN: [
    { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/courses", label: "Courses Needed", icon: BookOpen },
    { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
    { to: "/admin/skills", label: "Skill Analysis", icon: PieChart },
    { to: "/admin/trainees", label: "Trainees", icon: Users },
    { to: "/admin/employees", label: "Employees", icon: IdCard },
    { to: "/admin/settings", label: "Settings", icon: Settings },
  ],
  // legacy job-posting company accounts
  EMPLOYER: [
    { to: "/employer/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/employer/jobs", label: "Jobs", icon: Briefcase },
    { to: "/employer/applications", label: "Applications", icon: FileCheck2 },
    { to: "/employer/analytics", label: "Analytics", icon: BarChart3 },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const { unread } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = NAV_ITEMS[user?.role] || [];
  const current = items.find((i) => location.pathname.startsWith(i.to));
  const base = `/${(user?.role || "").toLowerCase()}`;

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <div className={`sidebar-backdrop ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)} />
      <aside className={`sidebar ${menuOpen ? "open" : ""}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <span className="brand-mark">SB</span>
          <span>SkillBridge</span>
        </div>
        <div className="sidebar-role">
          <Avatar name={user?.name} />
          <div style={{ minWidth: 0 }}>
            <div className="sidebar-role-name">{user?.name}</div>
            <div className="sidebar-role-tag">{ROLE_LABEL[user?.role]} portal</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {items.map(({ to, label, icon: Icon, badge }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
              <Icon size={17} />
              <span>{label}</span>
              {badge && unread > 0 && <span className="count">{unread}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="sidebar-link sidebar-logout" onClick={handleLogout}>
            <LogOut size={17} /> Logout
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={18} /></button>
          <span className="topbar-title">{current?.label}</span>
          <span className="topbar-spacer" />
          {user?.demo && <span className="demo-pill" title="Signed in with the frontend-only demo admin. All admin data shown is demo data.">Demo mode</span>}
          {user?.role !== "EMPLOYER" && <NotificationBell allPath={`${base}/notifications`} />}
          <button className="icon-btn" onClick={() => navigate(user?.role === "ADMIN" ? `${base}/settings` : `${base}/profile`)} aria-label="Your profile" title={user?.name}>
            <UserRound size={17} />
          </button>
        </header>
        <main className="content" key={location.pathname}>
          <div className="page-enter">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
