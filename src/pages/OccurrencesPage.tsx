// ============================================================
// OPERACIONAL5 — Página de Ocorrências
// ============================================================

import { useState, type FormEvent } from 'react';
import { PageHeader, Card, Badge, DataTable, Modal, Button, Input, SelectField, Textarea } from '@/components/ui';
import { Avatar } from '@/components/Layout';
import { SeverityBadge } from '@/components/DashboardComponents';
import { useEmployees, useOccurrences, usePosts } from '@/hooks';
import { formatDateTime, formatRelativeTime } from '@/lib/utils';
import {
  OCCURRENCE_TYPE_LABELS, SEVERITY_LABELS,
  type Occurrence, type OccurrenceType, type OccurrenceStatus, type Severity,
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


function makeIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `occurrence-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const STATUS_BADGES: Record<OccurrenceStatus, 'danger' | 'warning' | 'success' | 'default'> = {
  aberta: 'danger',
  em_tratamento: 'warning',
  resolvida: 'success',
  cancelada: 'default',
};

export function OccurrencesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { occurrences, loading, createOccurrence } = useOccurrences();
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

  const handleCreateOccurrence = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setCreateError(null);
    setCreateSuccess(null);
    setCreating(true);

    try {
      const form = new FormData(formElement);

      const employeeId = String(form.get('employee_id') ?? '').trim();
      const postId = String(form.get('post_id') ?? '').trim();
      const type = String(form.get('type') ?? '').trim() as OccurrenceType;
      const severity = String(form.get('severity') ?? '').trim() as Severity;
      const description = String(form.get('description') ?? '').trim();
      const photoUrl = String(form.get('photo_url') ?? '').trim();
      const latValue = String(form.get('lat') ?? '').trim();
      const lngValue = String(form.get('lng') ?? '').trim();

      if (!employeeId) throw new Error('Selecione o funcionário responsável.');
      if (!postId) throw new Error('Selecione o posto.');
      if (!type) throw new Error('Selecione o tipo da ocorrência.');
      if (!severity) throw new Error('Selecione a severidade.');
      if (!description) throw new Error('Descreva a ocorrência.');

      const lat = latValue ? Number(latValue) : undefined;
      const lng = lngValue ? Number(lngValue) : undefined;

      if (latValue && !Number.isFinite(lat)) throw new Error('Latitude inválida.');
      if (lngValue && !Number.isFinite(lng)) throw new Error('Longitude inválida.');

      const occurrence = await createOccurrence({
        employee_id: employeeId,
        post_id: postId,
        type,
        severity,
        description,
        photo_url: photoUrl || undefined,
        lat,
        lng,
        idempotency_key: makeIdempotencyKey(),
      });

      formElement.reset();
      setShowNewModal(false);
      setCreateSuccess(`Ocorrência ${OCCURRENCE_TYPE_LABELS[occurrence.type]} registrada com sucesso.`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Erro ao registrar ocorrência.');
    } finally {
      setCreating(false);
    }
  };

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
          <div className="flex flex-wrap items-center gap-2">
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
            <Button onClick={() => {
              setCreateError(null);
              setCreateSuccess(null);
              setShowNewModal(true);
            }}>
              <Plus className="w-4 h-4 mr-1" /> Nova
            </Button>
          </div>
        }
      />

      {createSuccess && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {createSuccess}
        </div>
      )}

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
        <form onSubmit={handleCreateOccurrence} className="space-y-4">
          {createError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {createError}
            </div>
          )}

          <SelectField
            id="occ-employee"
            name="employee_id"
            label="Funcionário responsável"
            placeholder="Selecione..."
            required
            options={employees.map(employee => ({
              value: employee.id,
              label: `${employee.name} — ${employee.role}`,
            }))}
          />

          <SelectField
            id="occ-post"
            name="post_id"
            label="Posto"
            placeholder="Selecione..."
            required
            options={posts.map(post => ({ value: post.id, label: post.name }))}
          />

          <SelectField
            id="occ-type"
            name="type"
            label="Tipo"
            placeholder="Selecione o tipo..."
            required
            options={Object.entries(OCCURRENCE_TYPE_LABELS)
              .filter(([k]) => k !== 'sos')
              .map(([value, label]) => ({ value, label }))}
          />

          <SelectField
            id="occ-severity"
            name="severity"
            label="Severidade"
            placeholder="Selecione..."
            required
            options={Object.entries(SEVERITY_LABELS).map(([value, label]) => ({ value, label }))}
          />

          <Textarea
            id="occ-desc"
            name="description"
            label="Descrição"
            placeholder="Descreva o que aconteceu..."
            required
          />

          <Input
            id="occ-photo-url"
            name="photo_url"
            label="URL da evidência/foto (opcional)"
            placeholder="Caminho do arquivo no bucket evidence"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input id="occ-lat" name="lat" label="Latitude (opcional)" type="number" step="any" placeholder="-23.5505" />
            <Input id="occ-lng" name="lng" label="Longitude (opcional)" type="number" step="any" placeholder="-46.6333" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" loading={creating}>Registrar Ocorrência</Button>
            <Button type="button" variant="secondary" onClick={() => setShowNewModal(false)}>Cancelar</Button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            A ocorrência será salva no Supabase real e ficará disponível para supervisão.
          </p>
        </form>
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
