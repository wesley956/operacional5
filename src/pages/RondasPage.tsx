// ============================================================
// OPERACIONAL5 — Página de Rondas
// ============================================================

import { FormEvent, useState } from 'react';
import { PageHeader, Card, Badge, DataTable, Modal } from '@/components/ui';
import { useEmployees, usePosts, useRondas } from '@/hooks';
import { formatDateTime, formatRelativeTime, cn } from '@/lib/utils';
import { Search, CheckCircle, Clock, XCircle, AlertTriangle, MapPin, Camera, QrCode, Plus } from 'lucide-react';

const STATUS_CONFIG = {
  concluida: { badge: 'success' as const, icon: <CheckCircle className="w-4 h-4 text-green-600" />, label: 'Concluída' },
  pendente: { badge: 'warning' as const, icon: <Clock className="w-4 h-4 text-yellow-600" />, label: 'Pendente' },
  atrasada: { badge: 'danger' as const, icon: <AlertTriangle className="w-4 h-4 text-orange-600" />, label: 'Atrasada' },
  perdida: { badge: 'danger' as const, icon: <XCircle className="w-4 h-4 text-red-600" />, label: 'Perdida' },
};

export function RondasPage() {
  const [selectedPostFilter, setSelectedPostFilter] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const { posts } = usePosts({ active: true });
  const { points, logs, loading, createPoint } = useRondas(selectedPostFilter || undefined);
  const { employees } = useEmployees({ active: true });

  const getPostName = (postId: string) => posts.find(p => p.id === postId)?.name ?? 'Posto não encontrado';
  const getProfileName = (profileId: string) => employees.find(e => e.id === profileId)?.name ?? 'Não encontrado';
  const getRondaPointName = (pointId: string) => points.find(p => p.id === pointId)?.name ?? 'Ponto não encontrado';

  const filteredPoints = selectedPostFilter
    ? points.filter(p => p.post_id === selectedPostFilter)
    : points;

  const filteredLogs = selectedPostFilter
    ? logs.filter(l => l.post_id === selectedPostFilter)
    : logs;

  const selectedLogData = selectedLog ? logs.find(l => l.id === selectedLog) : null;

  const getNextSequenceForPost = (postId: string): number => {
    const orders = points.filter(point => point.post_id === postId).map(point => point.sequence_order);
    return orders.length ? Math.max(...orders) + 1 : 1;
  };

  async function handleCreatePoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const postId = String(form.get('post_id') ?? '').trim();
    const name = String(form.get('name') ?? '').trim();
    const lat = Number(form.get('lat'));
    const lng = Number(form.get('lng'));
    const radius = Number(form.get('radius_meters'));
    const sequence = Number(form.get('sequence_order'));
    const nfcUid = String(form.get('nfc_uid') ?? '').trim();

    if (!postId || !name || Number.isNaN(lat) || Number.isNaN(lng)) {
      alert('Informe posto, nome e coordenadas válidas para criar o ponto de ronda.');
      return;
    }

    setCreating(true);
    try {
      await createPoint({
        post_id: postId,
        name,
        lat,
        lng,
        radius_meters: Number.isFinite(radius) && radius > 0 ? radius : 20,
        sequence_order: Number.isFinite(sequence) && sequence > 0 ? sequence : getNextSequenceForPost(postId),
        require_photo: form.get('require_photo') === 'on',
        nfc_uid: nfcUid || undefined,
      });
      setCreateModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao criar ponto de ronda.');
    } finally {
      setCreating(false);
    }
  }

  // Stats
  const completed = logs.filter(l => l.status === 'concluida').length;
  const pending = logs.filter(l => l.status === 'pendente').length;
  const late = logs.filter(l => l.status === 'atrasada').length;
  const total = logs.length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const columns = [
    {
      key: 'point',
      header: 'Ponto',
      render: (_: typeof logs[0]) => (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-400" />
          <div>
            <p className="font-medium text-gray-900">{getRondaPointName(_.ronda_point_id)}</p>
            <p className="text-xs text-gray-500">{getPostName(_.post_id)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'employee',
      header: 'Vigilante',
      render: (_: typeof logs[0]) => (
        <span className="text-sm text-gray-700">{getProfileName(_.employee_id)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (_: typeof logs[0]) => {
        const cfg = STATUS_CONFIG[_.status];
        return (
          <Badge variant={cfg.badge}>
            <span className="flex items-center gap-1">{cfg.icon} {cfg.label}</span>
          </Badge>
        );
      },
    },
    {
      key: 'time',
      header: 'Horário',
      render: (_: typeof logs[0]) => (
        <span className="text-sm text-gray-600">
          {_.confirmed_at ? formatDateTime(_.confirmed_at) : formatRelativeTime(_.created_at)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Rondas"
        subtitle={`${completed}/${total} pontos vistoriados (${completionRate}%)`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> Novo Ponto
            </button>
            <select
              value={selectedPostFilter}
              onChange={e => setSelectedPostFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">Todos os postos</option>
              {posts.map(post => (
                <option key={post.id} value={post.id}>{post.name}</option>
              ))}
            </select>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            <div>
              <p className="text-2xl font-bold text-green-600">{completed}</p>
              <p className="text-xs text-gray-500">Concluídas</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg"><Clock className="w-5 h-5 text-yellow-600" /></div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{pending}</p>
              <p className="text-xs text-gray-500">Pendentes</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-orange-600" /></div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{late}</p>
              <p className="text-xs text-gray-500">Atrasadas</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><Search className="w-5 h-5 text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{completionRate}%</p>
              <p className="text-xs text-gray-500">Conclusão</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Ronda Points Grid */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Pontos de Ronda</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading && (
            <Card>
              <p className="text-sm text-gray-500">Carregando pontos de ronda...</p>
            </Card>
          )}
          {!loading && filteredPoints.length === 0 && (
            <Card>
              <p className="text-sm text-gray-500">Nenhum ponto de ronda cadastrado para o filtro selecionado.</p>
            </Card>
          )}
          {!loading && filteredPoints.map((point) => {
            const log = logs.find(l => l.ronda_point_id === point.id);
            const status = log?.status ?? 'pendente';
            const cfg = STATUS_CONFIG[status];

            return (
              <Card key={point.id} className={cn(
                'border-l-4',
                status === 'concluida' && 'border-l-green-500',
                status === 'pendente' && 'border-l-yellow-500',
                status === 'atrasada' && 'border-l-orange-500',
                status === 'perdida' && 'border-l-red-500',
              )}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-xs font-bold text-gray-600">
                      {point.sequence_order}
                    </span>
                    <h3 className="text-sm font-semibold text-gray-900">{point.name}</h3>
                  </div>
                  <Badge variant={cfg.badge}>{cfg.label}</Badge>
                </div>
                <p className="text-xs text-gray-500 mb-2">{getPostName(point.post_id)}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {point.radius_meters}m
                  </span>
                  {point.require_photo && (
                    <span className="flex items-center gap-1 text-orange-600">
                      <Camera className="w-3 h-3" /> Foto
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <QrCode className="w-3 h-3" /> QR
                  </span>
                </div>
                {log && log.confirmed_at && (
                  <p className="text-xs text-gray-400 mt-2">
                    ✓ {getProfileName(log.employee_id)} — {formatRelativeTime(log.confirmed_at)}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Ronda Logs Table */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Histórico de Rondas</h3>
        </div>
        <DataTable
          columns={columns}
          data={filteredLogs}
          keyExtractor={l => l.id}
          onRowClick={l => setSelectedLog(l.id)}
          emptyMessage="Nenhuma ronda registrada"
        />
      </Card>

      {/* Create Ronda Point Modal */}
      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Novo Ponto de Ronda">
        <form onSubmit={handleCreatePoint} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Posto</label>
            <select
              name="post_id"
              required
              defaultValue={selectedPostFilter || posts[0]?.id || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              onChange={event => {
                const sequenceInput = event.currentTarget.form?.elements.namedItem('sequence_order') as HTMLInputElement | null;
                if (sequenceInput) sequenceInput.value = String(getNextSequenceForPost(event.currentTarget.value));
              }}
            >
              <option value="" disabled>Selecione o posto</option>
              {posts.map(post => <option key={post.id} value={post.id}>{post.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do ponto</label>
            <input name="name" required placeholder="Ex.: Portaria 2, Garagem, Área técnica" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
              <input name="lat" type="number" step="any" required placeholder="-23.550520" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
              <input name="lng" type="number" step="any" required placeholder="-46.633308" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Raio permitido (m)</label>
              <input name="radius_meters" type="number" min="1" defaultValue="20" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ordem da ronda</label>
              <input
                name="sequence_order"
                type="number"
                min="1"
                defaultValue={selectedPostFilter ? getNextSequenceForPost(selectedPostFilter) : 1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">NFC UID opcional</label>
            <input name="nfc_uid" placeholder="Tag NFC do ponto, se houver" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input name="require_photo" type="checkbox" className="rounded border-gray-300" />
            Exigir foto na confirmação deste ponto
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <button type="button" onClick={() => setCreateModalOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={creating} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              {creating ? 'Criando...' : 'Criar ponto'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Log Detail Modal */}
      <Modal open={!!selectedLogData} onClose={() => setSelectedLog(null)} title="Detalhes da Ronda">
        {selectedLogData && (() => {
          const cfg = STATUS_CONFIG[selectedLogData.status];
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg"><MapPin className="w-5 h-5 text-gray-600" /></div>
                <div>
                  <h3 className="font-semibold text-gray-900">{getRondaPointName(selectedLogData.ronda_point_id)}</h3>
                  <Badge variant={cfg.badge}>{cfg.label}</Badge>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-gray-500">Posto</p><p className="font-medium">{getPostName(selectedLogData.post_id)}</p></div>
                <div><p className="text-xs text-gray-500">Vigilante</p><p className="font-medium">{getProfileName(selectedLogData.employee_id)}</p></div>
                <div><p className="text-xs text-gray-500">Confirmada em</p><p className="font-medium">{selectedLogData.confirmed_at ? formatDateTime(selectedLogData.confirmed_at) : '—'}</p></div>
                <div><p className="text-xs text-gray-500">GPS</p><p className="font-medium">{selectedLogData.gps_lat ? `${selectedLogData.gps_lat.toFixed(6)}, ${selectedLogData.gps_lng?.toFixed(6)}` : '—'}</p></div>
              </div>
              {selectedLogData.notes && (
                <div><p className="text-xs text-gray-500 mb-1">Observações</p><p className="text-sm bg-gray-50 rounded-lg p-3">{selectedLogData.notes}</p></div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
