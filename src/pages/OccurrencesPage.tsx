// ============================================================
// OPERACIONAL5 — Página de Ocorrências
// ============================================================

import { useState } from 'react';
import { PageHeader, Card, Badge, DataTable, Modal, Button, SelectField, Textarea } from '@/components/ui';
import { Avatar } from '@/components/Layout';
import { SeverityBadge } from '@/components/DashboardComponents';
import { useEmployees, useOccurrences, usePosts } from '@/hooks';
import { formatDateTime, formatRelativeTime } from '@/lib/utils';
import {
  OCCURRENCE_TYPE_LABELS, SEVERITY_LABELS,
  type Occurrence, type OccurrenceType, type OccurrenceStatus,
} from '@/lib/types';
import {
  FileWarning, Plus, AlertTriangle, Siren, Eye, CheckCircle,
  Camera, MapPin,
} from 'lucide-react';

const OCCURRENCE_ICONS: Record<OccurrenceType, React.ReactNode> = {
  furto: <AlertTriangle className="w-4 h-4 text-yellow-600" />,
  acidente: <AlertTriangle className="w-4 h-4 text-orange-600" />,
  invasao: <Siren className="w-4 h-4 text-red-600" />,
  dano: <FileWarning className="w-4 h-4 text-orange-600" />,
  briga: <Siren className="w-4 h-4 text-red-600" />,
  suspeito: <Eye className="w-4 h-4 text-yellow-600" />,
  outro: <FileWarning className="w-4 h-4 text-gray-600" />,
  sos: <Siren className="w-4 h-4 text-red-600" />,
};

const STATUS_BADGES: Record<OccurrenceStatus, 'danger' | 'warning' | 'success' | 'default'> = {
  aberta: 'danger',
  em_tratamento: 'warning',
  resolvida: 'success',
  cancelada: 'default',
};

export function OccurrencesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { occurrences, loading } = useOccurrences();
  const { employees } = useEmployees({ active: true });
  const { posts } = usePosts();

  const getProfileName = (profileId: string) => employees.find(e => e.id === profileId)?.name ?? 'Não encontrado';
  const getPostName = (postId: string) => posts.find(p => p.id === postId)?.name ?? 'Posto não encontrado';
  const filtered = occurrences.filter(o => {
    if (severityFilter && o.severity !== severityFilter) return false;
    if (statusFilter && o.status !== statusFilter) return false;
    return true;
  });

  const selected = selectedId ? occurrences.find(o => o.id === selectedId) : null;

  const columns = [
    {
      key: 'type',
      header: 'Tipo',
      render: (_: Occurrence) => (
        <div className="flex items-center gap-2">
          {OCCURRENCE_ICONS[_.type]}
          <span className="font-medium text-gray-900">{OCCURRENCE_TYPE_LABELS[_.type]}</span>
        </div>
      ),
    },
    {
      key: 'severity',
      header: 'Severidade',
      render: (_: Occurrence) => <SeverityBadge severity={_.severity} />,
    },
    {
      key: 'post',
      header: 'Posto',
      render: (_: Occurrence) => (
        <span className="text-sm text-gray-700">{getPostName(_.post_id)}</span>
      ),
    },
    {
      key: 'employee',
      header: 'Autor',
      render: (_: Occurrence) => (
        <div className="flex items-center gap-2">
          <Avatar name={getProfileName(_.employee_id)} size="sm" />
          <span className="text-sm">{getProfileName(_.employee_id)}</span>
        </div>
      ),
    },
    {
      key: 'time',
      header: 'Quando',
      render: (_: Occurrence) => (
        <span className="text-sm text-gray-600">{formatRelativeTime(_.created_at)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (_: Occurrence) => (
        <Badge variant={STATUS_BADGES[_.status]}>{_.status.replace('_', ' ')}</Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Ocorrências"
        subtitle={loading ? 'Carregando ocorrências...' : `${occurrences.length} ocorrências registradas`}
        actions={
          <div className="flex items-center gap-2">
            <SelectField
              id="sev-filter"
              placeholder="Severidade"
              options={Object.entries(SEVERITY_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              className="w-32"
            />
            <SelectField
              id="status-filter"
              placeholder="Status"
              options={[
                { value: 'aberta', label: 'Aberta' },
                { value: 'em_tratamento', label: 'Em tratamento' },
                { value: 'resolvida', label: 'Resolvida' },
                { value: 'cancelada', label: 'Cancelada' },
              ]}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-36"
            />
            <Button onClick={() => setShowNewModal(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nova
            </Button>
          </div>
        }
      />

      <Card padding={false}>
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={o => o.id}
          onRowClick={o => setSelectedId(o.id)}
          emptyMessage={loading ? "Carregando ocorrências..." : "Nenhuma ocorrência encontrada"}
        />
      </Card>

      {/* Occurrence Detail */}
      <Modal open={!!selected} onClose={() => setSelectedId(null)} title="Detalhes da Ocorrência" size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  {OCCURRENCE_ICONS[selected.type]}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {OCCURRENCE_TYPE_LABELS[selected.type]}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <SeverityBadge severity={selected.severity} />
                    <Badge variant={STATUS_BADGES[selected.status]}>
                      {selected.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-3">
                <DetailItem label="Posto" value={getPostName(selected.post_id)} />
                <DetailItem label="Registrado por" value={getProfileName(selected.employee_id)} />
                <DetailItem label="Data/Hora" value={formatDateTime(selected.created_at)} />
                <DetailItem label="Atualizado" value={formatDateTime(selected.updated_at)} />
                {selected.ack_supervisor && (
                  <DetailItem label="Ciência Supervisor" value={getProfileName(selected.ack_supervisor)} />
                )}
                {selected.resolved_at && (
                  <DetailItem label="Resolvido em" value={formatDateTime(selected.resolved_at)} />
                )}
              </div>
            </div>

            {selected.description && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1">Descrição</h4>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{selected.description}</p>
              </div>
            )}

            {selected.photo_url && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1">Evidência Fotográfica</h4>
                <div className="bg-gray-100 rounded-lg h-48 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <Camera className="w-8 h-8 mx-auto mb-1" />
                    <p className="text-xs">Foto armazenada no bucket privado</p>
                    <p className="text-xs">{selected.photo_url}</p>
                  </div>
                </div>
              </div>
            )}

            {selected.gps_lat && selected.gps_lng && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4" />
                {selected.gps_lat.toFixed(6)}, {selected.gps_lng.toFixed(6)}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-gray-100">
              {selected.status === 'aberta' && (
                <Button>
                  <CheckCircle className="w-4 h-4 mr-1" /> Marcar Ciência
                </Button>
              )}
              {(selected.status === 'aberta' || selected.status === 'em_tratamento') && (
                <Button variant="secondary">
                  Resolver Ocorrência
                </Button>
              )}
              {selected.type === 'sos' && (
                <Button variant="danger">
                  Encerrar SOS
                </Button>
              )}
            </div>

            <p className="text-xs text-gray-400">
              ID: {selected.id} | Idempotency: {selected.idempotency_key}
            </p>
          </div>
        )}
      </Modal>

      {/* New Occurrence Modal */}
      <Modal open={showNewModal} onClose={() => setShowNewModal(false)} title="Nova Ocorrência">
        <div className="space-y-4">
          <SelectField
            id="occ-type"
            label="Tipo"
            placeholder="Selecione o tipo..."
            options={Object.entries(OCCURRENCE_TYPE_LABELS)
              .filter(([k]) => k !== 'sos')
              .map(([value, label]) => ({ value, label }))}
          />
          <SelectField
            id="occ-severity"
            label="Severidade"
            placeholder="Selecione..."
            options={Object.entries(SEVERITY_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Foto <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer">
              <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Clique para tirar foto ou anexar</p>
              <p className="text-xs text-gray-400 mt-1">Obrigatória para envio oficial</p>
            </div>
          </div>
          <Textarea
            id="occ-desc"
            label="Descrição (opcional)"
            placeholder="Descreva o que aconteceu..."
          />
          <div className="flex gap-2 pt-2">
            <Button className="flex-1">Registrar Ocorrência</Button>
            <Button variant="secondary" onClick={() => setShowNewModal(false)}>Cancelar</Button>
          </div>
          <p className="text-xs text-gray-400 text-center">
            ⚠️ Modo demo — dados não persistidos. Em produção, foto é obrigatória.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}
