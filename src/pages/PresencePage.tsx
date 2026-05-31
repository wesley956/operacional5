// ============================================================
// OPERACIONAL5 — Página de Assunções / Presenças
// ============================================================

import { useState, type FormEvent } from 'react';
import { PageHeader, Card, Badge, DataTable, Modal, Button, Input, SelectField } from '@/components/ui';
import { Avatar } from '@/components/Layout';
import { useEmployees, usePosts, usePresence } from '@/hooks';
import { formatDateTime, formatRelativeTime } from '@/lib/utils';
import { METHOD_LABELS, type Presence, type PresenceMethod, type PresenceStatus } from '@/lib/types';
import {
  MapPin,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Wifi,
  WifiOff,
  QrCode,
  Cpu,
  Camera,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

const METHOD_ICONS: Record<PresenceMethod, React.ReactNode> = {
  gps: <Wifi className="w-4 h-4 text-green-600" />,
  qr: <QrCode className="w-4 h-4 text-blue-600" />,
  nfc: <Cpu className="w-4 h-4 text-purple-600" />,
  manual: <MapPin className="w-4 h-4 text-gray-600" />,
};

const STATUS_CONFIG: Record<PresenceStatus, { badge: 'success' | 'warning' | 'danger'; icon: React.ReactNode; label: string }> = {
  valid: { badge: 'success', icon: <CheckCircle className="w-3.5 h-3.5" />, label: 'Válida' },
  pending_review: { badge: 'warning', icon: <Clock className="w-3.5 h-3.5" />, label: 'Revisão' },
  rejected: { badge: 'danger', icon: <XCircle className="w-3.5 h-3.5" />, label: 'Rejeitada' },
};

function makeIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `presence-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não disponível neste navegador.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

function hasGps(presence: Presence): boolean {
  return typeof presence.gps_lat === 'number' && typeof presence.gps_lng === 'number';
}

function mapsUrl(presence: Presence): string | null {
  if (!hasGps(presence)) return null;
  return `https://www.google.com/maps?q=${presence.gps_lat},${presence.gps_lng}`;
}

function gpsBadge(presence: Presence) {
  if (presence.is_mock_location) {
    return <Badge variant="danger" pulse><AlertTriangle className="w-3 h-3 mr-1" /> Mock</Badge>;
  }

  if (presence.gps_valid) {
    return <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" /> Dentro do raio</Badge>;
  }

  return <Badge variant="warning"><WifiOff className="w-3 h-3 mr-1" /> Fora/fraco</Badge>;
}

export function PresencePage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);
  const [presenceMethod, setPresenceMethod] = useState<PresenceMethod>('manual');
  const [methodFilter, setMethodFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [photoFilter, setPhotoFilter] = useState<string>('');

  const { presences, loading, confirmPresence } = usePresence();
  const { employees } = useEmployees({ active: true });
  const { posts } = usePosts();

  const getProfileName = (employeeId: string) => employees.find(e => e.id === employeeId)?.name ?? 'Funcionário não encontrado';
  const getProfileEmail = (employeeId: string) => employees.find(e => e.id === employeeId)?.email ?? '';
  const getPostName = (postId: string) => posts.find(p => p.id === postId)?.name ?? 'Posto não encontrado';

  const filtered = presences.filter(p => {
    if (methodFilter && p.validation_method !== methodFilter) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    if (photoFilter === 'with_photo' && !p.photo_url) return false;
    if (photoFilter === 'without_photo' && p.photo_url) return false;
    return true;
  });

  const selected = selectedId ? presences.find(p => p.id === selectedId) : null;

  const stats = {
    total: presences.length,
    valid: presences.filter(p => p.status === 'valid').length,
    review: presences.filter(p => p.status === 'pending_review').length,
    photos: presences.filter(p => Boolean(p.photo_url)).length,
  };

  const handleConfirmPresence = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setConfirmError(null);
    setConfirmSuccess(null);
    setConfirming(true);

    try {
      const form = new FormData(formElement);
      const employeeId = String(form.get('employee_id') ?? '').trim();
      const postId = String(form.get('post_id') ?? '').trim();
      const method = String(form.get('method') ?? 'manual') as PresenceMethod;
      const qrCodeToken = String(form.get('qr_code_token') ?? '').trim();

      let latValue = String(form.get('lat') ?? '').trim();
      let lngValue = String(form.get('lng') ?? '').trim();
      let accuracyValue = String(form.get('accuracy') ?? '').trim();

      if (!employeeId) throw new Error('Selecione o funcionário.');
      if (!postId) throw new Error('Selecione o posto.');

      if (method === 'qr' && !qrCodeToken) {
        throw new Error('Informe o token QR do posto.');
      }

      if (method === 'gps' && (!latValue || !lngValue)) {
        const position = await getCurrentPosition();
        latValue = String(position.coords.latitude);
        lngValue = String(position.coords.longitude);
        accuracyValue = String(position.coords.accuracy);
      }

      const lat = latValue ? Number(latValue) : undefined;
      const lng = lngValue ? Number(lngValue) : undefined;
      const accuracy = accuracyValue ? Number(accuracyValue) : undefined;

      if (method === 'gps' && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
        throw new Error('Latitude e longitude precisam ser válidas para presença GPS.');
      }

      const result = await confirmPresence({
        employee_id: employeeId,
        post_id: postId,
        method,
        lat,
        lng,
        accuracy,
        qr_code_token: qrCodeToken || undefined,
        idempotency_key: makeIdempotencyKey(),
        device_info: navigator.userAgent,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      formElement.reset();
      setPresenceMethod('manual');
      setShowConfirmModal(false);
      setConfirmSuccess(result.message);
    } catch (error) {
      setConfirmError(error instanceof Error ? error.message : 'Erro ao confirmar presença.');
    } finally {
      setConfirming(false);
    }
  };

  const columns = [
    {
      key: 'employee',
      header: 'Operador',
      render: (presence: Presence) => (
        <div className="flex items-center gap-2">
          <Avatar name={getProfileName(presence.employee_id)} size="sm" />
          <div>
            <p className="font-medium text-gray-900">{getProfileName(presence.employee_id)}</p>
            <p className="text-xs text-gray-500">{getProfileEmail(presence.employee_id) || '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'post',
      header: 'Posto',
      render: (presence: Presence) => (
        <span className="text-sm text-gray-700">{getPostName(presence.post_id)}</span>
      ),
    },
    {
      key: 'time',
      header: 'Assumiu em',
      render: (presence: Presence) => (
        <div>
          <p className="text-sm font-medium text-gray-700">{formatDateTime(presence.confirmed_at)}</p>
          <p className="text-xs text-gray-500">{formatRelativeTime(presence.confirmed_at)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (presence: Presence) => {
        const cfg = STATUS_CONFIG[presence.status];
        return (
          <Badge variant={cfg.badge}>
            <span className="flex items-center gap-1">
              {cfg.icon} {cfg.label}
            </span>
          </Badge>
        );
      },
    },
    {
      key: 'gps',
      header: 'GPS',
      render: (presence: Presence) => gpsBadge(presence),
    },
    {
      key: 'photo',
      header: 'Foto',
      render: (presence: Presence) => (
        presence.photo_url
          ? <Badge variant="success"><Camera className="w-3 h-3 mr-1" /> Sim</Badge>
          : <Badge variant="warning"><Camera className="w-3 h-3 mr-1" /> Não</Badge>
      ),
    },
    {
      key: 'method',
      header: 'Método',
      render: (presence: Presence) => (
        <div className="flex items-center gap-1.5 text-sm">
          {METHOD_ICONS[presence.validation_method]}
          {METHOD_LABELS[presence.validation_method]}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Assunções de posto"
        subtitle={loading ? 'Carregando registros...' : `${presences.length} registros de presença/assunção`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => {
              setConfirmError(null);
              setConfirmSuccess(null);
              setShowConfirmModal(true);
            }}>
              <CheckCircle className="w-4 h-4 mr-1" /> Registro manual
            </Button>
            <SelectField
              id="method-filter"
              placeholder="Método"
              options={Object.entries(METHOD_LABELS).map(([value, label]) => ({ value, label }))}
              value={methodFilter}
              onChange={e => setMethodFilter(e.target.value)}
              className="w-32"
            />
            <SelectField
              id="status-filter"
              placeholder="Status"
              options={[
                { value: 'valid', label: 'Válida' },
                { value: 'pending_review', label: 'Revisão' },
                { value: 'rejected', label: 'Rejeitada' },
              ]}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-32"
            />
            <SelectField
              id="photo-filter"
              placeholder="Foto"
              options={[
                { value: 'with_photo', label: 'Com foto' },
                { value: 'without_photo', label: 'Sem foto' },
              ]}
              value={photoFilter}
              onChange={e => setPhotoFilter(e.target.value)}
              className="w-32"
            />
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <AuditStat label="Total" value={stats.total} />
        <AuditStat label="Válidas" value={stats.valid} tone="green" />
        <AuditStat label="Em revisão" value={stats.review} tone="yellow" />
        <AuditStat label="Com foto" value={stats.photos} tone="blue" />
      </div>

      {confirmSuccess && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {confirmSuccess}
        </div>
      )}

      <Card padding={false}>
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={p => p.id}
          onRowClick={p => setSelectedId(p.id)}
          emptyMessage={loading ? "Carregando registros..." : "Nenhuma assunção de posto registrada"}
        />
      </Card>

      <Modal open={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Registro manual de presença">
        <form onSubmit={handleConfirmPresence} className="space-y-4">
          {confirmError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {confirmError}
            </div>
          )}

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
            Use registro manual apenas para correções operacionais controladas. O fluxo normal deve ser pelo app mobile em <b>Assumir posto</b>.
          </div>

          <SelectField
            id="presence-employee"
            name="employee_id"
            label="Funcionário"
            placeholder="Selecione..."
            required
            options={employees.map(employee => ({
              value: employee.id,
              label: `${employee.name} — ${employee.role}`,
            }))}
          />

          <SelectField
            id="presence-post"
            name="post_id"
            label="Posto"
            placeholder="Selecione..."
            required
            options={posts.map(post => ({
              value: post.id,
              label: post.name,
            }))}
          />

          <SelectField
            id="presence-method"
            name="method"
            label="Método"
            value={presenceMethod}
            onChange={event => setPresenceMethod(event.target.value as PresenceMethod)}
            options={[
              { value: 'manual', label: 'Manual' },
              { value: 'gps', label: 'GPS' },
              { value: 'qr', label: 'QR Code' },
            ]}
          />

          {presenceMethod === 'qr' && (
            <Input
              id="presence-qr-token"
              name="qr_code_token"
              label="Token QR do posto"
              placeholder="Cole o token QR do posto"
              required
            />
          )}

          {presenceMethod === 'gps' && (
            <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs text-blue-700">
                Se latitude/longitude ficarem vazias, o navegador tentará capturar sua localização automaticamente.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input id="presence-lat" name="lat" label="Latitude" type="number" step="any" placeholder="-23.5505" />
                <Input id="presence-lng" name="lng" label="Longitude" type="number" step="any" placeholder="-46.6333" />
                <Input id="presence-accuracy" name="accuracy" label="Acurácia (m)" type="number" step="any" placeholder="20" />
              </div>
            </div>
          )}

          {presenceMethod === 'manual' && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
              Presença manual será registrada sem validação GPS/foto. Use apenas para correção administrativa.
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" loading={confirming}>
              Confirmar registro manual
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowConfirmModal(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelectedId(null)} title="Auditoria da assunção de posto" size="lg">
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={getProfileName(selected.employee_id)} />
                <div>
                  <h3 className="font-semibold text-gray-900">{getProfileName(selected.employee_id)}</h3>
                  <p className="text-sm text-gray-500">{getPostName(selected.post_id)}</p>
                </div>
              </div>
              {(() => {
                const cfg = STATUS_CONFIG[selected.status];
                return <Badge variant={cfg.badge}>{cfg.label}</Badge>;
              })()}
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
              <div className="flex items-center gap-2 text-blue-900 font-bold">
                <ShieldCheck className="w-4 h-4" />
                Registro de Assumir posto
              </div>
              <p className="mt-1 text-xs text-blue-700">
                Registro criado pelo app mobile ou por correção manual. Verifique foto, GPS e status para validar a assunção.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DetailItem label="Horário confirmado" value={formatDateTime(selected.confirmed_at)} />
              <DetailItem label="Relativo" value={formatRelativeTime(selected.confirmed_at)} />
              <DetailItem label="Método" value={METHOD_LABELS[selected.validation_method]} />
              <DetailItem label="Status" value={STATUS_CONFIG[selected.status].label} />
              <DetailItem label="GPS válido" value={selected.gps_valid ? 'Sim' : 'Não'} />
              <DetailItem label="Mock location" value={selected.is_mock_location ? 'Detectado' : 'Não detectado'} />

              {hasGps(selected) && (
                <>
                  <DetailItem label="Latitude" value={selected.gps_lat?.toFixed(6)} />
                  <DetailItem label="Longitude" value={selected.gps_lng?.toFixed(6)} />
                </>
              )}

              {selected.accuracy ? (
                <DetailItem label="Precisão" value={`${Math.round(selected.accuracy)}m`} />
              ) : null}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <div className="space-y-3">
                  <h4 className="font-bold text-gray-900">GPS</h4>
                  <div>{gpsBadge(selected)}</div>

                  {hasGps(selected) ? (
                    <>
                      <p className="text-sm text-gray-600">
                        {selected.gps_lat?.toFixed(6)}, {selected.gps_lng?.toFixed(6)}
                        {selected.accuracy ? ` · ±${Math.round(selected.accuracy)}m` : ''}
                      </p>

                      {mapsUrl(selected) ? (
                        <a
                          href={mapsUrl(selected) ?? '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:underline"
                        >
                          Abrir no mapa <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Sem coordenadas registradas.</p>
                  )}
                </div>
              </Card>

              <Card>
                <div className="space-y-3">
                  <h4 className="font-bold text-gray-900">Foto de evidência</h4>

                  {selected.photo_url ? (
                    <>
                      <a href={selected.photo_url} target="_blank" rel="noreferrer">
                        <img
                          src={selected.photo_url}
                          alt="Evidência da assunção do posto"
                          className="h-56 w-full rounded-xl object-cover border border-gray-200"
                        />
                      </a>
                      <a
                        href={selected.photo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:underline"
                      >
                        Abrir foto em nova aba <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Sem foto registrada neste lançamento.</p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function AuditStat({ label, value, tone = 'gray' }: { label: string; value: number; tone?: 'gray' | 'green' | 'yellow' | 'blue' }) {
  const tones = {
    gray: 'border-gray-200 bg-white text-gray-900',
    green: 'border-green-200 bg-green-50 text-green-900',
    yellow: 'border-yellow-200 bg-yellow-50 text-yellow-900',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium text-gray-900">{value ?? '—'}</p>
    </div>
  );
}
