// ============================================================
// OPERACIONAL5 — Layout do SuperAdmin da Plataforma
// ============================================================

import { useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  Building2,
  CalendarClock,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  X,
  ChevronRight,
} from 'lucide-react';

interface SuperAdminNavItem {
  path: string;
  label: string;
  icon: ReactNode;
}

const SUPER_ADMIN_NAV: SuperAdminNavItem[] = [
  { path: '/super-admin', label: 'Dashboard Global', icon: <LayoutDashboard className="w-5 h-5" /> },
  { path: '/super-admin/companies', label: 'Empresas', icon: <Building2 className="w-5 h-5" /> },
  { path: '/super-admin/trials', label: 'Trials', icon: <CalendarClock className="w-5 h-5" /> },
];

function SuperAdminSidebar({ open, onClose, currentPath, onNavigate }: {
  open: boolean;
  onClose: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  const { platformAdmin } = useAuth();

  const sidebar = (
    <div className="flex flex-col h-full bg-slate-950 text-white">
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">OP5</h2>
              <p className="text-xs text-slate-400">SuperAdmin</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 hover:bg-slate-800 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {SUPER_ADMIN_NAV.map(item => {
            const active = currentPath === item.path || (item.path !== '/super-admin' && currentPath.startsWith(item.path));
            return (
              <li key={item.path}>
                <button
                  onClick={() => onNavigate(item.path)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
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

      <div className="p-4 border-t border-slate-800">
        <p className="text-sm font-medium truncate">{platformAdmin?.name ?? 'SuperAdmin'}</p>
        <p className="text-xs text-slate-400 truncate">{platformAdmin?.email}</p>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-30">
        {sidebar}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={onClose} />
          <aside className="fixed inset-y-0 left-0 w-72 z-50">
            {sidebar}
          </aside>
        </div>
      )}
    </>
  );
}

function SuperAdminHeader({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { platformAdmin, logout } = useAuth();

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onMenuToggle} className="lg:hidden p-1 hover:bg-gray-100 rounded-lg">
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <p className="text-sm text-gray-500">Área da plataforma</p>
            <h1 className="text-lg font-semibold text-gray-900">Painel SuperAdmin</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-gray-900 leading-tight">{platformAdmin?.name ?? 'SuperAdmin'}</p>
            <p className="text-xs text-gray-500">Administrador da plataforma</p>
          </div>
          <button
            onClick={logout}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function SuperAdminLayout({ children, currentPath, onNavigate }: {
  children: ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <SuperAdminSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentPath={currentPath}
        onNavigate={(path) => {
          onNavigate(path);
          setSidebarOpen(false);
        }}
      />
      <div className="lg:pl-64">
        <SuperAdminHeader onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="p-4 sm:p-6 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
