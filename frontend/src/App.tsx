import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Workspaces from "./pages/Workspaces";
import WorkspaceDetail from "./pages/WorkspaceDetail";
import WorkflowDetail from "./pages/WorkflowDetail";
import RunDetail from "./pages/RunDetail";
import Notifications from "./pages/Notifications";
import Deliveries from "./pages/Deliveries";
import AdminPanel from "./pages/AdminPanel";
import SmtpSettings from "./pages/SmtpSettings";
import AuditLog from "./pages/AuditLog";
import ApiTokens from "./pages/ApiTokens";
import DataRetention from "./pages/DataRetention";
import Sessions from "./pages/Sessions";
import OnboardingWizard from "./pages/OnboardingWizard";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-canvas"><Spinner className="h-6 w-6" /></div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-canvas"><Spinner className="h-6 w-6" /></div>;
  }
  if (!user || !user.is_superuser) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/onboarding" element={<Protected><OnboardingWizard /></Protected>} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="/workspaces" element={<Workspaces />} />
        <Route path="/workspaces/:wsId" element={<WorkspaceDetail />} />
        <Route path="/workspaces/:wsId/workflows/:wfId" element={<WorkflowDetail />} />
        <Route path="/workspaces/:wsId/workflows/:wfId/runs/:runId" element={<RunDetail />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/deliveries" element={<Deliveries />} />
        <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
        <Route path="/admin/settings/smtp" element={<AdminRoute><SmtpSettings /></AdminRoute>} />
        <Route path="/admin/settings/retention" element={<AdminRoute><DataRetention /></AdminRoute>} />
        <Route path="/admin/activity" element={<AdminRoute><AuditLog /></AdminRoute>} />
        <Route path="/settings/sessions" element={<Sessions />} />
        <Route path="/settings/api-tokens" element={<ApiTokens />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

