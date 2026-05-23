// ============================================================
// OPERACIONAL5 — Página de Funcionários
// ============================================================

import { useState, type FormEvent } from 'react';
import { PageHeader, Card, Badge, DataTable, Modal, Button, Input, SelectField } from '@/components/ui';
import { Avatar } from '@/components/Layout';
import { useEmployees } from '@/hooks';
import { ROLE_LABELS, type Role, type Profile } from '@/lib/types';
import { Users, Plus, Eye, Phone, Mail, MapPin, UserCheck, UserX } from 'lucide-react';

const ROLE_BADGES: Record<Role, 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  admin: 'danger',
  diretor: 'warning',
  gerente: 'info',
  supervisor: 'success',
  lider: 'default',
  operador: 'default',
};

export function EmployeesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const { employees, loading, createEmployee } = useEmployees({ active: true });
  const filtered = roleFilter ? employees.filter(e => e.role === roleFilter) : employees;
  const selected = selectedId ? employees.find(e => e.id === selectedId) : null;

  const handleCreateEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setCreateError(null);
    setCreateSuccess(null);
    setCreating(true);

    try {
      const form = new FormData(formElement);

      const name = String(form.get('name') ?? '').trim();
      const email = String(form.get('email') ?? '').trim();
      const password = String(form.get('password') ?? '');
      const phone = String(form.get('phone') ?? '').trim();
      const role = String(form.get('role') ?? '').trim() as Role;
      const regimeTrabalho = String(form.get('regime_trabalho') ?? '12x36').trim() as Profile['regime_trabalho'];

      if (!name) throw new Error('Informe o nome do funcionário.');
      if (!email) throw new Error('Informe o email do funcionário.');
      if (!password || password.length < 8) throw new Error('Informe uma senha temporária com pelo menos 8 caracteres.');
      if (!role) throw new Error('Selecione o cargo.');

      const employee = await createEmployee({
        name,
        email,
        password,
        phone: phone || undefined,
        role,
        ft_available: form.get('ft_available') === 'on',
        regime_trabalho: regimeTrabalho,
        data_referencia_ciclo: String(form.get('data_referencia_ciclo') || '2024-01-01'),
      });

      formElement.reset();
      setRoleFilter('');
      setCreateSuccess(`Funcionário ${employee.name} cadastrado com sucesso.`);
      setShowNewModal(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Erro ao cadastrar funcionário.');
    } finally {
      setCreating(false);
    }
  };

  const columns = [
    {
      key: 'name_full',
      header: 'Nome',
      render: (_p: Profile) => (
        <div className="flex items-center gap-3">
          <Avatar name={_p.name} />
          <div>
            <p className="font-medium text-gray-900">{_p.name}</p>
            <p className="text-xs text-gray-500">{_p.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Cargo',
      render: (p: Profile) => (
        <Badge variant={ROLE_BADGES[p.role]}>{ROLE_LABELS[p.role]}</Badge>
      ),
    },
    {
      key: 'phone',
      header: 'Telefone',
      render: (p: Profile) => (
        <span className="text-sm text-gray-600">{p.phone ?? '—'}</span>
      ),
    },
    {
      key: 'ft',
      header: 'FT',
      render: (p: Profile) => (
        p.ft_available
          ? <Badge variant="success">Disponível</Badge>
          : <Badge variant="default">—</Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p: Profile) => (
        p.active
          ? <span className="flex items-center gap-1 text-sm text-green-600"><UserCheck className="w-3.5 h-3.5" /> Ativo</span>
          : <span className="flex items-center gap-1 text-sm text-gray-400"><UserX className="w-3.5 h-3.5" /> Inativo</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p: Profile) => (
        <button onClick={(e) => { e.stopPropagation(); setSelectedId(p.id); }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600">
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Funcionários"
        subtitle={loading ? 'Carregando funcionários...' : `${employees.length} funcionários ativos`}
        actions={
          <div className="flex items-center gap-2">
            <SelectField
              id="role-filter"
              placeholder="Todos os cargos"
              options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))}
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="w-40"
            />
            <Button onClick={() => {
              setCreateError(null);
              setCreateSuccess(null);
              setShowNewModal(true);
            }}>
              <Plus className="w-4 h-4 mr-1" /> Novo
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
          keyExtractor={e => e.id}
          onRowClick={e => setSelectedId(e.id)}
          emptyMessage={loading ? "Carregando funcionários..." : "Nenhum funcionário encontrado"}
        />
      </Card>

      {/* Employee Details Modal */}
      <Modal open={!!selected} onClose={() => setSelectedId(null)} title="Detalhes do Funcionário">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={selected.name} size="lg" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selected.name}</h3>
                <Badge variant={ROLE_BADGES[selected.role]}>{ROLE_LABELS[selected.role]}</Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DetailRow icon={<Mail className="w-4 h-4 text-gray-400" />} label="Email" value={selected.email} />
              <DetailRow icon={<Phone className="w-4 h-4 text-gray-400" />} label="Telefone" value={selected.phone} />
              <DetailRow icon={<MapPin className="w-4 h-4 text-gray-400" />} label="Regime" value={selected.regime_trabalho} />
              <DetailRow icon={<Users className="w-4 h-4 text-gray-400" />} label="FT Disponível" value={selected.ft_available ? 'Sim' : 'Não'} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1">
                <Phone className="w-4 h-4 mr-1" /> Ligar
              </Button>
              <Button variant="secondary" className="flex-1">
                <MapPin className="w-4 h-4 mr-1" /> Ver Localização
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* New Employee Modal */}
      <Modal open={showNewModal} onClose={() => setShowNewModal(false)} title="Novo Funcionário">
        <form onSubmit={handleCreateEmployee} className="space-y-4">
          {createError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {createError}
            </div>
          )}

          <Input id="emp-name" name="name" label="Nome completo" placeholder="João da Silva" required />
          <Input id="emp-email" name="email" label="Email de acesso" type="email" placeholder="joao@empresa.com" required />
          <Input id="emp-password" name="password" label="Senha temporária" type="password" placeholder="Mínimo 8 caracteres" minLength={8} required />
          <Input id="emp-phone" name="phone" label="Telefone" placeholder="(11) 99999-9999" />

          <SelectField
            id="emp-role"
            name="role"
            label="Cargo"
            placeholder="Selecione..."
            required
            options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))}
          />

          <SelectField
            id="emp-regime"
            name="regime_trabalho"
            label="Regime de trabalho"
            defaultValue="12x36"
            options={[
              { value: '12x36', label: '12x36' },
              { value: '12x36_noturno', label: '12x36 Noturno' },
              { value: '24x48', label: '24x48' },
              { value: 'custom', label: 'Personalizado' },
            ]}
          />

          <Input
            id="emp-cycle-date"
            name="data_referencia_ciclo"
            label="Data referência do ciclo"
            type="date"
            defaultValue="2024-01-01"
          />

          <div className="flex items-center gap-2">
            <input type="checkbox" id="emp-ft" name="ft_available" className="rounded" />
            <label htmlFor="emp-ft" className="text-sm text-gray-700">Disponível para FT</label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" loading={creating}>Cadastrar</Button>
            <Button type="button" variant="secondary" onClick={() => setShowNewModal(false)}>Cancelar</Button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            O sistema criará o login e o perfil operacional automaticamente.
          </p>
        </form>
      </Modal>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value ?? '—'}</p>
      </div>
    </div>
  );
}
