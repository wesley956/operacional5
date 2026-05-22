// ============================================================
// OPERACIONAL5 — Página de Força Tarefa (FT)
// ============================================================

import { useState } from 'react';
import { PageHeader, Card, Badge, DataTable, Modal, Button, SelectField } from '@/components/ui';
import { Avatar } from '@/components/Layout';
import { SeverityBadge } from '@/components/DashboardComponents';
import { useEmployees, useFT, usePosts } from '@/hooks';
import { formatDateTime, formatRelativeTime } from '@/lib/utils';
import { type FTRequest, type FTRequestStatus } from '@/lib/types';
import { Siren, Users, Clock, CheckCircle, Phone, MapPin, Plus } from 'lucide-react';

const FT_STATUS_BADGES: Record<FTRequestStatus, 'danger' | 'warning' | 'info' | 'success' | 'default'> = {
  aberta: 'danger',
  acionando: 'warning',
  aceita: 'info',
  resolvida: 'success',
  cancelada: 'default',
};

export function FTPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const { fts: ftRequests, candidates: availableEmployees, loading } = useFT();
  const { employees } = useEmployees({ active: true });
  const { posts } = usePosts();

  const getProfileName = (profileId: string) => employees.find(e => e.id === profileId)?.name ?? 'Não encontrado';
  const getPostName = (postId: string) => posts.find(p => p.id === postId)?.name ?? 'Posto não encontrado';
  const selected = selectedId ? ftRequests.find(f => f.id === selectedId) : null;

  const columns = [
    {
      key: 'status',
      header: 'Status',
      render: (_: FTRequest) => (
        <Badge variant={FT_STATUS_BADGES[_.status]}>{_.status}</Badge>
      ),
    },
    {
      key: 'post',
      header: 'Posto',
      render: (_: FTRequest) => (
        <span className="font-medium text-gray-900">{getPostName(_.post_id)}</span>
      ),
    },
    {
      key: 'reason',
      header: 'Motivo',
      render: (_: FTRequest) => (
        <span className="text-sm text-gray-700 capitalize">{_.reason.replace('_', ' ')}</span>
      ),
    },
    {
      key: 'urgency',
      header: 'Urgência',
      render: (_: FTRequest) => <SeverityBadge severity={_.urgency} />,
    },
    {
      key: 'opened_by',
      header: 'Aberto por',
      render: (_: FTRequest) => (
        <span className="text-sm text-gray-600">{getProfileName(_.opened_by)}</span>
      ),
    },
    {
      key: 'time',
      header: 'Tempo',
      render: (_: FTRequest) => (
        <span className="text-sm text-gray-600">{formatRelativeTime(_.opened_at)}</span>
      ),
    },
    {
      key: 'assigned',
      header: 'Designado',
      render: (_: FTRequest) => (
        _.assigned_to
          ? <div className="flex items-center gap-1"><Avatar name={getProfileName(_.assigned_to)} size="sm" /> <span className="text-sm">{getProfileName(_.assigned_to)}</span></div>
          : <Badge variant="danger">Sem designação</Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Força Tarefa"
        subtitle={loading ? 'Carregando FTs...' : `${ftRequests.filter(f => f.status === 'aberta').length} FTs abertas`}
        actions={
          <Button onClick={() => setShowAssignModal(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nova FT
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Siren className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{ftRequests.filter(f => f.status === 'aberta').length}</p>
              <p className="text-xs text-gray-500">Abertas</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{ftRequests.filter(f => f.status === 'acionando').length}</p>
              <p className="text-xs text-gray-500">Acionando</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{ftRequests.filter(f => f.status === 'resolvida').length}</p>
              <p className="text-xs text-gray-500">Resolvidas</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{availableEmployees.length}</p>
              <p className="text-xs text-gray-500">Disponíveis</p>
            </div>
          </div>
        </Card>
      </div>

      <Card padding={false}>
        <DataTable
          columns={columns}
          data={ftRequests}
          keyExtractor={f => f.id}
          onRowClick={f => setSelectedId(f.id)}
          emptyMessage={loading ? "Carregando FTs..." : "Nenhuma FT registrada"}
        />
      </Card>

      {/* FT Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelectedId(null)} title="Detalhes da FT" size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 rounded-xl">
                  <Siren className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{getPostName(selected.post_id)}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={FT_STATUS_BADGES[selected.status]}>{selected.status}</Badge>
                    <SeverityBadge severity={selected.urgency} />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">Motivo</p>
                <p className="text-sm font-medium text-gray-900 capitalize">{selected.reason.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Aberto por</p>
                <p className="text-sm font-medium text-gray-900">{getProfileName(selected.opened_by)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Aberto em</p>
                <p className="text-sm font-medium text-gray-900">{formatDateTime(selected.opened_at)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Designado para</p>
                <p className="text-sm font-medium text-gray-900">{selected.assigned_to ? getProfileName(selected.assigned_to) : 'Ninguém'}</p>
              </div>
            </div>

            {selected.notes && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1">Observações</h4>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{selected.notes}</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              {selected.status === 'aberta' && (
                <>
                  <Button className="flex-1">
                    <Users className="w-4 h-4 mr-1" /> Designar Funcionário
                  </Button>
                  <Button variant="secondary">
                    <Phone className="w-4 h-4 mr-1" /> Ligar
                  </Button>
                </>
              )}
              {selected.status === 'acionando' && (
                <Button className="flex-1">
                  <CheckCircle className="w-4 h-4 mr-1" /> Confirmar Aceitação
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Available Employees */}
      <div className="mt-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Funcionários Disponíveis para FT
        </h2>
        {availableEmployees.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-500 text-center py-4">Nenhum funcionário disponível no momento</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableEmployees.map(emp => (
              <Card key={emp.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={emp.name} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                    <p className="text-xs text-gray-500">{emp.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-blue-50 rounded-lg text-blue-600" title="Designar">
                    <Users className="w-4 h-4" />
                  </button>
                  <button className="p-2 hover:bg-green-50 rounded-lg text-green-600" title="Ligar">
                    <Phone className="w-4 h-4" />
                  </button>
                  <button className="p-2 hover:bg-gray-50 rounded-lg text-gray-400" title="Localização">
                    <MapPin className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* New FT Modal */}
      <Modal open={showAssignModal} onClose={() => setShowAssignModal(false)} title="Nova Força Tarefa">
        <div className="space-y-4">
          <SelectField
            id="ft-post"
            label="Posto"
            placeholder="Selecione o posto..."
            options={[
              { value: 'post-001', label: 'Portaria Principal - Plaza' },
              { value: 'post-002', label: 'Estacionamento Subsolo - Plaza' },
              { value: 'post-003', label: 'Portaria Torre B - Plaza' },
            ]}
          />
          <SelectField
            id="ft-reason"
            label="Motivo"
            placeholder="Selecione..."
            options={[
              { value: 'ausencia', label: 'Ausência' },
              { value: 'atraso', label: 'Atraso' },
              { value: 'retencao', label: 'Retenção' },
              { value: 'preventiva', label: 'Preventiva' },
            ]}
          />
          <div className="flex gap-2 pt-2">
            <Button className="flex-1">Abrir FT</Button>
            <Button variant="secondary" onClick={() => setShowAssignModal(false)}>Cancelar</Button>
          </div>
          <p className="text-xs text-gray-400 text-center">⚠️ Modo demo</p>
        </div>
      </Modal>
    </div>
  );
}
