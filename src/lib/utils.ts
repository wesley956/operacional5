// ============================================================
// OPERACIONAL5 — Permissões, Validação, Audit e Utilitários
// ============================================================

import type { Role, AlertType, Severity, OperationalStatus } from './types';

// --- Permissões por Cargo ---

export const ROLE_HIERARCHY: Role[] = [
  'operador', 'lider', 'supervisor', 'gerente', 'diretor', 'admin'
];

export function getRoleLevel(role: Role): number {
  return ROLE_HIERARCHY.indexOf(role);
}

export function hasMinimumRole(userRole: Role, requiredRole: Role): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(requiredRole);
}

export interface PermissionSet {
  canViewAllPosts: boolean;
  canViewAssignedPosts: boolean;
  canManagePosts: boolean;
  canViewAllEmployees: boolean;
  canManageEmployees: boolean;
  canViewAllPresences: boolean;
  canConfirmPresence: boolean;
  canViewAllOccurrences: boolean;
  canCreateOccurrence: boolean;
  canResolveOccurrence: boolean;
  canTriggerSOS: boolean;
  canCloseSOS: boolean;
  canManageFT: boolean;
  canViewFT: boolean;
  canManageSchedules: boolean;
  canViewAudit: boolean;
  canManageSettings: boolean;
  canAccessAdmin: boolean;
  canAckAlert: boolean;
}

export function getPermissions(role: Role): PermissionSet {
  switch (role) {
    case 'admin':
      return {
        canViewAllPosts: true, canViewAssignedPosts: true, canManagePosts: true,
        canViewAllEmployees: true, canManageEmployees: true,
        canViewAllPresences: true, canConfirmPresence: false,
        canViewAllOccurrences: true, canCreateOccurrence: false, canResolveOccurrence: true,
        canTriggerSOS: false, canCloseSOS: true,
        canManageFT: true, canViewFT: true,
        canManageSchedules: true, canViewAudit: true,
        canManageSettings: true, canAccessAdmin: true, canAckAlert: true,
      };
    case 'diretor':
      return {
        canViewAllPosts: true, canViewAssignedPosts: true, canManagePosts: false,
        canViewAllEmployees: true, canManageEmployees: false,
        canViewAllPresences: true, canConfirmPresence: false,
        canViewAllOccurrences: true, canCreateOccurrence: false, canResolveOccurrence: true,
        canTriggerSOS: false, canCloseSOS: true,
        canManageFT: true, canViewFT: true,
        canManageSchedules: false, canViewAudit: true,
        canManageSettings: false, canAccessAdmin: false, canAckAlert: true,
      };
    case 'gerente':
      return {
        canViewAllPosts: true, canViewAssignedPosts: true, canManagePosts: true,
        canViewAllEmployees: true, canManageEmployees: true,
        canViewAllPresences: true, canConfirmPresence: false,
        canViewAllOccurrences: true, canCreateOccurrence: false, canResolveOccurrence: true,
        canTriggerSOS: false, canCloseSOS: true,
        canManageFT: true, canViewFT: true,
        canManageSchedules: true, canViewAudit: true,
        canManageSettings: true, canAccessAdmin: false, canAckAlert: true,
      };
    case 'supervisor':
      return {
        canViewAllPosts: false, canViewAssignedPosts: true, canManagePosts: false,
        canViewAllEmployees: false, canManageEmployees: false,
        canViewAllPresences: true, canConfirmPresence: false,
        canViewAllOccurrences: true, canCreateOccurrence: false, canResolveOccurrence: true,
        canTriggerSOS: false, canCloseSOS: true,
        canManageFT: true, canViewFT: true,
        canManageSchedules: false, canViewAudit: false,
        canManageSettings: false, canAccessAdmin: false, canAckAlert: true,
      };
    case 'lider':
      return {
        canViewAllPosts: false, canViewAssignedPosts: true, canManagePosts: false,
        canViewAllEmployees: false, canManageEmployees: false,
        canViewAllPresences: true, canConfirmPresence: false,
        canViewAllOccurrences: true, canCreateOccurrence: true, canResolveOccurrence: false,
        canTriggerSOS: false, canCloseSOS: false,
        canManageFT: false, canViewFT: true,
        canManageSchedules: false, canViewAudit: false,
        canManageSettings: false, canAccessAdmin: false, canAckAlert: false,
      };
    case 'operador':
      return {
        canViewAllPosts: false, canViewAssignedPosts: false, canManagePosts: false,
        canViewAllEmployees: false, canManageEmployees: false,
        canViewAllPresences: false, canConfirmPresence: true,
        canViewAllOccurrences: false, canCreateOccurrence: true, canResolveOccurrence: false,
        canTriggerSOS: true, canCloseSOS: false,
        canManageFT: false, canViewFT: false,
        canManageSchedules: false, canViewAudit: false,
        canManageSettings: false, canAccessAdmin: false, canAckAlert: false,
      };
  }
}

// --- Funções Auxiliares de Permissão ---

export function canAccessPost(role: Role, postAssignedRoles: Role[]): boolean {
  if (hasMinimumRole(role, 'gerente')) return true;
  return postAssignedRoles.includes(role);
}

export function canCloseSOS(role: Role): boolean {
  return hasMinimumRole(role, 'supervisor');
}

export function canAckOccurrence(role: Role): boolean {
  return hasMinimumRole(role, 'supervisor');
}

// --- Validações ---

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhone(phone: string): boolean {
  return /^\+?\d{10,15}$/.test(phone.replace(/\D/g, ''));
}

export function validateCNPJ(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  return true; // Simplificado para MVP
}

export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// --- Audit ---

export interface AuditEntry {
  company_id: string;
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string;
  metadata?: Record<string, unknown>;
}

export function createAuditEntry(
  companyId: string,
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  metadata?: Record<string, unknown>
): AuditEntry {
  return {
    company_id: companyId,
    actor_id: actorId,
    action,
    entity,
    entity_id: entityId,
    metadata,
  };
}

// --- Notification Service (Preparado) ---

export interface NotificationPayload {
  type: AlertType;
  title: string;
  body: string;
  severity: Severity;
  targetUserId: string;
  postId?: string;
  occurrenceId?: string;
}

export async function sendSystemAlert(payload: NotificationPayload): Promise<{ success: boolean; channel: string }> {
  // MVP: Apenas alerta no sistema (alert_log)
  // Fase 2: FCM push notification
  // Fase 3: SMS fallback via Twilio/Vonage
  console.log('[NOTIFICATION]', payload);
  return { success: true, channel: 'system' };
}

// --- Formatação ---

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

export function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  });
}

export function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `${diffMins}min atrás`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h atrás`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d atrás`;
}

// --- Status Helpers ---

export function getStatusColor(status: OperationalStatus): string {
  const colors: Record<OperationalStatus, string> = {
    coberto: 'bg-green-500 text-white',
    parcialmente_coberto: 'bg-blue-500 text-white',
    atencao: 'bg-yellow-500 text-black',
    descoberto: 'bg-gray-400 text-white',
    critico: 'bg-red-500 text-white',
    sos_ativo: 'bg-red-700 text-white animate-pulse',
  };
  return colors[status] || 'bg-gray-300 text-gray-700';
}

export function getStatusDot(status: OperationalStatus): string {
  const colors: Record<OperationalStatus, string> = {
    coberto: 'bg-green-500',
    parcialmente_coberto: 'bg-blue-500',
    atencao: 'bg-yellow-500',
    descoberto: 'bg-gray-400',
    critico: 'bg-red-500',
    sos_ativo: 'bg-red-700',
  };
  return colors[status] || 'bg-gray-300';
}

export function getSeverityColor(severity: Severity): string {
  const colors: Record<Severity, string> = {
    baixa: 'bg-blue-100 text-blue-800 border-blue-200',
    media: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    alta: 'bg-orange-100 text-orange-800 border-orange-200',
    critica: 'bg-red-100 text-red-800 border-red-200',
  };
  return colors[severity];
}

// --- cn utility ---
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
