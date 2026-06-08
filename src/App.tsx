// ============================================================
// OPERACIONAL5 — App Principal (Produto Final)
// ============================================================

import { lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppLayout } from '@/components/Layout';
import { SuperAdminLayout } from '@/components/SuperAdminLayout';
import { TrialStatusBanner } from '@/components/TrialStatusBanner';
import { getPermissions, type PermissionSet } from '@/lib/utils';
import { LoginPage } from '@/pages/LoginPage';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { SubscriptionBlockedPage } from '@/pages/SubscriptionBlockedPage';


const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const MapPage = lazy(() => import('@/pages/MapPage').then(m => ({ default: m.MapPage })));
const PostsPage = lazy(() => import('@/pages/PostsPage').then(m => ({ default: m.PostsPage })));
const ClientsPage = lazy(() => import('@/pages/ClientsPage').then(m => ({ default: m.ClientsPage })));
const EmployeesPage = lazy(() => import('@/pages/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const PresencePage = lazy(() => import('@/pages/PresencePage').then(m => ({ default: m.PresencePage })));
const OccurrencesPage = lazy(() => import('@/pages/OccurrencesPage').then(m => ({ default: m.OccurrencesPage })));
const FTPage = lazy(() => import('@/pages/FTPage').then(m => ({ default: m.FTPage })));
const RondasPage = lazy(() => import('@/pages/RondasPage').then(m => ({ default: m.RondasPage })));
const HandoverPage = lazy(() => import('@/pages/HandoverPage').then(m => ({ default: m.HandoverPage })));
const SchedulesPage = lazy(() => import('@/pages/SchedulesPage').then(m => ({ default: m.SchedulesPage })));
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const ClientPortalPage = lazy(() => import('@/pages/ClientPortalPage').then(m => ({ default: m.ClientPortalPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const AdminPage = lazy(() => import('@/pages/AdminPage').then(m => ({ default: m.AdminPage })));
const AlertsCenterPage = lazy(() => import('@/pages/AlertsCenterPage'));

const SuperAdminDashboardPage = lazy(() => import('@/pages/super-admin/SuperAdminDashboardPage').then(m => ({ default: m.SuperAdminDashboardPage })));
const SuperAdminCompaniesPage = lazy(() => import('@/pages/super-admin/SuperAdminCompaniesPage').then(m => ({ default: m.SuperAdminCompaniesPage })));
const SuperAdminCompanyDetailPage = lazy(() => import('@/pages/super-admin/SuperAdminCompanyDetailPage').then(m => ({ default: m.SuperAdminCompanyDetailPage })));
const SuperAdminNewCompanyPage = lazy(() => import('@/pages/super-admin/SuperAdminNewCompanyPage').then(m => ({ default: m.SuperAdminNewCompanyPage })));
const SuperAdminTrialsPage = lazy(() => import('@/pages/super-admin/SuperAdminTrialsPage').then(m => ({ default: m.SuperAdminTrialsPage })));

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
  children: ReactNode;
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
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<TenantGuard><DashboardPage /></TenantGuard>} />
        <Route path="/dashboard" element={<TenantGuard><DashboardPage /></TenantGuard>} />
        <Route path="/map" element={<TenantGuard><MapPage /></TenantGuard>} />
        <Route path="/posts" element={<TenantGuard permission={p => p.canViewAllPosts || p.canViewAssignedPosts}><PostsPage /></TenantGuard>} />
        <Route path="/clients" element={<TenantGuard permission={p => p.canViewAllPosts}><ClientsPage /></TenantGuard>} />
        <Route path="/employees" element={<TenantGuard permission={p => p.canViewAllEmployees}><EmployeesPage /></TenantGuard>} />
        <Route path="/presence" element={<TenantGuard permission={p => p.canViewAllPresences || p.canConfirmPresence}><PresencePage /></TenantGuard>} />
        <Route path="/occurrences" element={<TenantGuard permission={p => p.canViewAllOccurrences || p.canCreateOccurrence}><OccurrencesPage /></TenantGuard>} />
        <Route path="/ft" element={<TenantGuard permission={p => p.canViewFT || p.canManageFT}><FTPage /></TenantGuard>} />
        <Route path="/rondas" element={<TenantGuard><RondasPage /></TenantGuard>} />
        <Route path="/handovers" element={<TenantGuard><HandoverPage /></TenantGuard>} />
        <Route path="/schedules" element={<TenantGuard permission={p => p.canManageSchedules}><SchedulesPage /></TenantGuard>} />
        <Route path="/reports" element={<TenantGuard permission={p => p.canViewAudit}><ReportsPage /></TenantGuard>} />
        <Route path="/notifications" element={<TenantGuard><NotificationsPage /></TenantGuard>} />
        <Route path="/client-portal" element={<TenantGuard permission={p => p.canAccessClientPortal}><ClientPortalPage /></TenantGuard>} />
        <Route path="/settings" element={<TenantGuard permission={p => p.canManageSettings}><SettingsPage /></TenantGuard>} />
        <Route path="/admin" element={<TenantGuard permission={p => p.canAccessAdmin}><AdminPage /></TenantGuard>} />
        <Route path="/alerts" element={<TenantGuard><AlertsCenterPage /></TenantGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
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
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/super-admin" element={<SuperAdminDashboardPage />} />
        <Route path="/super-admin/companies" element={<SuperAdminCompaniesPage />} />
        <Route path="/super-admin/trials" element={<SuperAdminTrialsPage />} />
        <Route path="/super-admin/companies/new" element={<SuperAdminNewCompanyPage />} />
        <Route path="/super-admin/companies/:id" element={<SuperAdminCompanyDetailPage />} />
        <Route path="*" element={<Navigate to="/super-admin" replace />} />
      </Routes>
    </Suspense>
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
  const { isAuthenticated, isLoading, isPlatformAdmin, profile } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (profile?.role === 'client_viewer' && !location.pathname.startsWith('/client-portal')) {
    return <Navigate to="/client-portal" replace />;
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
