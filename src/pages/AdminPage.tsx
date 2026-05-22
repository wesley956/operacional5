// ============================================================
// OPERACIONAL5 — Página de Administração
// ============================================================

import { useState } from 'react';
import { PageHeader, Card, Badge, DataTable, Button } from '@/components/ui';
import { DEMO_PROFILES, DEMO_COMPANY } from '@/lib/mockData';
import { formatDateTime } from '@/lib/utils';
import { ROLE_LABELS } from '@/lib/types';
import { Shield, Users, Database, Activity, AlertTriangle, Key, Eye } from 'lucide-react';

const MOCK_AUDIT = [
  { id: 'aud-001', actor: 'Carlos Mendes', action: 'login', entity: 'auth', entity_id: 'user-gerente', time: new Date(Date.now() - 3600000).toISOString() },
  { id: 'aud-002', actor: 'Marcos Oliveira', action: 'checkin_approve', entity: 'presence', entity_id: 'pres-002', time: new Date(Date.now() - 7200000).toISOString() },
  { id: 'aud-003', actor: 'Sistema', action: 'sos_trigger', entity: 'occurrence', entity_id: 'occ-002', time: new Date(Date.now() - 600000).toISOString() },
  { id: 'aud-004', actor: 'Sistema', action: 'mock_location_detected', entity: 'presence', entity_id: 'pres-xxx', time: new Date(Date.now() - 86400000).toISOString() },
  { id: 'aud-005', actor: 'Carlos Mendes', action: 'ft_open', entity: 'ft_request', entity_id: 'ft-001', time: new Date(Date.now() - 2100000).toISOString() },
];

export function AdminPage() {
  const [showAuditDetail, setShowAuditDetail] = useState(false);

  const systemStats = {
    totalUsers: DEMO_PROFILES.length,
    activeUsers: DEMO_PROFILES.filter(p => p.active).length,
    company: DEMO_COMPANY.name,
    version: '1.0.0-mvp1',
  };

  const columns = [
    {
      key: 'time',
      header: 'Data/Hora',
      render: (_: typeof MOCK_AUDIT[0]) => (
        <span className="text-sm text-gray-600">{formatDateTime(_.time)}</span>
      ),
    },
    {
      key: 'actor',
      header: 'Ator',
      render: (_: typeof MOCK_AUDIT[0]) => (
        <span className="text-sm font-medium text-gray-900">{_.actor}</span>
      ),
    },
    {
      key: 'action',
      header: 'Ação',
      render: (_: typeof MOCK_AUDIT[0]) => (
        <Badge variant={_.action.includes('sos') || _.action.includes('mock') ? 'danger' : 'default'}>
          {_.action}
        </Badge>
      ),
    },
    {
      key: 'entity',
      header: 'Entidade',
      render: (_: typeof MOCK_AUDIT[0]) => (
        <span className="text-sm text-gray-600">{_.entity}:{_.entity_id}</span>
      ),
    },
    {
      key: 'view',
      header: '',
      render: () => (
        <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600">
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
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">Nome</p>
            <p className="text-sm font-medium text-gray-900">{systemStats.company}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">CNPJ</p>
            <p className="text-sm font-medium text-gray-900">{DEMO_COMPANY.cnpj}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Status</p>
            <Badge variant="success">Ativa</Badge>
          </div>
          <div>
            <p className="text-xs text-gray-500">Criada em</p>
            <p className="text-sm font-medium text-gray-900">{formatDateTime(DEMO_COMPANY.created_at)}</p>
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
          {DEMO_PROFILES.map(p => (
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Log de Auditoria</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowAuditDetail(!showAuditDetail)}>
              {showAuditDetail ? 'Resumo' : 'Ver tudo'}
            </Button>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={showAuditDetail ? MOCK_AUDIT : MOCK_AUDIT.slice(0, 5)}
          keyExtractor={a => a.id}
          emptyMessage="Nenhum log de auditoria"
        />
      </Card>

      {/* Security Warning */}
      <div className="mt-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-yellow-800">Área Administrativa</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              Todas as ações nesta área são auditadas. Em produção, o acesso admin requer autenticação
              de dois fatores e é restrito a administradores autorizados da empresa.
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
