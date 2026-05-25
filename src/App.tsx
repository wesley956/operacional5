// ============================================================
// OPERACIONAL5 — App Principal (Produto Final)
// ============================================================

import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppLayout } from '@/components/Layout';
import { SuperAdminLayout } from '@/components/SuperAdminLayout';
import { TrialStatusBanner } from '@/components/TrialStatusBanner';
import { getPermissions, type PermissionSet } from '@/lib/utils';
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
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { SubscriptionBlockedPage } from '@/pages/SubscriptionBlockedPage';
import { SuperAdminDashboardPage } from '@/pages/super-admin/SuperAdminDashboardPage';
import { SuperAdminCompaniesPage } from '@/pages/super-admin/SuperAdminCompaniesPage';
import { SuperAdminCompanyDetailPage } from '@/pages/super-admin/SuperAdminCompanyDetailPage';
import { SuperAdminNewCompanyPage } from '@/pages/super-admin/SuperAdminNewCompanyPage';
import { SuperAdminTrialsPage } from '@/pages/super-admin/SuperAdminTrialsPage';
import AlertsCenterPage from './pages/AlertsCenterPage';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-gray-500">Carregando...</p>
      </div>
    </div>
  );
}

function TenantGuard({ children, permission }: {
  children: React.ReactNode;
  permission?: (permissions: PermissionSet) => boolean;
}) {
  const { profile, isPlatformAdmin, accessBlocked } = useAuth();

  if (isPlatformAdmin) {
    return <Navigate to="/super-admin" replace />;
  }

  if (!profile) {
    return <ForbiddenPage message="Seu usuário não está vinculado a uma empresa ativa." />;
  }

  if (accessBlocked) {
    return <SubscriptionBlockedPage />;
  }

  if (permission && !permission(getPermissions(profile.role))) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}

function TenantRoutes() {
  return (
    <Routes>
      <Route path="/" element={<TenantGuard><DashboardPage /></TenantGuard>} />
      <Route path="/map" element={<TenantGuard><MapPage /></TenantGuard>} />
      <Route path="/posts" element={<TenantGuard permission={p => p.canViewAllPosts || p.canViewAssignedPosts}><PostsPage /></TenantGuard>} />
      <Route path="/employees" element={<TenantGuard permission={p => p.canViewAllEmployees}><EmployeesPage /></TenantGuard>} />
      <Route path="/presence" element={<TenantGuard permission={p => p.canViewAllPresences || p.canConfirmPresence}><PresencePage /></TenantGuard>} />
      <Route path="/occurrences" element={<TenantGuard permission={p => p.canViewAllOccurrences || p.canCreateOccurrence}><OccurrencesPage /></TenantGuard>} />
      <Route path="/ft" element={<TenantGuard permission={p => p.canViewFT || p.canManageFT}><FTPage /></TenantGuard>} />
      <Route path="/rondas" element={<TenantGuard><RondasPage /></TenantGuard>} />
      <Route path="/handovers" element={<TenantGuard><HandoverPage /></TenantGuard>} />
      <Route path="/schedules" element={<TenantGuard permission={p => p.canManageSchedules}><SchedulesPage /></TenantGuard>} />
      <Route path="/reports" element={<TenantGuard permission={p => p.canViewAudit}><ReportsPage /></TenantGuard>} />
      <Route path="/notifications" element={<TenantGuard><NotificationsPage /></TenantGuard>} />
      <Route path="/client-portal" element={<TenantGuard><ClientPortalPage /></TenantGuard>} />
      <Route path="/settings" element={<TenantGuard permission={p => p.canManageSettings}><SettingsPage /></TenantGuard>} />
      <Route path="/admin" element={<TenantGuard permission={p => p.canAccessAdmin}><AdminPage /></TenantGuard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
            <Route path="/alerts" element={<AlertsCenterPage />} />
      </Routes>
  );
}

function TenantAppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <AppLayout currentPath={location.pathname} onNavigate={navigate}>
      <TrialStatusBanner />
      <TenantRoutes />
    </AppLayout>
  );
}

function SuperAdminRoutes() {
  const { isPlatformAdmin } = useAuth();

  if (!isPlatformAdmin) {
    return <ForbiddenPage title="Área restrita" message="Somente administradores da plataforma podem acessar o SuperAdmin." />;
  }

  return (
    <Routes>
      <Route path="/super-admin" element={<SuperAdminDashboardPage />} />
      <Route path="/super-admin/companies" element={<SuperAdminCompaniesPage />} />
      <Route path="/super-admin/trials" element={<SuperAdminTrialsPage />} />
      <Route path="/super-admin/companies/new" element={<SuperAdminNewCompanyPage />} />
      <Route path="/super-admin/companies/:id" element={<SuperAdminCompanyDetailPage />} />
      <Route path="*" element={<Navigate to="/super-admin" replace />} />
    </Routes>
  );
}

function SuperAdminShell() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <SuperAdminLayout currentPath={location.pathname} onNavigate={navigate}>
      <SuperAdminRoutes />
    </SuperAdminLayout>
  );
}

function AppRoutes() {
  const { isAuthenticated, isLoading, isPlatformAdmin } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (location.pathname.startsWith('/super-admin')) {
    return <SuperAdminShell />;
  }

  if (isPlatformAdmin) {
    return <Navigate to="/super-admin" replace />;
  }

  return <TenantAppShell />;
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
