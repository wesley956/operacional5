// ============================================================
// OPERACIONAL5 — App Principal (Produto Final)
// ============================================================

import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppLayout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { MapPage } from '@/pages/MapPage';
import { PostsPage } from '@/pages/PostsPage';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { PresencePage } from '@/pages/PresencePage';
import { OccurrencesPage } from '@/pages/OccurrencesPage';
import { FTPage } from '@/pages/FTPage';
import { RondasPage } from '@/pages/RondasPage';
import { HandoverPage } from '@/pages/HandoverPage';
import { SchedulesPage } from '@/pages/SchedulesPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { ClientPortalPage } from '@/pages/ClientPortalPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AdminPage } from '@/pages/AdminPage';

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AppLayout currentPath={location.pathname} onNavigate={navigate}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/posts" element={<PostsPage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/presence" element={<PresencePage />} />
        <Route path="/occurrences" element={<OccurrencesPage />} />
        <Route path="/ft" element={<FTPage />} />
        <Route path="/rondas" element={<RondasPage />} />
        <Route path="/handovers" element={<HandoverPage />} />
        <Route path="/schedules" element={<SchedulesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/client-portal" element={<ClientPortalPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<DashboardPage />} />
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  );
}
