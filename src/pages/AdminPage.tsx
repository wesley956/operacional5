// ============================================================
// OPERACIONAL5 — Página de Administração
// ============================================================

import { useMemo, useState } from 'react';
import { PageHeader, Card, Badge, DataTable, Button } from '@/components/ui';
import { useAuditLog, useEmployees } from '@/hooks';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { formatDateTime } from '@/lib/utils';
import { ROLE_LABELS } from '@/lib/types';
import type { AuditEntryData } from '@/lib/data/data-provider';
import { Shield, Users, Database, Activity, AlertTriangle, Key, Eye, RefreshCw } from 'lucide-react';

function getAuditVariant(action: string) {
  const normalized = action.toLowerCase();
  if (normalized.includes('sos') || normalized.includes('mock') || normalized.includes('delete') || normalized.includes('cancel')) {
    return 'danger' as const;
  }
  if (normalized.includes('update') || normalized.includes('resolve') || normalized.includes('approve')) {
    return 'warning' as const;
  }
  if (normalized.includes('create') || normalized.includes('login') || normalized.includes('open')) {
    return 'info' as const;
  }
  return 'default' as const;
}

export function AdminPage() {
  const [showAuditDetail, setShowAuditDetail] = useState(false);
  const { employees } = useEmployees();
  const { settings, isLoading: settingsLoading } = useCompanySettings();
  const { entries: auditEntries, loading: auditLoading, refresh: refreshAudit } = useAuditLog();

  const visibleAuditEntries = useMemo(
    () => showAuditDetail ? auditEntries : auditEntries.slice(0, 5),
    [auditEntries, showAuditDetail]
  );

  const companyName = settings?.companyName || 'Empresa não carregada';
  const companyDocument = settings?.cnpj || settings?.document || 'Não informado';
  const companyCreatedAt = settings?.companyId ? 'Cadastro real do tenant' : 'Não informado';

  const systemStats = {
    totalUsers: employees.length,
    activeUsers: employees.filter(p => p.active).length,
    company: companyName,
    version: '1.0.0-mvp1',
  };

  const columns = [
    {
      key: 'time',
      header: 'Data/Hora',
      render: (entry: AuditEntryData) => (
        <span className="text-sm text-gray-600">{formatDateTime(entry.created_at)}</span>
      ),
    },
    {
      key: 'actor',
      header: 'Ator',
      render: (entry: AuditEntryData) => (
        <span className="text-sm font-medium text-gray-900">{entry.actor_name || 'Sistema'}</span>
      ),
    },
    {
      key: 'action',
      header: 'Ação',
      render: (entry: AuditEntryData) => (
        <Badge variant={getAuditVariant(entry.action)}>
          {entry.action}
        </Badge>
      ),
    },
    {
      key: 'entity',
      header: 'Entidade',
      render: (entry: AuditEntryData) => (
        <span className="text-sm text-gray-600">{entry.entity}:{entry.entity_id}</span>
      ),
    },
    {
      key: 'view',
      header: '',
      render: () => (
        <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600" title="Detalhe disponível no registro de auditoria">
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Administração" subtitle="Painel administrativo do sistema" />

      {/* System Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{systemStats.totalUsers}</p>
              <p className="text-xs text-gray-500">Usuários</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{systemStats.activeUsers}</p>
              <p className="text-xs text-gray-500">Ativos</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Database className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">1</p>
              <p className="text-xs text-gray-500">Empresa</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Shield className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{systemStats.version}</p>
              <p className="text-xs text-gray-500">Versão</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Company Info */}
      <Card className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Building2Icon />
          <h3 className="font-semibold text-gray-900">Empresa</h3>
          {settingsLoading && <Badge variant="default">Carregando</Badge>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">Nome</p>
            <p className="text-sm font-medium text-gray-900">{systemStats.company}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">CNPJ / Documento</p>
            <p className="text-sm font-medium text-gray-900">{companyDocument}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Status</p>
            <Badge variant="success">Ativa</Badge>
          </div>
          <div>
            <p className="text-xs text-gray-500">Origem</p>
            <p className="text-sm font-medium text-gray-900">{companyCreatedAt}</p>
          </div>
        </div>
      </Card>

      {/* Users Management */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Usuários do Sistema</h3>
          </div>
        </div>
        <div className="space-y-2">
          {employees.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                  {p.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={p.role === 'admin' ? 'danger' : p.role === 'gerente' ? 'info' : 'default'}>
                  {ROLE_LABELS[p.role]}
                </Badge>
                <Badge variant={p.active ? 'success' : 'default'}>
                  {p.active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Audit Log */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-gray-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Log de Auditoria</h3>
                <p className="text-xs text-gray-500">Dados reais do repositório de auditoria do tenant</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => void refreshAudit()} disabled={auditLoading}>
                <RefreshCw className="w-4 h-4" />
                Atualizar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowAuditDetail(!showAuditDetail)}>
                {showAuditDetail ? 'Resumo' : 'Ver tudo'}
              </Button>
            </div>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={visibleAuditEntries}
          keyExtractor={a => a.id}
          emptyMessage={auditLoading ? 'Carregando log de auditoria...' : 'Nenhum log de auditoria real encontrado'}
        />
      </Card>

      {/* Security Warning */}
      <div className="mt-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">Área Administrativa</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              Todas as ações nesta área são auditadas. O painel não usa mais registros fictícios;
              se a tabela estiver vazia, a UI mostrará vazio em vez de inventar eventos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Building2Icon() {
  return (
    <div className="p-2 bg-gray-100 rounded-lg">
      <Database className="w-5 h-5 text-gray-600" />
    </div>
  );
}
