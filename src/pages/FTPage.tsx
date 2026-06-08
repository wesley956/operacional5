// ============================================================
// OPERACIONAL5 — Página de Força Tarefa (FT)
// ============================================================

import { useState, type FormEvent } from 'react';
import { PageHeader, Card, Badge, DataTable, Modal, Button, SelectField, Textarea } from '@/components/ui';
import { Avatar } from '@/components/Layout';
import { SeverityBadge } from '@/components/DashboardComponents';
import { useProfile } from '@/context/AuthContext';
import { useEmployees, useFT, usePosts } from '@/hooks';
import { formatDateTime, formatRelativeTime } from '@/lib/utils';
import {
  type FTReason,
  type FTRequest,
  type FTRequestStatus,
  type Severity,
} from '@/lib/types';
import { Siren, Users, Clock, CheckCircle, Phone, MapPin, Plus, XCircle } from 'lucide-react';

const FT_STATUS_BADGES: Record<FTRequestStatus, 'danger' | 'warning' | 'info' | 'success' | 'default'> = {
  aberta: 'danger',
  acionando: 'warning',
  aceita: 'info',
  resolvida: 'success',
  cancelada: 'default',
};

const FT_REASON_OPTIONS: { value: FTReason; label: string }[] = [
  { value: 'ausencia', label: 'Ausência' },
  { value: 'atraso', label: 'Atraso' },
  { value: 'retencao', label: 'Retenção' },
  { value: 'preventiva', label: 'Preventiva' },
];

const FT_URGENCY_OPTIONS: { value: Severity; label: string }[] = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'critica', label: 'Crítica' },
];

export function FTPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [assigningFtId, setAssigningFtId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const profile = useProfile();
  const {
    fts: ftRequests,
    candidates: availableEmployees,
    loading,
    openFT,
    assignFT,
    resolveFT,
    cancelFT,
  } = useFT();
  const { employees } = useEmployees({ active: true });
  const { posts } = usePosts();

  const activePosts = posts.filter(post => post.active !== false);
  const selected = selectedId ? ftRequests.find(f => f.id === selectedId) : null;
  const assigningFt = assigningFtId ? ftRequests.find(f => f.id === assigningFtId) : null;

  const getProfileName = (profileId: string) => employees.find(e => e.id === profileId)?.name ?? 'Não encontrado';
  const getPostName = (postId: string) => posts.find(p => p.id === postId)?.name ?? 'Posto não encontrado';
  const getEmployeePhone = (profileId?: string) => employees.find(e => e.id === profileId)?.phone;

  const clearMessages = () => {
    setActionError(null);
    setActionSuccess(null);
  };

  const handleOpenFT = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearMessages();
    setActionLoading('open');

    try {
      const form = new FormData(event.currentTarget);
      const postId = String(form.get('post_id') ?? '').trim();
      const reason = String(form.get('reason') ?? '').trim() as FTReason;
      const urgency = String(form.get('urgency') ?? '').trim() as Severity;
      const notes = String(form.get('notes') ?? '').trim();

      if (!postId) throw new Error('Selecione o posto da FT.');
      if (!reason) throw new Error('Selecione o motivo da FT.');
      if (!urgency) throw new Error('Selecione a urgência da FT.');

      const ft = await openFT({
        post_id: postId,
        opened_by: profile.id,
        reason,
        urgency,
        notes: notes || undefined,
      });

      event.currentTarget.reset();
      setShowNewModal(false);
      setSelectedId(ft.id);
      setActionSuccess(`FT aberta para ${getPostName(ft.post_id)}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível abrir a FT.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignFT = async (ftId: string, employeeId: string) => {
    clearMessages();
    setActionLoading(`assign-${ftId}-${employeeId}`);

    try {
      const ft = await assignFT(ftId, employeeId);
      setSelectedId(ft.id);
      setAssigningFtId(null);
      setActionSuccess(`${getProfileName(employeeId)} foi acionado para a FT.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível designar o funcionário.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveFT = async (ftId: string) => {
    clearMessages();
    setActionLoading(`resolve-${ftId}`);

    try {
      await resolveFT(ftId);
      setActionSuccess('FT resolvida com sucesso.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível resolver a FT.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelFT = async (ftId: string) => {
    clearMessages();
    setActionLoading(`cancel-${ftId}`);

    try {
      await cancelFT(ftId);
      setActionSuccess('FT cancelada com sucesso.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível cancelar a FT.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCallEmployee = (profileId?: string) => {
    const phone = getEmployeePhone(profileId);
    if (!phone) {
      setActionError('Funcionário sem telefone cadastrado.');
      return;
    }

    window.location.href = `tel:${phone.replace(/\s+/g, '')}`;
  };

  const quickAssignableFt =
    selected?.status === 'aberta'
      ? selected
      : ftRequests.find(ft => ft.status === 'aberta' && !ft.assigned_to);

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
          <Button onClick={() => {
            clearMessages();
            setShowNewModal(true);
          }}>
            <Plus className="w-4 h-4 mr-1" /> Nova FT
          </Button>
        }
      />

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {actionSuccess}
        </div>
      )}

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
          emptyMessage={loading ? "Carregando FTs..." : "Nenhuma FT registrada. Quando uma ausência, SOS ou cobertura emergencial gerar uma força tarefa, ela aparecerá aqui."}
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

            <div className="flex flex-wrap gap-2 pt-2">
              {selected.status === 'aberta' && (
                <>
                  <Button onClick={() => setAssigningFtId(selected.id)} className="flex-1">
                    <Users className="w-4 h-4 mr-1" /> Designar Funcionário
                  </Button>
                  <Button variant="secondary" onClick={() => handleCallEmployee(selected.assigned_to)}>
                    <Phone className="w-4 h-4 mr-1" /> Ligar
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => void handleCancelFT(selected.id)}
                    loading={actionLoading === `cancel-${selected.id}`}
                  >
                    <XCircle className="w-4 h-4 mr-1" /> Cancelar
                  </Button>
                </>
              )}
              {selected.status === 'acionando' && (
                <>
                  <Button disabled className="flex-1" title="A confirmação de aceite será concluída pelo fluxo do app mobile.">
                    <CheckCircle className="w-4 h-4 mr-1" /> Aguardando aceite
                  </Button>
                  <Button variant="secondary" onClick={() => handleCallEmployee(selected.assigned_to)}>
                    <Phone className="w-4 h-4 mr-1" /> Ligar
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => void handleCancelFT(selected.id)}
                    loading={actionLoading === `cancel-${selected.id}`}
                  >
                    <XCircle className="w-4 h-4 mr-1" /> Cancelar
                  </Button>
                </>
              )}
              {selected.status === 'aceita' && (
                <Button
                  className="flex-1"
                  onClick={() => void handleResolveFT(selected.id)}
                  loading={actionLoading === `resolve-${selected.id}`}
                >
                  <CheckCircle className="w-4 h-4 mr-1" /> Resolver FT
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Available Employees */}
      <div className="mt-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          Funcionários Disponíveis para FT
        </h2>
        <p className="mb-3 text-sm text-gray-500">
          Estes funcionários podem ser usados para cobertura emergencial quando uma FT for aberta.
        </p>
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
                    <p className="text-xs text-gray-500">{emp.phone ?? 'Sem telefone'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 disabled:opacity-50"
                    title="Designar"
                    disabled={!quickAssignableFt || actionLoading !== null}
                    onClick={() => {
                      if (!quickAssignableFt) {
                        setActionError('Abra ou selecione uma FT aberta antes de designar um funcionário.');
                        return;
                      }

                      void handleAssignFT(quickAssignableFt.id, emp.id);
                    }}
                  >
                    <Users className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="p-2 hover:bg-green-50 rounded-lg text-green-600"
                    title="Ligar"
                    onClick={() => handleCallEmployee(emp.id)}
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="p-2 hover:bg-gray-50 rounded-lg text-gray-400"
                    title="Localização"
                    onClick={() => { window.location.hash = '/map'; }}
                  >
                    <MapPin className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* New FT Modal */}
      <Modal open={showNewModal} onClose={() => setShowNewModal(false)} title="Nova Força Tarefa">
        <form onSubmit={handleOpenFT} className="space-y-4">
          <SelectField
            id="ft-post"
            name="post_id"
            label="Posto"
            placeholder="Selecione o posto..."
            options={activePosts.map(post => ({ value: post.id, label: post.name }))}
          />
          <SelectField
            id="ft-reason"
            name="reason"
            label="Motivo"
            placeholder="Selecione..."
            options={FT_REASON_OPTIONS}
          />
          <SelectField
            id="ft-urgency"
            name="urgency"
            label="Urgência"
            placeholder="Selecione..."
            options={FT_URGENCY_OPTIONS}
          />
          <Textarea
            id="ft-notes"
            name="notes"
            label="Observações"
            placeholder="Contexto da cobertura emergencial, se necessário..."
          />
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" loading={actionLoading === 'open'}>
              Abrir FT
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowNewModal(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>

      {/* Assign FT Modal */}
      <Modal open={!!assigningFtId} onClose={() => setAssigningFtId(null)} title="Designar funcionário para FT">
        <div className="space-y-3">
          {assigningFt && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              <strong>{getPostName(assigningFt.post_id)}</strong> — {assigningFt.reason.replace('_', ' ')}
            </div>
          )}

          {availableEmployees.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum funcionário disponível para FT.</p>
          ) : (
            <div className="space-y-2">
              {availableEmployees.map(emp => (
                <div key={emp.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={emp.name} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                      <p className="text-xs text-gray-500">{emp.phone ?? 'Sem telefone'}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => assigningFtId && void handleAssignFT(assigningFtId, emp.id)}
                    loading={actionLoading === `assign-${assigningFtId}-${emp.id}`}
                  >
                    Designar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
