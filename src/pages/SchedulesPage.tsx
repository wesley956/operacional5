// ============================================================
// OPERACIONAL5 — Página de Escalas
// ============================================================

import { useState, type FormEvent } from 'react';
import { PageHeader, Card, Badge, DataTable, Modal, Button, Input, SelectField } from '@/components/ui';
import { Avatar } from '@/components/Layout';
import { useEmployees, usePosts, useSchedules } from '@/hooks';
import { formatDateTime, formatDate } from '@/lib/utils';
import { ROLE_LABELS, type RegimeTrabalho } from '@/lib/types';
import { CalendarDays, Plus, AlertTriangle, Clock } from 'lucide-react';



function getDayStart(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysBetween(start: Date, end: Date): number {
  const startDay = getDayStart(start).getTime();
  const endDay = getDayStart(end).getTime();
  return Math.floor((endDay - startDay) / 86400000);
}

function isPlannedWorkDay(schedule: { regime: string; cycle_reference_date: string; shift_start: string }, date: Date): boolean {
  const target = getDayStart(date);
  const reference = getDayStart(new Date(schedule.cycle_reference_date || schedule.shift_start));
  const diff = daysBetween(reference, target);

  if (diff < 0) return false;

  if (schedule.regime === '12x36' || schedule.regime === '12x36_noturno') {
    return diff % 2 === 0;
  }

  if (schedule.regime === '24x48') {
    return diff % 3 === 0;
  }

  const shiftStart = getDayStart(new Date(schedule.shift_start));
  return shiftStart.getTime() === target.getTime();
}

function getPlannedShiftTimes(schedule: { shift_start: string; shift_end: string }, date: Date): { start: Date; end: Date } {
  const originalStart = new Date(schedule.shift_start);
  const originalEnd = new Date(schedule.shift_end);
  const durationMs = originalEnd.getTime() - originalStart.getTime();

  const start = new Date(date);
  start.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);

  const end = new Date(start.getTime() + durationMs);
  return { start, end };
}


function toDateTimeLocalValue(date: Date): string {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 16);
}

const REGIME_LABELS: Record<RegimeTrabalho, string> = {
  '12x36': '12x36 Diurno',
  '12x36_noturno': '12x36 Noturno',
  '24x48': '24x48',
  custom: 'Personalizado',
};

export function SchedulesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [calendarRangeDays, setCalendarRangeDays] = useState<'7' | '14' | '30'>('7');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [postFilter, setPostFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const { schedules, loading, createSchedule } = useSchedules();
  const { employees } = useEmployees({ active: true });
  const { posts } = usePosts();

  const getProfileName = (profileId: string) => employees.find(e => e.id === profileId)?.name ?? 'Não encontrado';
  const getPostName = (postId: string) => posts.find(p => p.id === postId)?.name ?? 'Posto não encontrado';
  const selected = selectedId ? schedules.find(s => s.id === selectedId) : null;
  const selectedEmployee = selectedEmployeeId ? employees.find(e => e.id === selectedEmployeeId) : null;
  const selectedEmployeeSchedules = selectedEmployeeId
    ? schedules
        .filter(s => s.employee_id === selectedEmployeeId)
        .sort((a, b) => new Date(a.shift_start).getTime() - new Date(b.shift_start).getTime())
    : [];

  const normalizedEmployeeSearch = employeeSearch.trim().toLowerCase();
  const filteredSchedules = schedules.filter(schedule => {
    const employeeName = getProfileName(schedule.employee_id).toLowerCase();
    const matchesEmployee = !normalizedEmployeeSearch || employeeName.includes(normalizedEmployeeSearch);
    const matchesPost = !postFilter || schedule.post_id === postFilter;
    return matchesEmployee && matchesPost;
  });

  const todayStart = new Date();
  todayStart.setHours(6, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(18, 0, 0, 0);

  const handleCreateSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setCreateError(null);
    setCreateSuccess(null);
    setCreating(true);

    try {
      const form = new FormData(formElement);

      const employeeId = String(form.get('employee_id') ?? '').trim();
      const postId = String(form.get('post_id') ?? '').trim();
      const regime = String(form.get('regime') ?? '').trim() as RegimeTrabalho;
      const shiftStartValue = String(form.get('shift_start') ?? '').trim();
      const shiftEndValue = String(form.get('shift_end') ?? '').trim();
      const cycleReferenceDate = String(form.get('cycle_reference_date') || shiftStartValue.slice(0, 10));

      if (!employeeId) throw new Error('Selecione o funcionário.');
      if (!postId) throw new Error('Selecione o posto.');
      if (!regime) throw new Error('Selecione o regime.');
      if (!shiftStartValue) throw new Error('Informe o início do turno.');
      if (!shiftEndValue) throw new Error('Informe o fim do turno.');

      const shiftStart = new Date(shiftStartValue);
      const shiftEnd = new Date(shiftEndValue);

      if (Number.isNaN(shiftStart.getTime()) || Number.isNaN(shiftEnd.getTime())) {
        throw new Error('Datas do turno inválidas.');
      }

      if (shiftStart >= shiftEnd) {
        throw new Error('O fim do turno precisa ser depois do início.');
      }

      const created = await createSchedule({
        post_id: postId,
        employee_id: employeeId,
        shift_start: shiftStart.toISOString(),
        shift_end: shiftEnd.toISOString(),
        regime,
        cycle_reference_date: cycleReferenceDate,
        weekdays: undefined,
        template_id: undefined,
        is_active: true,
        status: 'active',
      });

      formElement.reset();
      setCreateSuccess(`Escala criada para ${getProfileName(created.employee_id)}.`);
      setShowNewModal(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Erro ao criar escala.');
    } finally {
      setCreating(false);
    }
  };

  const columns = [
    {
      key: 'employee',
      header: 'Funcionário',
      render: (_: typeof schedules[0]) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setSelectedEmployeeId(_.employee_id);
          }}
          className="flex items-center gap-2 text-left hover:bg-blue-50 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors"
          title="Ver escala completa do funcionário"
        >
          <Avatar name={getProfileName(_.employee_id)} size="sm" />
          <div>
            <p className="font-medium text-gray-900">{getProfileName(_.employee_id)}</p>
            <p className="text-xs text-gray-500">{ROLE_LABELS[employees.find(p => p.id === _.employee_id)?.role ?? 'operador']}</p>
          </div>
        </button>
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
        subtitle={loading ? 'Carregando escalas...' : `${filteredSchedules.length}/${schedules.length} escalas exibidas`}
        actions={
          <Button onClick={() => {
            setCreateError(null);
            setCreateSuccess(null);
            setShowNewModal(true);
          }}>
            <Plus className="w-4 h-4 mr-1" /> Nova Escala
          </Button>
        }
      />

      {createSuccess && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {createSuccess}
        </div>
      )}

      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            id="schedule-employee-search"
            label="Buscar funcionário"
            placeholder="Digite o nome..."
            value={employeeSearch}
            onChange={e => setEmployeeSearch(e.target.value)}
          />

          <SelectField
            id="schedule-post-filter"
            label="Filtrar por posto"
            placeholder="Todos os postos"
            value={postFilter}
            onChange={e => setPostFilter(e.target.value)}
            options={posts.map(post => ({ value: post.id, label: post.name }))}
          />

          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                setEmployeeSearch('');
                setPostFilter('');
              }}
            >
              Limpar filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Schedule Calendar */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Calendário de Escalas</h3>
              <p className="text-xs text-gray-500">
                Visualização dos próximos {calendarRangeDays} dias
              </p>
            </div>
          </div>

          <SelectField
            id="schedule-calendar-range"
            value={calendarRangeDays}
            onChange={e => setCalendarRangeDays(e.target.value as '7' | '14' | '30')}
            className="w-full sm:w-40"
            options={[
              { value: '7', label: '7 dias' },
              { value: '14', label: '14 dias' },
              { value: '30', label: '30 dias' },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {Array.from({ length: Number(calendarRangeDays) }, (_, i) => {
            const date = new Date();
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() + i);

            const daySchedules = filteredSchedules.filter(s =>
              s.is_active && isPlannedWorkDay(s, date)
            );

            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div
                key={date.toISOString()}
                className={`min-h-24 p-2 rounded-lg text-center text-xs ${
                  isToday ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                }`}
              >
                <p className="font-medium text-gray-600">
                  {date.toLocaleDateString('pt-BR', { weekday: 'short' })}
                </p>
                <p className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                  {date.getDate()}
                </p>
                <p className="text-[10px] text-gray-400">
                  {date.toLocaleDateString('pt-BR', { month: 'short' })}
                </p>

                {daySchedules.length > 0 ? (
                  <div className="mt-1 space-y-0.5">
                    {daySchedules.map(s => {
                      const planned = getPlannedShiftTimes(s, date);

                      return (
                        <div
                          key={`${s.id}-${date.toISOString()}`}
                          className="bg-green-100 text-green-700 rounded px-1 py-0.5 truncate"
                          title={`${getProfileName(s.employee_id)} — ${getPostName(s.post_id)} — ${planned.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} às ${planned.end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                        >
                          {getProfileName(s.employee_id).split(' ')[0]}
                        </div>
                      );
                    })}
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
          data={filteredSchedules}
          keyExtractor={s => s.id}
          onRowClick={s => setSelectedId(s.id)}
          emptyMessage={loading ? "Carregando escalas..." : "Nenhuma escala encontrada para os filtros atuais"}
        />
      </Card>

      {/* Employee Full Schedule */}
      <Modal
        open={!!selectedEmployee}
        onClose={() => setSelectedEmployeeId(null)}
        title={selectedEmployee ? `Escala completa — ${selectedEmployee.name}` : 'Escala completa'}
        size="lg"
      >
        {selectedEmployee && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={selectedEmployee.name} size="lg" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedEmployee.name}</h3>
                <p className="text-sm text-gray-500">{ROLE_LABELS[selectedEmployee.role]}</p>
              </div>
            </div>

            {selectedEmployeeSchedules.length > 0 ? (
              <div className="space-y-2">
                {selectedEmployeeSchedules.map(schedule => (
                  <div key={schedule.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{getPostName(schedule.post_id)}</p>
                        <p className="text-xs text-gray-500">
                          {formatDateTime(schedule.shift_start)} — {formatDateTime(schedule.shift_end)}
                        </p>
                      </div>
                      <Badge variant={schedule.is_active ? 'success' : 'default'}>
                        {schedule.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="info">{REGIME_LABELS[schedule.regime as RegimeTrabalho] ?? schedule.regime}</Badge>
                      <Badge variant="default">Ciclo: {formatDate(schedule.cycle_reference_date)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Nenhuma escala encontrada para este funcionário.</p>
            )}
          </div>
        )}
      </Modal>

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
        <form onSubmit={handleCreateSchedule} className="space-y-4">
          {createError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {createError}
            </div>
          )}

          <SelectField
            id="sched-employee"
            name="employee_id"
            label="Funcionário"
            placeholder="Selecione..."
            required
            options={employees
              .filter(p => ['operador', 'lider'].includes(p.role))
              .map(p => ({ value: p.id, label: `${p.name} — ${ROLE_LABELS[p.role]}` }))}
          />

          <SelectField
            id="sched-post"
            name="post_id"
            label="Posto"
            placeholder="Selecione..."
            required
            options={posts.map(p => ({ value: p.id, label: p.name }))}
          />

          <SelectField
            id="sched-regime"
            name="regime"
            label="Regime"
            placeholder="Selecione..."
            required
            defaultValue="12x36"
            options={Object.entries(REGIME_LABELS).map(([value, label]) => ({ value, label }))}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="sched-start"
              name="shift_start"
              label="Início do turno"
              type="datetime-local"
              defaultValue={toDateTimeLocalValue(todayStart)}
              required
            />
            <Input
              id="sched-end"
              name="shift_end"
              label="Fim do turno"
              type="datetime-local"
              defaultValue={toDateTimeLocalValue(todayEnd)}
              required
            />
          </div>

          <Input
            id="sched-cycle-date"
            name="cycle_reference_date"
            label="Data referência do ciclo"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />

          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <p className="text-xs text-yellow-700">
              A escala será salva no Supabase real e usada nos fluxos de presença, ausência e FT.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" loading={creating}>Criar Escala</Button>
            <Button type="button" variant="secondary" onClick={() => setShowNewModal(false)}>Cancelar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
