// ============================================================
// OPERACIONAL5 — Página de Escalas
// ============================================================

import { useState } from 'react';
import { PageHeader, Card, Badge, DataTable, Modal, Button, SelectField } from '@/components/ui';
import { Avatar } from '@/components/Layout';
import { useEmployees, usePosts, useSchedules } from '@/hooks';
import { formatDateTime, formatDate } from '@/lib/utils';
import { ROLE_LABELS, type RegimeTrabalho } from '@/lib/types';
import { CalendarDays, Plus, AlertTriangle, Clock } from 'lucide-react';

const REGIME_LABELS: Record<RegimeTrabalho, string> = {
  '12x36': '12x36 Diurno',
  '12x36_noturno': '12x36 Noturno',
  '24x48': '24x48',
  custom: 'Personalizado',
};

export function SchedulesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const { schedules, loading } = useSchedules();
  void loading;
  const { employees } = useEmployees({ active: true });
  const { posts } = usePosts();

  const getProfileName = (profileId: string) => employees.find(e => e.id === profileId)?.name ?? 'Não encontrado';
  const getPostName = (postId: string) => posts.find(p => p.id === postId)?.name ?? 'Posto não encontrado';
  const selected = selectedId ? schedules.find(s => s.id === selectedId) : null;

  const columns = [
    {
      key: 'employee',
      header: 'Funcionário',
      render: (_: typeof schedules[0]) => (
        <div className="flex items-center gap-2">
          <Avatar name={getProfileName(_.employee_id)} size="sm" />
          <div>
            <p className="font-medium text-gray-900">{getProfileName(_.employee_id)}</p>
            <p className="text-xs text-gray-500">{ROLE_LABELS[employees.find(p => p.id === _.employee_id)?.role ?? 'operador']}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'post',
      header: 'Posto',
      render: (_: typeof schedules[0]) => (
        <span className="text-sm text-gray-700">{getPostName(_.post_id)}</span>
      ),
    },
    {
      key: 'shift',
      header: 'Turno',
      render: (_: typeof schedules[0]) => (
        <div className="text-sm">
          <p className="font-medium text-gray-900">
            {new Date(_.shift_start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            {' — '}
            {new Date(_.shift_end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-xs text-gray-400">{formatDate(_.shift_start)}</p>
        </div>
      ),
    },
    {
      key: 'regime',
      header: 'Regime',
      render: (_: typeof schedules[0]) => (
        <Badge variant="info">{REGIME_LABELS[_.regime as RegimeTrabalho] ?? _.regime}</Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (_: typeof schedules[0]) => (
        _.is_active
          ? <Badge variant="success">Ativa</Badge>
          : <Badge variant="default">Inativa</Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Escalas"
        subtitle={`${schedules.length} escalas ativas`}
        actions={
          <Button onClick={() => setShowNewModal(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nova Escala
          </Button>
        }
      />

      {/* 12x36 Cycle Info */}
      <Card className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <CalendarDays className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Ciclo 12x36</h3>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - date.getDay() + i);
            const daySchedules = schedules.filter(s => {
              const start = new Date(s.shift_start);
              return start.toDateString() === date.toDateString();
            });
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div
                key={i}
                className={`p-2 rounded-lg text-center text-xs ${
                  isToday ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                }`}
              >
                <p className="font-medium text-gray-600">
                  {date.toLocaleDateString('pt-BR', { weekday: 'short' })}
                </p>
                <p className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                  {date.getDate()}
                </p>
                {daySchedules.length > 0 ? (
                  <div className="mt-1 space-y-0.5">
                    {daySchedules.map(s => (
                      <div key={s.id} className="bg-green-100 text-green-700 rounded px-1 py-0.5 truncate">
                        {getProfileName(s.employee_id).split(' ')[0]}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 mt-1">—</p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card padding={false}>
        <DataTable
          columns={columns}
          data={schedules}
          keyExtractor={s => s.id}
          onRowClick={s => setSelectedId(s.id)}
          emptyMessage="Nenhuma escala encontrada"
        />
      </Card>

      {/* Schedule Detail */}
      <Modal open={!!selected} onClose={() => setSelectedId(null)} title="Detalhes da Escala">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={getProfileName(selected.employee_id)} size="lg" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{getProfileName(selected.employee_id)}</h3>
                <Badge variant="info">{REGIME_LABELS[selected.regime as RegimeTrabalho] ?? selected.regime}</Badge>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">Posto</p>
                <p className="text-sm font-medium text-gray-900">{getPostName(selected.post_id)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <p className="text-sm font-medium text-gray-900">{selected.is_active ? 'Ativa' : 'Inativa'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Início do turno</p>
                <p className="text-sm font-medium text-gray-900">{formatDateTime(selected.shift_start)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Fim do turno</p>
                <p className="text-sm font-medium text-gray-900">{formatDateTime(selected.shift_end)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Data referência ciclo</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(selected.cycle_reference_date)}</p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">Ciclo 12x36</p>
                <p className="text-xs text-yellow-600">
                  O operador trabalha 12h e folga 36h em ciclo contínuo.
                  Data de referência: {formatDate(selected.cycle_reference_date)}.
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* New Schedule Modal */}
      <Modal open={showNewModal} onClose={() => setShowNewModal(false)} title="Nova Escala">
        <div className="space-y-4">
          <SelectField
            id="sched-employee"
            label="Funcionário"
            placeholder="Selecione..."
            options={employees.filter(p => p.role === 'operador').map(p => ({
              value: p.id, label: p.name,
            }))}
          />
          <SelectField
            id="sched-post"
            label="Posto"
            placeholder="Selecione..."
            options={posts.map(p => ({ value: p.id, label: p.name }))}
          />
          <SelectField
            id="sched-regime"
            label="Regime"
            placeholder="Selecione..."
            options={Object.entries(REGIME_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <p className="text-xs text-yellow-700">
              A escala 12x36 é calculada automaticamente a partir da data de referência do ciclo do funcionário.
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1">Criar Escala</Button>
            <Button variant="secondary" onClick={() => setShowNewModal(false)}>Cancelar</Button>
          </div>
          <p className="text-xs text-gray-400 text-center">⚠️ Modo demo</p>
        </div>
      </Modal>
    </div>
  );
}
