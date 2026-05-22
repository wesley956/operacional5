// ============================================================
// OPERACIONAL5 — Layout Principal (Sidebar + Header + Router)
// ============================================================

import { useState, type ReactNode } from 'react';
import { useAuth, useProfile } from '@/context/AuthContext';
import { getPermissions, type PermissionSet } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Building2, Users, MapPin, FileWarning,
  Siren, CalendarDays, Settings, Shield, Menu, X, LogOut,
  Bell, ChevronRight, User,
} from 'lucide-react';
import { useNotifications, useRealtimeDashboard } from '@/hooks';
import { ROLE_LABELS } from '@/lib/types';

// --- Navigation Items ---
interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
  permission?: (p: PermissionSet) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { path: '/map', label: 'Mapa', icon: <MapPin className="w-5 h-5" /> },
  { path: '/posts', label: 'Postos', icon: <Building2 className="w-5 h-5" />, permission: p => p.canViewAllPosts || p.canViewAssignedPosts },
  { path: '/employees', label: 'Funcionários', icon: <Users className="w-5 h-5" />, permission: p => p.canViewAllEmployees },
  { path: '/presence', label: 'Presença', icon: <MapPin className="w-5 h-5" />, permission: p => p.canViewAllPresences || p.canConfirmPresence },
  { path: '/occurrences', label: 'Ocorrências', icon: <FileWarning className="w-5 h-5" />, permission: p => p.canViewAllOccurrences || p.canCreateOccurrence },
  { path: '/ft', label: 'Força Tarefa', icon: <Siren className="w-5 h-5" />, permission: p => p.canViewFT || p.canManageFT },
  { path: '/rondas', label: 'Rondas', icon: <MapPin className="w-5 h-5" /> },
  { path: '/handovers', label: 'Passagens', icon: <CalendarDays className="w-5 h-5" /> },
  { path: '/schedules', label: 'Escalas', icon: <CalendarDays className="w-5 h-5" />, permission: p => p.canManageSchedules },
  { path: '/reports', label: 'Relatórios', icon: <FileWarning className="w-5 h-5" />, permission: p => p.canViewAudit },
  { path: '/notifications', label: 'Notificações', icon: <Bell className="w-5 h-5" /> },
  { path: '/client-portal', label: 'Portal Cliente', icon: <User className="w-5 h-5" /> },
  { path: '/settings', label: 'Configurações', icon: <Settings className="w-5 h-5" />, permission: p => p.canManageSettings },
  { path: '/admin', label: 'Administração', icon: <Shield className="w-5 h-5" />, permission: p => p.canAccessAdmin },
];

// --- Sidebar ---
function Sidebar({ open, onClose, currentPath, onNavigate }: {
  open: boolean;
  onClose: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  const profile = useProfile();
  const permissions = getPermissions(profile.role);

  const visibleItems = NAV_ITEMS.filter(
    item => !item.permission || item.permission(permissions)
  );

  const sidebar = (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Logo */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight">OP5</h2>
            <p className="text-xs text-gray-400">OPERACIONAL5</p>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 hover:bg-gray-800 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {visibleItems.map(item => {
            const active = currentPath === item.path;
            return (
              <li key={item.path}>
                <button
                  onClick={() => onNavigate(item.path)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  {item.icon}
                  {item.label}
                  {active && <ChevronRight className="w-4 h-4 ml-auto" />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
            {profile.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile.name}</p>
            <p className="text-xs text-gray-400">{ROLE_LABELS[profile.role]}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 z-30">
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={onClose} />
          <aside className="fixed inset-y-0 left-0 w-64 z-50">
            {sidebar}
          </aside>
        </div>
      )}
    </>
  );
}

// --- Header ---
function Header({ onMenuToggle }: { onMenuToggle: () => void }) {
  const profile = useProfile();
  const { logout } = useAuth();

  const { unreadCount } = useNotifications();
  const { postStatuses } = useRealtimeDashboard();

  const unreadAlerts = unreadCount;
  const sosActive = postStatuses.some(p => p.status === 'sos_ativo');

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onMenuToggle} className="lg:hidden p-1 hover:bg-gray-100 rounded-lg">
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <div className="lg:hidden">
            <span className="text-lg font-bold text-gray-900">OP5</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* SOS Active Indicator */}
          {sosActive && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold animate-pulse">
              <Siren className="w-3.5 h-3.5" />
              SOS ATIVO
            </div>
          )}

          {/* Alerts */}
          <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-gray-600" />
            {unreadAlerts > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadAlerts}
              </span>
            )}
          </button>

          {/* User Menu */}
          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-gray-200">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
              {profile.name.charAt(0)}
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900 leading-tight">{profile.name}</p>
              <p className="text-xs text-gray-500">{ROLE_LABELS[profile.role]}</p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

// --- AppLayout ---
export function AppLayout({ children, currentPath, onNavigate }: {
  children: ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentPath={currentPath}
        onNavigate={(path) => {
          onNavigate(path);
          setSidebarOpen(false);
        }}
      />
      <div className="lg:pl-60">
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="p-4 sm:p-6 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

// --- ProtectedRoute ---
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return <>{children}</>;
}

// --- RoleGuard ---
export function RoleGuard({ roles, children, fallback }: {
  roles: string[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const profile = useProfile();
  if (!roles.includes(profile.role)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}

// --- Avatar ---
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' };
  const colors = ['bg-blue-600', 'bg-green-600', 'bg-purple-600', 'bg-orange-600', 'bg-pink-600', 'bg-teal-600'];
  const colorIndex = name.charCodeAt(0) % colors.length;

  return (
    <div className={cn('rounded-full flex items-center justify-center text-white font-bold', sizes[size], colors[colorIndex])}>
      {name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
    </div>
  );
}

// Re-export User from lucide for convenience
export { User };
