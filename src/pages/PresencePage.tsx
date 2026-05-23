// ============================================================
// OPERACIONAL5 — Página de Presença
// ============================================================

import { useState, type FormEvent } from 'react';
import { PageHeader, Card, Badge, DataTable, Modal, Button, Input, SelectField } from '@/components/ui';
import { Avatar } from '@/components/Layout';
import { useEmployees, usePosts, usePresence } from '@/hooks';
import { formatDateTime, formatRelativeTime, cn } from '@/lib/utils';
import { METHOD_LABELS, type Presence, type PresenceMethod, type PresenceStatus } from '@/lib/types';
import { MapPin, AlertTriangle, CheckCircle, Clock, XCircle, Wifi, WifiOff, QrCode, Cpu } from 'lucide-react';

const METHOD_ICONS: Record<PresenceMethod, React.ReactNode> = {
  gps: <Wifi className="w-4 h-4 text-green-600" />,
  qr: <QrCode className="w-4 h-4 text-blue-600" />,
  nfc: <Cpu className="w-4 h-4 text-purple-600" />,
  manual: <MapPin className="w-4 h-4 text-gray-600" />,
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

const STATUS_CONFIG: Record<PresenceStatus, { badge: 'success' | 'warning' | 'danger'; icon: React.ReactNode; label: string }> = {
  valid: { badge: 'success', icon: <CheckCircle className="w-3.5 h-3.5" />, label: 'Válida' },
  pending_review: { badge: 'warning', icon: <Clock className="w-3.5 h-3.5" />, label: 'Revisão' },
  rejected: { badge: 'danger', icon: <XCircle className="w-3.5 h-3.5" />, label: 'Rejeitada' },
};

export function PresencePage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);
  const [presenceMethod, setPresenceMethod] = useState<PresenceMethod>('manual');
  const [methodFilter, setMethodFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { presences, loading, confirmPresence } = usePresence();
  const { employees } = useEmployees({ active: true });
  const { posts } = usePosts();

  const getProfileName = (employeeId: string) => employees.find(e => e.id === employeeId)?.name ?? 'Funcionário não encontrado';
  const getPostName = (postId: string) => posts.find(p => p.id === postId)?.name ?? 'Posto não encontrado';
  const filtered = presences.filter(p => {
    if (methodFilter && p.validation_method !== methodFilter) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  const selected = selectedId ? presences.find(p => p.id === selectedId) : null;

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
      header: 'Funcionário',
      render: (_: Presence) => (
        <div className="flex items-center gap-2">
          <Avatar name={getProfileName(_.employee_id)} size="sm" />
          <span className="font-medium text-gray-900">{getProfileName(_.employee_id)}</span>
        </div>
      ),
    },
    {
      key: 'post',
      header: 'Posto',
      render: (_: Presence) => (
        <span className="text-sm text-gray-700">{getPostName(_.post_id)}</span>
      ),
    },
    {
      key: 'method',
      header: 'Método',
      render: (_: Presence) => (
        <div className="flex items-center gap-1.5 text-sm">
          {METHOD_ICONS[_.validation_method]}
          {METHOD_LABELS[_.validation_method]}
        </div>
      ),
    },
    {
      key: 'time',
      header: 'Horário',
      render: (_: Presence) => (
        <span className="text-sm text-gray-600">{formatDateTime(_.confirmed_at)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (_: Presence) => {
        const cfg = STATUS_CONFIG[_.status];
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
      key: 'mock',
      header: 'GPS',
      render: (_: Presence) => (
        _.is_mock_location
          ? <Badge variant="danger" pulse><AlertTriangle className="w-3 h-3 mr-1" /> Mock</Badge>
          : _.gps_valid
            ? <Badge variant="success"><CheckCircle className="w-3 h-3 mr-1" /> OK</Badge>
            : <Badge variant="warning"><WifiOff className="w-3 h-3 mr-1" /> Fraco</Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Presença"
        subtitle={loading ? 'Carregando presenças...' : `${presences.length} registros hoje`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => {
              setConfirmError(null);
              setConfirmSuccess(null);
              setShowConfirmModal(true);
            }}>
              <CheckCircle className="w-4 h-4 mr-1" /> Confirmar Presença
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
          </div>
        }
      />

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
          emptyMessage={loading ? "Carregando presenças..." : "Nenhuma presença registrada"}
        />
      </Card>

      {/* Confirm Presence Modal */}
      <Modal open={showConfirmModal} onClose={() => setShowConfirmModal(false)} title="Confirmar Presença">
        <form onSubmit={handleConfirmPresence} className="space-y-4">
          {confirmError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {confirmError}
            </div>
          )}

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
              Presença manual será registrada sem validação GPS. Use para correções operacionais controladas.
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" loading={confirming}>
              Confirmar Presença
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowConfirmModal(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Presence Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelectedId(null)} title="Detalhes da Presença" size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
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

            <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
              <DetailItem label="Método" value={METHOD_LABELS[selected.validation_method]} />
              <DetailItem label="Data/Hora" value={formatDateTime(selected.confirmed_at)} />
              {selected.gps_lat && selected.gps_lng && (
                <>
                  <DetailItem label="Latitude" value={selected.gps_lat.toFixed(6)} />
                  <DetailItem label="Longitude" value={selected.gps_lng.toFixed(6)} />
                </>
              )}
              {selected.accuracy && (
                <DetailItem label="Acurácia" value={`${selected.accuracy}m`} />
              )}
              <DetailItem label="GPS Válido" value={selected.gps_valid ? 'Sim' : 'Não'} />
              <DetailItem label="Mock Location" value={selected.is_mock_location ? '⚠️ DETECTADO' : 'Não'} />
              {selected.photo_url && (
                <DetailItem label="Foto" value="📷 Anexada" />
              )}
            </div>

            {selected.is_mock_location && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">GPS Falso Detectado</p>
                  <p className="text-xs text-red-600">Esta presença foi marcada para revisão.</p>
                </div>
              </div>
            )}

            {/* Geofence Visualization */}
            {selected.gps_lat && selected.gps_lng && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Localização do Check-in</h4>
                <div className="bg-gray-100 rounded-lg h-32 flex items-center justify-center">
                  <div className="text-center">
                    <MapPin className="w-8 h-8 text-blue-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-500">
                      {selected.gps_lat.toFixed(6)}, {selected.gps_lng.toFixed(6)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {selected.accuracy ? `±${selected.accuracy}m` : 'Sem acurácia'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="text-xs text-gray-400 space-y-0.5">
              <p>ID: {selected.id}</p>
              <p>Idempotency Key: {selected.idempotency_key}</p>
              <p>Criado em: {formatRelativeTime(selected.created_at)}</p>
              {selected.synced_at && <p>Sincronizado em: {formatDateTime(selected.synced_at)}</p>}
              {selected.offline_created_at && <p>Offline criado em: {formatDateTime(selected.offline_created_at)}</p>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={cn('text-sm font-medium', value.includes('DETECTADO') ? 'text-red-600' : 'text-gray-900')}>{value}</p>
    </div>
  );
}
