// ============================================================
// OPERACIONAL5 — Página de Postos
// ============================================================

import { useState, type FormEvent } from 'react';
import { PageHeader, Card, Badge, DataTable, Modal, Button, Input, SelectField } from '@/components/ui';
import { OperationalStatusBadge } from '@/components/DashboardComponents';
import { useClients, useEmployees, usePosts } from '@/hooks';
import { formatDistance } from '@/lib/geo';
import { cn } from '@/lib/utils';
import { MapPin, Building2, Wifi, WifiOff, QrCode, Cpu, Plus, Edit, Eye, Power, RotateCcw, Trash2 } from 'lucide-react';
import type { OperationalPostStatus, Post } from '@/lib/types';

export function PostsPage() {
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const postActiveFilter = activeFilter === 'all' ? 'all' : activeFilter === 'active';
  const {
    posts,
    getStatus,
    loading,
    createPost,
    updatePost,
    deactivatePost,
    reactivatePost,
    deletePost,
  } = usePosts({ active: postActiveFilter });
  const { clients, loading: clientsLoading } = useClients({ active: true });
  const { employees } = useEmployees({ active: true });
  const getProfileName = (profileId: string) => employees.find(e => e.id === profileId)?.name ?? 'Não encontrado';
  const clientOptions = clients.map(client => ({ value: client.id, label: client.name }));
  const getClientName = (clientId: string) => clients.find(client => client.id === clientId)?.name ?? 'Cliente não encontrado';

  const handleCreatePost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);

    try {
      const form = new FormData(event.currentTarget);
      const name = String(form.get('name') ?? '').trim();
      const address = String(form.get('address') ?? '').trim();
      const clientId = String(form.get('client_id') ?? '').trim();
      const nfcUid = String(form.get('nfc_uid') ?? '').trim();

      const lat = Number(form.get('lat'));
      const lng = Number(form.get('lng'));
      const radiusMeters = Number(form.get('radius_meters'));
      const minStaff = Number(form.get('min_staff'));
      const toleranceMinutes = Number(form.get('tolerance_minutes') || 15);
      const rondaIntervalMinutes = Number(form.get('ronda_interval_minutes') || 120);

      if (!name) throw new Error('Informe o nome do posto.');
      if (!address) throw new Error('Informe o endereço do posto.');
      if (!clientId) throw new Error('Selecione o cliente.');
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Latitude e longitude precisam ser números válidos.');
      if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) throw new Error('Raio GPS precisa ser maior que zero.');
      if (!Number.isFinite(minStaff) || minStaff <= 0) throw new Error('Mínimo de vigilantes precisa ser maior que zero.');

      await createPost({
        client_id: clientId,
        name,
        address,
        lat,
        lng,
        radius_meters: radiusMeters,
        min_staff: minStaff,
        tolerance_minutes: toleranceMinutes,
        require_photo: form.get('require_photo') === 'on',
        require_ronda: form.get('require_ronda') === 'on',
        ronda_interval_minutes: rondaIntervalMinutes,
        indoor_mode: form.get('indoor_mode') === 'on',
        nfc_uid: nfcUid || undefined,
        active: true,
      });

      event.currentTarget.reset();
      setShowNewModal(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Erro ao criar posto.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdatePost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingPost) return;

    setUpdateError(null);
    setUpdating(true);

    try {
      const form = new FormData(event.currentTarget);
      const name = String(form.get('name') ?? '').trim();
      const address = String(form.get('address') ?? '').trim();
      const clientId = String(form.get('client_id') ?? '').trim();
      const nfcUid = String(form.get('nfc_uid') ?? '').trim();

      const lat = Number(form.get('lat'));
      const lng = Number(form.get('lng'));
      const radiusMeters = Number(form.get('radius_meters'));
      const minStaff = Number(form.get('min_staff'));
      const toleranceMinutes = Number(form.get('tolerance_minutes') || 15);
      const rondaIntervalMinutes = Number(form.get('ronda_interval_minutes') || 120);

      if (!name) throw new Error('Informe o nome do posto.');
      if (!address) throw new Error('Informe o endereço do posto.');
      if (!clientId) throw new Error('Selecione o cliente.');
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Latitude e longitude precisam ser números válidos.');
      if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) throw new Error('Raio GPS precisa ser maior que zero.');
      if (!Number.isFinite(minStaff) || minStaff <= 0) throw new Error('Mínimo de vigilantes precisa ser maior que zero.');

      await updatePost(editingPost.id, {
        client_id: clientId,
        name,
        address,
        lat,
        lng,
        radius_meters: radiusMeters,
        min_staff: minStaff,
        tolerance_minutes: toleranceMinutes,
        require_photo: form.get('require_photo') === 'on',
        require_ronda: form.get('require_ronda') === 'on',
        ronda_interval_minutes: rondaIntervalMinutes,
        indoor_mode: form.get('indoor_mode') === 'on',
        nfc_uid: nfcUid || undefined,
      });

      setEditingPost(null);
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : 'Erro ao atualizar posto.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeactivatePost = async (post: Post) => {
    if (!window.confirm(`Desativar o posto "${post.name}"? Ele deixará de aparecer nos fluxos operacionais ativos.`)) return;

    setActionLoading(post.id);
    try {
      await deactivatePost(post.id);
      setSelectedPost(current => current?.id === post.id ? { ...current, active: false } : current);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivatePost = async (post: Post) => {
    setActionLoading(post.id);
    try {
      await reactivatePost(post.id);
      setSelectedPost(current => current?.id === post.id ? { ...current, active: true } : current);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeletePost = async (post: Post) => {
    if (!window.confirm(`Excluir definitivamente o posto "${post.name}"? Use apenas para cadastro criado por engano.`)) return;

    setActionLoading(post.id);
    try {
      await deletePost(post.id);
      if (selectedPost?.id === post.id) setSelectedPost(null);
      if (editingPost?.id === post.id) setEditingPost(null);
    } finally {
      setActionLoading(null);
    }
  };

  const columns = [
    {
      key: 'status',
      header: 'Status',
      render: (_: Post) => {
        const s = getStatus(_.id);
        if (!_.active) return <Badge variant="default">Inativo</Badge>;
        return s ? <OperationalStatusBadge status={s.status} /> : <Badge variant="default">—</Badge>;
      },
    },
    {
      key: 'name',
      header: 'Posto',
      render: (p: Post) => (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900">{p.name}</p>
            {!p.active && <Badge variant="default">Inativo</Badge>}
          </div>
          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3" /> {p.address}
          </p>
        </div>
      ),
    },
    {
      key: 'client',
      header: 'Cliente',
      render: (p: Post) => <span className="text-sm text-gray-600">{getClientName(p.client_id)}</span>,
    },
    {
      key: 'staff',
      header: 'Equipe',
      render: (p: Post) => {
        const s = getStatus(p.id);
        return (
          <div className="text-sm">
            <span className="font-medium">{s?.confirmed_count ?? 0}/{p.min_staff}</span>
            <span className="text-gray-400 ml-1">mín.</span>
          </div>
        );
      },
    },
    {
      key: 'radius',
      header: 'Raio GPS',
      render: (p: Post) => (
        <span className="text-sm text-gray-600">{formatDistance(p.radius_meters)}</span>
      ),
    },
    {
      key: 'indoor',
      header: 'Modo',
      render: (p: Post) => (
        <div className="flex items-center gap-1 text-sm">
          {p.indoor_mode ? (
            <><WifiOff className="w-3.5 h-3.5 text-orange-500" /> Indoor</>
          ) : (
            <><Wifi className="w-3.5 h-3.5 text-green-500" /> Outdoor</>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p: Post) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedPost(p); }}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600"
            title="Ver detalhes"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setUpdateError(null);
              setEditingPost(p);
            }}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600"
            title="Editar posto"
          >
            <Edit className="w-4 h-4" />
          </button>
          {p.active ? (
            <button
              onClick={(e) => { e.stopPropagation(); void handleDeactivatePost(p); }}
              disabled={actionLoading === p.id}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-orange-600 disabled:opacity-50"
              title="Desativar posto"
            >
              <Power className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); void handleReactivatePost(p); }}
              disabled={actionLoading === p.id}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-green-600 disabled:opacity-50"
              title="Reativar posto"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); void handleDeletePost(p); }}
            disabled={actionLoading === p.id}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-600 disabled:opacity-50"
            title="Excluir posto"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Postos"
        subtitle={loading ? 'Carregando postos...' : `${posts.length} posto(s) ${activeFilter === 'active' ? 'ativos' : activeFilter === 'inactive' ? 'inativos' : 'no total'}`}
        actions={
          <Button onClick={() => setShowNewModal(true)} disabled={clientsLoading || clientOptions.length === 0}>
            <Plus className="w-4 h-4 mr-1" /> Novo Posto
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Filtrar:</span>
          <Button size="sm" variant={activeFilter === 'active' ? 'primary' : 'secondary'} onClick={() => setActiveFilter('active')}>Ativos</Button>
          <Button size="sm" variant={activeFilter === 'inactive' ? 'primary' : 'secondary'} onClick={() => setActiveFilter('inactive')}>Inativos</Button>
          <Button size="sm" variant={activeFilter === 'all' ? 'primary' : 'secondary'} onClick={() => setActiveFilter('all')}>Todos</Button>
        </div>
      </Card>

      <Card padding={false}>
        <DataTable
          columns={columns}
          data={posts}
          keyExtractor={p => p.id}
          onRowClick={setSelectedPost}
          emptyMessage={loading ? "Carregando postos..." : "Nenhum posto encontrado para o filtro selecionado"}
        />
      </Card>

      {/* Post Details Modal */}
      <Modal open={!!selectedPost} onClose={() => setSelectedPost(null)} title="Detalhes do Posto" size="lg">
        {selectedPost && <PostDetails post={selectedPost} getStatus={getStatus} getProfileName={getProfileName} getClientName={getClientName} />}
      </Modal>


      {/* Edit Post Modal */}
      <Modal open={!!editingPost} onClose={() => setEditingPost(null)} title="Editar Posto">
        {editingPost && (
          <form key={editingPost.id} onSubmit={handleUpdatePost} className="space-y-4">
            {updateError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {updateError}
              </div>
            )}

            <Input id="edit-post-name" name="name" label="Nome do Posto" defaultValue={editingPost.name} required />
            <Input id="edit-post-address" name="address" label="Endereço" defaultValue={editingPost.address} required />

            <div className="grid grid-cols-2 gap-4">
              <Input id="edit-post-lat" name="lat" label="Latitude" type="number" step="any" defaultValue={editingPost.lat} required />
              <Input id="edit-post-lng" name="lng" label="Longitude" type="number" step="any" defaultValue={editingPost.lng} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input id="edit-post-radius" name="radius_meters" label="Raio GPS (m)" type="number" min="1" defaultValue={editingPost.radius_meters} required />
              <Input id="edit-post-min-staff" name="min_staff" label="Mín. Vigilantes" type="number" min="1" defaultValue={editingPost.min_staff} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input id="edit-post-tolerance" name="tolerance_minutes" label="Tolerância (min)" type="number" min="0" defaultValue={editingPost.tolerance_minutes} />
              <Input id="edit-post-ronda-interval" name="ronda_interval_minutes" label="Intervalo ronda (min)" type="number" min="0" defaultValue={editingPost.ronda_interval_minutes} />
            </div>

            <SelectField
              id="edit-post-client"
              name="client_id"
              label="Cliente"
              required
              defaultValue={editingPost.client_id}
              options={clientOptions}
              placeholder={clientsLoading ? 'Carregando clientes...' : 'Selecione...'}
            />
            {clientOptions.length === 0 && !clientsLoading && (
              <p className="text-xs text-red-600">Cadastre um cliente antes de vincular este posto.</p>
            )}

            <Input id="edit-post-nfc" name="nfc_uid" label="NFC UID" placeholder="Ex: 04:A1:B2:C3:D4" defaultValue={editingPost.nfc_uid ?? ''} />

            <div className="flex items-center gap-2">
              <input type="checkbox" id="edit-post-indoor" name="indoor_mode" className="rounded" defaultChecked={editingPost.indoor_mode} />
              <label htmlFor="edit-post-indoor" className="text-sm text-gray-700">Modo Indoor (GPS limitado)</label>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="edit-post-photo" name="require_photo" className="rounded" defaultChecked={editingPost.require_photo} />
              <label htmlFor="edit-post-photo" className="text-sm text-gray-700">Exigir foto ao assumir posto</label>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="edit-post-ronda" name="require_ronda" className="rounded" defaultChecked={editingPost.require_ronda} />
              <label htmlFor="edit-post-ronda" className="text-sm text-gray-700">Exigir ronda</label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" loading={updating}>Salvar Alterações</Button>
              <Button type="button" variant="secondary" onClick={() => setEditingPost(null)}>Cancelar</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* New Post Modal */}
      <Modal open={showNewModal} onClose={() => setShowNewModal(false)} title="Novo Posto">
        <form onSubmit={handleCreatePost} className="space-y-4">
          {createError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {createError}
            </div>
          )}

          <Input id="post-name" name="name" label="Nome do Posto" placeholder="Ex: Portaria Principal" required />
          <Input id="post-address" name="address" label="Endereço" placeholder="Ex: Rua Augusta, 500" required />

          <div className="grid grid-cols-2 gap-4">
            <Input id="post-lat" name="lat" label="Latitude" type="number" step="any" placeholder="-23.5505" required />
            <Input id="post-lng" name="lng" label="Longitude" type="number" step="any" placeholder="-46.6333" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input id="post-radius" name="radius_meters" label="Raio GPS (m)" type="number" min="1" placeholder="50" defaultValue="80" required />
            <Input id="post-min-staff" name="min_staff" label="Mín. Vigilantes" type="number" min="1" placeholder="1" defaultValue="1" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input id="post-tolerance" name="tolerance_minutes" label="Tolerância (min)" type="number" min="0" defaultValue="15" />
            <Input id="post-ronda-interval" name="ronda_interval_minutes" label="Intervalo ronda (min)" type="number" min="0" defaultValue="120" />
          </div>

          <SelectField
            id="post-client"
            name="client_id"
            label="Cliente"
            placeholder={clientsLoading ? 'Carregando clientes...' : 'Selecione...'}
            required
            options={clientOptions}
          />
          {clientOptions.length === 0 && !clientsLoading && (
            <p className="text-xs text-red-600">Cadastre um cliente na página Clientes antes de criar um posto.</p>
          )}

          <Input id="post-nfc" name="nfc_uid" label="NFC UID" placeholder="Opcional — tag NFC física do posto" />

          <div className="flex items-center gap-2">
            <input type="checkbox" id="post-indoor" name="indoor_mode" className="rounded" />
            <label htmlFor="post-indoor" className="text-sm text-gray-700">Modo Indoor (GPS limitado)</label>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="post-photo" name="require_photo" className="rounded" defaultChecked />
            <label htmlFor="post-photo" className="text-sm text-gray-700">Exigir foto ao assumir posto</label>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="post-ronda" name="require_ronda" className="rounded" defaultChecked />
            <label htmlFor="post-ronda" className="text-sm text-gray-700">Exigir ronda</label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" loading={creating}>Criar Posto</Button>
            <Button type="button" variant="secondary" onClick={() => setShowNewModal(false)}>Cancelar</Button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Dados serão salvos no Supabase real quando o modo real estiver ativo.
          </p>
        </form>
      </Modal>
    </div>
  );
}

function PostDetails({ post, getStatus, getProfileName, getClientName }: { post: Post; getStatus: (id: string) => OperationalPostStatus | undefined; getProfileName: (id: string) => string; getClientName: (id: string) => string }) {
  const status = getStatus(post.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{post.name}</h3>
            <p className="text-sm text-gray-500">{post.address}</p>
          </div>
        </div>
        {status && <OperationalStatusBadge status={status.status} />}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <InfoItem label="Cliente" icon={<Building2 className="w-4 h-4" />}>
          {getClientName(post.client_id)}
        </InfoItem>
        <InfoItem label="Cadastro" icon={<Power className="w-4 h-4" />}>
          {post.active ? 'Ativo' : 'Inativo'}
        </InfoItem>
        <InfoItem label="GPS" icon={<MapPin className="w-4 h-4" />}>
          {post.lat.toFixed(4)}, {post.lng.toFixed(4)}
        </InfoItem>
        <InfoItem label="Raio" icon={<MapPin className="w-4 h-4" />}>
          {formatDistance(post.radius_meters)}
        </InfoItem>
        <InfoItem label="Mín. Equipe" icon={<MapPin className="w-4 h-4" />}>
          {post.min_staff} vigilante(s)
        </InfoItem>
        <InfoItem label="Tolerância" icon={<MapPin className="w-4 h-4" />}>
          {post.tolerance_minutes} min
        </InfoItem>
        <InfoItem label="Modo" icon={post.indoor_mode ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}>
          {post.indoor_mode ? 'Indoor' : 'Outdoor'}
        </InfoItem>
        <InfoItem label="Foto obrigatória" icon={<MapPin className="w-4 h-4" />}>
          {post.require_photo ? 'Sim' : 'Não'}
        </InfoItem>
      </div>

      <div className="pt-3 border-t border-gray-100">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><QrCode className="w-3 h-3" /> QR Token</p>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded">{post.qr_code_token}</code>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1"><Cpu className="w-3 h-3" /> NFC UID</p>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded">{post.nfc_uid || 'Não configurado'}</code>
          </div>
        </div>
      </div>

      {status && (
        <div className="pt-3 border-t border-gray-100">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Status Atual</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Presentes</span>
              <span className="font-medium text-green-700">{status.employees_present.join(', ') || 'Nenhum'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Ausentes</span>
              <span className="font-medium text-red-700">{status.employees_missing.join(', ') || 'Nenhum'}</span>
            </div>
            {status.supervisor_name && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Supervisor</span>
                <span className="font-medium">{getProfileName(status.supervisor_id ?? '')}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-0.5 flex items-center gap-1">
        {icon} {label}
      </p>
      <p className={cn('text-sm text-gray-900')}>{children}</p>
    </div>
  );
}
