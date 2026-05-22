// ============================================================
// OPERACIONAL5 — Página de Postos
// ============================================================

import { useState } from 'react';
import { PageHeader, Card, Badge, DataTable, Modal, Button, Input, SelectField } from '@/components/ui';
import { OperationalStatusBadge } from '@/components/DashboardComponents';
import { useEmployees, usePosts } from '@/hooks';
import { formatDistance } from '@/lib/geo';
import { cn } from '@/lib/utils';
import { MapPin, Building2, Wifi, WifiOff, QrCode, Cpu, Plus, Edit, Eye } from 'lucide-react';
import type { OperationalPostStatus, Post } from '@/lib/types';

export function PostsPage() {
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const { posts, getStatus, loading } = usePosts();
  const { employees } = useEmployees({ active: true });
  const getProfileName = (profileId: string) => employees.find(e => e.id === profileId)?.name ?? 'Não encontrado';

  const columns = [
    {
      key: 'status',
      header: 'Status',
      render: (_: Post) => {
        const s = getStatus(_.id);
        return s ? <OperationalStatusBadge status={s.status} /> : <Badge variant="default">—</Badge>;
      },
    },
    {
      key: 'name',
      header: 'Posto',
      render: (p: Post) => (
        <div>
          <p className="font-medium text-gray-900">{p.name}</p>
          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3" /> {p.address}
          </p>
        </div>
      ),
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
          <button onClick={(e) => { e.stopPropagation(); setSelectedPost(p); }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600">
            <Eye className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
            <Edit className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Postos"
        subtitle={loading ? 'Carregando postos...' : `${posts.length} postos ativos`}
        actions={
          <Button onClick={() => setShowNewModal(true)}>
            <Plus className="w-4 h-4 mr-1" /> Novo Posto
          </Button>
        }
      />

      <Card padding={false}>
        <DataTable
          columns={columns}
          data={posts}
          keyExtractor={p => p.id}
          onRowClick={setSelectedPost}
          emptyMessage={loading ? "Carregando postos..." : "Nenhum posto cadastrado"}
        />
      </Card>

      {/* Post Details Modal */}
      <Modal open={!!selectedPost} onClose={() => setSelectedPost(null)} title="Detalhes do Posto" size="lg">
        {selectedPost && <PostDetails post={selectedPost} getStatus={getStatus} getProfileName={getProfileName} />}
      </Modal>

      {/* New Post Modal */}
      <Modal open={showNewModal} onClose={() => setShowNewModal(false)} title="Novo Posto">
        <div className="space-y-4">
          <Input id="post-name" label="Nome do Posto" placeholder="Ex: Portaria Principal" />
          <Input id="post-address" label="Endereço" placeholder="Ex: Rua Augusta, 500" />
          <div className="grid grid-cols-2 gap-4">
            <Input id="post-lat" label="Latitude" type="number" placeholder="-23.5505" />
            <Input id="post-lng" label="Longitude" type="number" placeholder="-46.6333" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input id="post-radius" label="Raio GPS (m)" type="number" placeholder="50" />
            <Input id="post-min-staff" label="Mín. Vigilantes" type="number" placeholder="1" />
          </div>
          <SelectField
            id="post-client"
            label="Cliente"
            placeholder="Selecione..."
            options={[{ value: 'client-001', label: 'Edifícios Corporativos Plaza' }]}
          />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="post-indoor" className="rounded" />
            <label htmlFor="post-indoor" className="text-sm text-gray-700">Modo Indoor (GPS limitado)</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="post-photo" className="rounded" defaultChecked />
            <label htmlFor="post-photo" className="text-sm text-gray-700">Exigir foto no check-in</label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1">Criar Posto</Button>
            <Button variant="secondary" onClick={() => setShowNewModal(false)}>Cancelar</Button>
          </div>
          <p className="text-xs text-gray-400 text-center">
            ⚠️ Modo demo — dados não são persistidos
          </p>
        </div>
      </Modal>
    </div>
  );
}

function PostDetails({ post, getStatus, getProfileName }: { post: Post; getStatus: (id: string) => OperationalPostStatus | undefined; getProfileName: (id: string) => string }) {
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
