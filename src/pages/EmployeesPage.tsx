// ============================================================
// OPERACIONAL5 — Página de Funcionários
// ============================================================

import { useState } from 'react';
import { PageHeader, Card, Badge, DataTable, Modal, Button, Input, SelectField } from '@/components/ui';
import { Avatar } from '@/components/Layout';
import { DEMO_PROFILES } from '@/lib/mockData';
import { ROLE_LABELS, type Role } from '@/lib/types';
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

  const employees = DEMO_PROFILES.filter(e => e.active);
  const filtered = roleFilter ? employees.filter(e => e.role === roleFilter) : employees;
  const selected = selectedId ? employees.find(e => e.id === selectedId) : null;

  const columns = [
    {
      key: 'name_full',
      header: 'Nome',
      render: (_p: typeof employees[0]) => (
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
      render: (p: typeof employees[0]) => (
        <Badge variant={ROLE_BADGES[p.role]}>{ROLE_LABELS[p.role]}</Badge>
      ),
    },
    {
      key: 'phone',
      header: 'Telefone',
      render: (p: typeof employees[0]) => (
        <span className="text-sm text-gray-600">{p.phone ?? '—'}</span>
      ),
    },
    {
      key: 'ft',
      header: 'FT',
      render: (p: typeof employees[0]) => (
        p.ft_available
          ? <Badge variant="success">Disponível</Badge>
          : <Badge variant="default">—</Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p: typeof employees[0]) => (
        p.active
          ? <span className="flex items-center gap-1 text-sm text-green-600"><UserCheck className="w-3.5 h-3.5" /> Ativo</span>
          : <span className="flex items-center gap-1 text-sm text-gray-400"><UserX className="w-3.5 h-3.5" /> Inativo</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p: typeof employees[0]) => (
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
        subtitle={`${employees.length} funcionários ativos`}
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
            <Button onClick={() => setShowNewModal(true)}>
              <Plus className="w-4 h-4 mr-1" /> Novo
            </Button>
          </div>
        }
      />

      <Card padding={false}>
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={e => e.id}
          onRowClick={e => setSelectedId(e.id)}
          emptyMessage="Nenhum funcionário encontrado"
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
        <div className="space-y-4">
          <Input id="emp-name" label="Nome completo" placeholder="João da Silva" />
          <Input id="emp-email" label="Email" type="email" placeholder="joao@empresa.com" />
          <Input id="emp-phone" label="Telefone" placeholder="(11) 99999-9999" />
          <SelectField
            id="emp-role"
            label="Cargo"
            placeholder="Selecione..."
            options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="emp-ft" className="rounded" />
            <label htmlFor="emp-ft" className="text-sm text-gray-700">Disponível para FT</label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1">Cadastrar</Button>
            <Button variant="secondary" onClick={() => setShowNewModal(false)}>Cancelar</Button>
          </div>
          <p className="text-xs text-gray-400 text-center">⚠️ Modo demo — dados não persistidos</p>
        </div>
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
