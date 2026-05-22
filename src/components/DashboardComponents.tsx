// ============================================================
// OPERACIONAL5 — Componentes do Dashboard
// ============================================================

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card, Badge } from '@/components/ui';
import {
  Shield, ShieldAlert, ShieldOff, Siren, FileWarning,
  TrendingUp, Clock, MapPin, Users, AlertTriangle, Eye,
  CheckCircle, XCircle,
} from 'lucide-react';
import type { OperationalStatus, Severity } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';

// --- Dashboard Stat Card ---
interface StatCardProps {
  title: string;
  value: number;
  icon: ReactNode;
  color: string;
  subtitle?: string;
  pulse?: boolean;
}

export function StatCard({ title, value, icon, color, subtitle, pulse }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className={cn('text-3xl font-bold mt-1', color)}>
            {value}
          </p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={cn('p-3 rounded-xl', color.replace('text-', 'bg-').replace('700', '100').replace('600', '50'), 'bg-opacity-50')}>
          <div className={cn(color.replace('text-', 'text-'))}>
            {icon}
          </div>
        </div>
      </div>
      {pulse && (
        <div className="absolute top-3 right-3">
          <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
        </div>
      )}
    </Card>
  );
}

// --- Operational Status Badge ---
export function OperationalStatusBadge({ status }: { status: OperationalStatus }) {
  const config: Record<OperationalStatus, { bg: string; text: string; icon: ReactNode }> = {
    coberto: { bg: 'bg-green-100 border-green-300', text: 'text-green-800', icon: <Shield className="w-3.5 h-3.5" /> },
    parcialmente_coberto: { bg: 'bg-blue-100 border-blue-300', text: 'text-blue-800', icon: <Users className="w-3.5 h-3.5" /> },
    atencao: { bg: 'bg-yellow-100 border-yellow-300', text: 'text-yellow-800', icon: <Clock className="w-3.5 h-3.5" /> },
    descoberto: { bg: 'bg-gray-100 border-gray-300', text: 'text-gray-700', icon: <ShieldOff className="w-3.5 h-3.5" /> },
    critico: { bg: 'bg-red-100 border-red-300', text: 'text-red-800', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
    sos_ativo: { bg: 'bg-red-200 border-red-400', text: 'text-red-900', icon: <Siren className="w-3.5 h-3.5" /> },
  };

  const c = config[status];

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border', c.bg, c.text)}>
      {c.icon}
      {STATUS_LABELS[status]}
      {status === 'sos_ativo' && <span className="ml-1 w-2 h-2 bg-red-600 rounded-full animate-pulse" />}
    </span>
  );
}

// --- Severity Badge ---
export function SeverityBadge({ severity }: { severity: Severity }) {
  const config: Record<Severity, { bg: string; text: string }> = {
    baixa: { bg: 'bg-blue-100', text: 'text-blue-800' },
    media: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    alta: { bg: 'bg-orange-100', text: 'text-orange-800' },
    critica: { bg: 'bg-red-100', text: 'text-red-800' },
  };
  const c = config[severity];
  const labels: Record<Severity, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold', c.bg, c.text)}>
      {labels[severity]}
    </span>
  );
}

// --- Post Status Card ---
interface PostStatusCardProps {
  postName: string;
  clientName: string;
  status: OperationalStatus;
  confirmedCount: number;
  minStaff: number;
  employeesPresent: string[];
  employeesMissing: string[];
  activeSos: number;
  lastOccurrence?: string;
  onViewDetails?: () => void;
}

export function PostStatusCard({
  postName, clientName, status, confirmedCount, minStaff,
  employeesPresent, employeesMissing, activeSos, lastOccurrence, onViewDetails
}: PostStatusCardProps) {
  const isCritical = status === 'critico' || status === 'sos_ativo';

  return (
    <Card className={cn('transition-all', isCritical && 'border-red-200 ring-1 ring-red-200')}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <h3 className="font-semibold text-gray-900 truncate">{postName}</h3>
          </div>
          <p className="text-xs text-gray-500 mb-2">{clientName}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <OperationalStatusBadge status={status} />
            <span className="text-xs text-gray-500">
              {confirmedCount}/{minStaff} vigilantes
            </span>
          </div>
        </div>

        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Eye className="w-4 h-4" />
            Detalhes
          </button>
        )}
      </div>

      {/* Employees */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        {employeesPresent.length > 0 && (
          <div className="mb-2">
            <p className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Presentes:
            </p>
            <div className="flex flex-wrap gap-1">
              {employeesPresent.map((name, i) => (
                <Badge key={i} variant="success">{name}</Badge>
              ))}
            </div>
          </div>
        )}
        {employeesMissing.length > 0 && (
          <div>
            <p className="text-xs font-medium text-red-700 mb-1 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> Ausentes:
            </p>
            <div className="flex flex-wrap gap-1">
              {employeesMissing.map((name, i) => (
                <Badge key={i} variant="danger">{name}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer info */}
      {(activeSos > 0 || lastOccurrence) && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
          {activeSos > 0 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-700 animate-pulse">
              <Siren className="w-3.5 h-3.5" /> {activeSos} SOS ATIVO
            </span>
          )}
          {lastOccurrence && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <FileWarning className="w-3.5 h-3.5" /> Últ. ocorrência: {lastOccurrence}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

// --- Alert Card ---
interface AlertCardProps {
  type: string;
  message: string;
  time: string;
  postName?: string;
  isCritical?: boolean;
  onAck?: () => void;
  onView?: () => void;
  onAction?: () => void;
  actionLabel?: string;
}

export function AlertCard({ type, message, time, postName, isCritical, onAck, onView, onAction, actionLabel }: AlertCardProps) {
  const iconMap: Record<string, ReactNode> = {
    sos: <Siren className="w-5 h-5 text-red-600" />,
    ausencia: <ShieldOff className="w-5 h-5 text-orange-600" />,
    atraso: <Clock className="w-5 h-5 text-yellow-600" />,
    ft_aberta: <Siren className="w-5 h-5 text-blue-600" />,
    ocorrencia_critica: <FileWarning className="w-5 h-5 text-red-600" />,
    mock_location: <AlertTriangle className="w-5 h-5 text-purple-600" />,
  };

  return (
    <div className={cn(
      'p-3 sm:p-4 rounded-lg border transition-all',
      isCritical ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {iconMap[type] || <AlertTriangle className="w-5 h-5 text-gray-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-gray-900">{type.toUpperCase()}</span>
            {isCritical && (
              <Badge variant="danger" pulse>URGENTE</Badge>
            )}
          </div>
          <p className="text-sm text-gray-600">{message}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
            <span>{time}</span>
            {postName && <span>• {postName}</span>}
          </div>
          <div className="flex items-center gap-2 mt-2">
            {onAck && (
              <button onClick={onAck} className="text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 px-2.5 py-1 rounded-lg transition-colors">
                ✓ Ciência
              </button>
            )}
            {onView && (
              <button onClick={onView} className="text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-lg transition-colors">
                Ver
              </button>
            )}
            {onAction && (
              <button onClick={onAction} className="text-xs font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 px-2.5 py-1 rounded-lg transition-colors">
                {actionLabel || 'Agir'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Quick Action Button ---
interface QuickActionProps {
  icon: ReactNode;
  label: string;
  color?: string;
  onClick?: () => void;
}

export function QuickAction({ icon, label, color = 'text-gray-600 bg-gray-100 hover:bg-gray-200', onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors', color)}
    >
      {icon}
      {label}
    </button>
  );
}

// --- Dashboard Stats Icons ---
export const DASHBOARD_ICONS = {
  cobertos: <Shield className="w-6 h-6" />,
  atencao: <Clock className="w-6 h-6" />,
  criticos: <ShieldAlert className="w-6 h-6" />,
  descobertos: <ShieldOff className="w-6 h-6" />,
  sos: <Siren className="w-6 h-6" />,
  ft: <TrendingUp className="w-6 h-6" />,
  ocorrencias: <FileWarning className="w-6 h-6" />,
};
