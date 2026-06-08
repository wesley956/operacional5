// ============================================================
// OPERACIONAL5 — Página de Clientes
// ============================================================

import { useState, type FormEvent } from 'react';
import { PageHeader, Card, Badge, DataTable, Modal, Button, Input, Textarea } from '@/components/ui';
import { useClients, usePosts } from '@/hooks';
import { Building2, Edit, Eye, Mail, MapPin, Phone, Plus, User } from 'lucide-react';
import type { Client } from '@/lib/types';

function valueFromForm(form: FormData, key: string): string | undefined {
  const value = String(form.get(key) ?? '').trim();
  return value || undefined;
}

function ClientForm({
  client,
  error,
  loading,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  client?: Client;
  error: string | null;
  loading: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Input id="client-name" name="name" label="Nome do Cliente" defaultValue={client?.name ?? ''} required />
      <Input id="client-cnpj" name="cnpj" label="CNPJ" defaultValue={client?.cnpj ?? ''} placeholder="00.000.000/0000-00" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input id="client-contact-name" name="contact_name" label="Responsável" defaultValue={client?.contact_name ?? ''} />
        <Input id="client-contact-phone" name="contact_phone" label="Telefone" defaultValue={client?.contact_phone ?? ''} />
      </div>

      <Input id="client-contact-email" name="contact_email" label="E-mail" type="email" defaultValue={client?.contact_email ?? ''} />
      <Input id="client-address" name="address" label="Endereço" defaultValue={client?.address ?? ''} />
      <Textarea id="client-notes" name="notes" label="Observações" defaultValue={client?.notes ?? ''} rows={3} />

      <div className="flex items-center gap-2">
        <input type="checkbox" id="client-active" name="active" className="rounded" defaultChecked={client?.active ?? true} />
        <label htmlFor="client-active" className="text-sm text-gray-700">Cliente ativo</label>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1" loading={loading}>{submitLabel}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}

function ClientDetails({ client, postCount }: { client: Client; postCount: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{client.name}</h3>
            <p className="text-sm text-gray-500">{client.cnpj || 'CNPJ não informado'}</p>
          </div>
        </div>
        <Badge variant={client.active ? 'success' : 'default'}>{client.active ? 'Ativo' : 'Inativo'}</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InfoItem label="Responsável" icon={<User className="w-4 h-4" />}>
          {client.contact_name || 'Não informado'}
        </InfoItem>
        <InfoItem label="Telefone" icon={<Phone className="w-4 h-4" />}>
          {client.contact_phone || 'Não informado'}
        </InfoItem>
        <InfoItem label="E-mail" icon={<Mail className="w-4 h-4" />}>
          {client.contact_email || 'Não informado'}
        </InfoItem>
        <InfoItem label="Postos vinculados" icon={<Building2 className="w-4 h-4" />}>
          {postCount}
        </InfoItem>
      </div>

      <div className="pt-3 border-t border-gray-100">
        <InfoItem label="Endereço" icon={<MapPin className="w-4 h-4" />}>
          {client.address || 'Não informado'}
        </InfoItem>
      </div>

      {client.notes && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-1">Observações</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{client.notes}</p>
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
      <p className="text-sm text-gray-900">{children}</p>
    </div>
  );
}

export function ClientsPage() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const { clients, loading, createClient, updateClient } = useClients({ active: true });
  const { posts } = usePosts();

  const postCountByClient = (clientId: string) => posts.filter(post => post.client_id === clientId).length;

  async function handleCreateClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);

    try {
      const form = new FormData(event.currentTarget);
      const name = String(form.get('name') ?? '').trim();
      if (!name) throw new Error('Informe o nome do cliente.');

      await createClient({
        name,
        cnpj: valueFromForm(form, 'cnpj'),
        contact_name: valueFromForm(form, 'contact_name'),
        contact_phone: valueFromForm(form, 'contact_phone'),
        contact_email: valueFromForm(form, 'contact_email'),
        address: valueFromForm(form, 'address'),
        notes: valueFromForm(form, 'notes'),
        active: form.get('active') === 'on',
      });

      event.currentTarget.reset();
      setShowNewModal(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Erro ao criar cliente.');
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingClient) return;

    setUpdateError(null);
    setUpdating(true);

    try {
      const form = new FormData(event.currentTarget);
      const name = String(form.get('name') ?? '').trim();
      if (!name) throw new Error('Informe o nome do cliente.');

      await updateClient(editingClient.id, {
        name,
        cnpj: valueFromForm(form, 'cnpj'),
        contact_name: valueFromForm(form, 'contact_name'),
        contact_phone: valueFromForm(form, 'contact_phone'),
        contact_email: valueFromForm(form, 'contact_email'),
        address: valueFromForm(form, 'address'),
        notes: valueFromForm(form, 'notes'),
        active: form.get('active') === 'on',
      });

      setEditingClient(null);
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : 'Erro ao atualizar cliente.');
    } finally {
      setUpdating(false);
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Cliente',
      render: (client: Client) => (
        <div>
          <p className="font-medium text-gray-900">{client.name}</p>
          <p className="text-xs text-gray-500">{client.cnpj || 'CNPJ não informado'}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contato',
      render: (client: Client) => (
        <div className="text-sm">
          <p className="text-gray-700">{client.contact_name || 'Responsável não informado'}</p>
          <p className="text-xs text-gray-500">{client.contact_phone || client.contact_email || 'Sem contato'}</p>
        </div>
      ),
    },
    {
      key: 'posts',
      header: 'Postos',
      render: (client: Client) => <span className="text-sm font-medium">{postCountByClient(client.id)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (client: Client) => <Badge variant={client.active ? 'success' : 'default'}>{client.active ? 'Ativo' : 'Inativo'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      render: (client: Client) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setSelectedClient(client); }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600" title="Ver cliente">
            <Eye className="w-4 h-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setUpdateError(null); setEditingClient(client); }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600" title="Editar cliente">
            <Edit className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={loading ? 'Carregando clientes...' : `${clients.length} clientes ativos`}
        actions={
          <Button onClick={() => { setCreateError(null); setShowNewModal(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Novo Cliente
          </Button>
        }
      />

      <Card padding={false}>
        <DataTable
          columns={columns}
          data={clients}
          keyExtractor={client => client.id}
          onRowClick={setSelectedClient}
          emptyMessage={loading ? 'Carregando clientes...' : 'Nenhum cliente cadastrado'}
        />
      </Card>

      <Modal open={showNewModal} onClose={() => setShowNewModal(false)} title="Novo Cliente">
        <ClientForm
          error={createError}
          loading={creating}
          submitLabel="Criar Cliente"
          onCancel={() => setShowNewModal(false)}
          onSubmit={handleCreateClient}
        />
      </Modal>

      <Modal open={!!editingClient} onClose={() => setEditingClient(null)} title="Editar Cliente">
        {editingClient && (
          <ClientForm
            client={editingClient}
            error={updateError}
            loading={updating}
            submitLabel="Salvar Alterações"
            onCancel={() => setEditingClient(null)}
            onSubmit={handleUpdateClient}
          />
        )}
      </Modal>

      <Modal open={!!selectedClient} onClose={() => setSelectedClient(null)} title="Detalhes do Cliente" size="lg">
        {selectedClient && <ClientDetails client={selectedClient} postCount={postCountByClient(selectedClient.id)} />}
      </Modal>
    </div>
  );
}
