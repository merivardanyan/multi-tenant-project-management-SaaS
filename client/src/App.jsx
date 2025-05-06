import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import useAuthStore from './stores/authStore';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProjectBoardPage from './pages/ProjectBoardPage';
import WorkspaceSettingsPage from './pages/WorkspaceSettingsPage';
import ProfilePage from './pages/ProfilePage';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

function ProtectedLayout() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/workspaces/:workspaceId/projects/:projectId" element={<ProjectBoardPage />} />
          <Route path="/workspaces/:workspaceId/settings" element={<WorkspaceSettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
