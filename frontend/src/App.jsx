import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ToastProvider } from "./context/ToastContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";

import Notifications from "./pages/shared/Notifications";
import Settings from "./pages/shared/Settings";
import ProfilePage from "./pages/shared/ProfilePage";

import TraineeDashboard from "./pages/trainee/Dashboard";
import RecommendedJobs from "./pages/trainee/RecommendedJobs";
import JobDetails from "./pages/trainee/JobDetails";
import SkillGap from "./pages/trainee/SkillGap";
import MySkills from "./pages/trainee/MySkills";
import TrainingCamp from "./pages/trainee/TrainingCamp";
import Applications from "./pages/trainee/Applications";
import Employment from "./pages/trainee/Employment";

import EmployeeDashboard from "./pages/employee/Dashboard";
import EmployeeJobs from "./pages/employee/Jobs";
import Submissions from "./pages/employee/Submissions";
import EmployeeAnalytics from "./pages/employee/Analytics";

import AdminDashboard from "./pages/admin/Dashboard";
import CoursesNeeded from "./pages/admin/CoursesNeeded";
import Announcements from "./pages/admin/Announcements";
import SkillAnalysis from "./pages/admin/SkillAnalysis";
import People from "./pages/admin/People";

import EmployerDashboard from "./pages/employer/Dashboard";
import EmployerJobs from "./pages/employer/Jobs";
import EmployerApplications from "./pages/employer/Applications";
import EmployerAnalytics from "./pages/employer/Analytics";

const portal = (roles) => (
  <ProtectedRoute roles={roles}>
    <Layout />
  </ProtectedRoute>
);

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <NotificationProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              <Route element={portal(["TRAINEE"])}>
                <Route path="/trainee/dashboard" element={<TraineeDashboard />} />
                <Route path="/trainee/jobs" element={<RecommendedJobs />} />
                <Route path="/trainee/jobs/:jobId" element={<JobDetails />} />
                <Route path="/trainee/jobs/:jobId/skill-gap" element={<SkillGap />} />
                <Route path="/trainee/skills" element={<MySkills />} />
                <Route path="/trainee/training" element={<TrainingCamp />} />
                <Route path="/trainee/applications" element={<Applications />} />
                <Route path="/trainee/profile" element={<ProfilePage role="TRAINEE" />} />
                <Route path="/trainee/employment" element={<Employment />} />
                <Route path="/trainee/notifications" element={<Notifications />} />
                <Route path="/trainee/settings" element={<Settings />} />
              </Route>

              <Route element={portal(["EMPLOYEE"])}>
                <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
                <Route path="/employee/jobs" element={<EmployeeJobs />} />
                <Route path="/employee/submissions" element={<Submissions />} />
                <Route path="/employee/analytics" element={<EmployeeAnalytics />} />
                <Route path="/employee/profile" element={<ProfilePage role="EMPLOYEE" />} />
                <Route path="/employee/notifications" element={<Notifications />} />
                <Route path="/employee/settings" element={<Settings />} />
              </Route>

              <Route element={portal(["ADMIN"])}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/courses" element={<CoursesNeeded />} />
                <Route path="/admin/announcements" element={<Announcements />} />
                <Route path="/admin/skills" element={<SkillAnalysis />} />
                <Route path="/admin/trainees" element={<People role="TRAINEE" />} />
                <Route path="/admin/employees" element={<People role="EMPLOYEE" />} />
                <Route path="/admin/notifications" element={<Notifications />} />
                <Route path="/admin/settings" element={<Settings />} />
              </Route>

              <Route element={portal(["EMPLOYER"])}>
                <Route path="/employer/dashboard" element={<EmployerDashboard />} />
                <Route path="/employer/jobs" element={<EmployerJobs />} />
                <Route path="/employer/applications" element={<EmployerApplications />} />
                <Route path="/employer/analytics" element={<EmployerAnalytics />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </NotificationProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
