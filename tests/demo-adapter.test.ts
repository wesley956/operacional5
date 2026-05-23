import { describe, expect, it } from 'vitest';
import { createDemoAdapter } from '../src/lib/data/adapters/demo-adapter';
import { DEMO_IDS } from '../src/lib/mockData';

function uniqueKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

describe('DemoAdapter', () => {
  it('lista posts ativos e busca status operacional', async () => {
    const dp = createDemoAdapter();

    const posts = await dp.posts.list();
    const statuses = await dp.posts.getOperationalStatuses();

    expect(posts.length).toBeGreaterThan(0);
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses[0]).toHaveProperty('post_id');
    expect(statuses[0]).toHaveProperty('status');
  });

  it('filtra funcionários ativos e candidatos disponíveis para FT', async () => {
    const dp = createDemoAdapter();

    const activeEmployees = await dp.employees.list({ active: true });
    const candidates = await dp.employees.getAvailableForFT();

    expect(activeEmployees.length).toBeGreaterThan(0);
    expect(candidates.every(candidate => candidate.active && candidate.ft_available)).toBe(true);
  });

  it('confirma presença via GPS válido e respeita idempotência', async () => {
    const dp = createDemoAdapter();
    const post = (await dp.posts.list())[0];
    const employee = (await dp.employees.list({ active: true }))[0];
    const idempotencyKey = uniqueKey('presence');

    const first = await dp.presence.confirm({
      employee_id: employee.id,
      post_id: post.id,
      method: 'gps',
      lat: post.lat,
      lng: post.lng,
      accuracy: 10,
      idempotency_key: idempotencyKey,
    });

    const second = await dp.presence.confirm({
      employee_id: employee.id,
      post_id: post.id,
      method: 'gps',
      lat: post.lat,
      lng: post.lng,
      accuracy: 10,
      idempotency_key: idempotencyKey,
    });

    expect(first.success).toBe(true);
    expect(first.presence?.status).toBe('valid');
    expect(second.success).toBe(true);
    expect(second.presence?.id).toBe(first.presence?.id);
  });

  it('rejeita presença por QR inválido', async () => {
    const dp = createDemoAdapter();
    const post = (await dp.posts.list())[0];
    const employee = (await dp.employees.list({ active: true }))[0];

    const result = await dp.presence.confirm({
      employee_id: employee.id,
      post_id: post.id,
      method: 'qr',
      qr_code_token: 'qr-invalido',
      idempotency_key: uniqueKey('presence-invalid-qr'),
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('rejected');
  });

  it('cria, reconhece e resolve ocorrência', async () => {
    const dp = createDemoAdapter();
    const post = (await dp.posts.list())[0];
    const employee = (await dp.employees.list({ active: true }))[0];

    const occurrence = await dp.occurrences.create({
      post_id: post.id,
      employee_id: employee.id,
      type: 'outro',
      severity: 'media',
      description: 'Teste automatizado',
      idempotency_key: uniqueKey('occurrence'),
    });

    expect(occurrence.status).toBe('aberta');

    const acknowledged = await dp.occurrences.acknowledge(occurrence.id, 'supervisor');
    expect(acknowledged.status).toBe('em_tratamento');

    const resolved = await dp.occurrences.resolve(occurrence.id, employee.id);
    expect(resolved.status).toBe('resolvida');
    expect(resolved.resolved_by).toBe(employee.id);
  });

  it('aciona e encerra SOS', async () => {
    const dp = createDemoAdapter();
    const post = (await dp.posts.list())[0];
    const employee = (await dp.employees.list({ active: true }))[0];

    const sos = await dp.sos.trigger({
      post_id: post.id,
      employee_id: employee.id,
      lat: post.lat,
      lng: post.lng,
      idempotency_key: uniqueKey('sos'),
    });

    const active = await dp.sos.getActive();
    const closed = await dp.sos.close(sos.id, employee.id, 'Resolvido em teste');

    expect(sos.type).toBe('sos');
    expect(sos.severity).toBe('critica');
    expect(active.some(item => item.id === sos.id)).toBe(true);
    expect(closed.status).toBe('resolvida');
  });

  it('executa ciclo básico de FT', async () => {
    const dp = createDemoAdapter();
    const post = (await dp.posts.list())[0];
    const supervisor = (await dp.employees.list({ role: 'supervisor', active: true }))[0];
    const candidate = (await dp.employees.getAvailableForFT())[0];

    const ft = await dp.ft.open({
      post_id: post.id,
      opened_by: supervisor.id,
      reason: 'ausencia',
      urgency: 'alta',
      notes: 'FT criada por teste',
    });

    expect(ft.status).toBe('aberta');

    const assigned = await dp.ft.assign(ft.id, candidate.id);
    expect(assigned.assigned_to).toBe(candidate.id);
    expect(assigned.status).toBe('acionando');

    const accepted = await dp.ft.accept(ft.id);
    expect(accepted.status).toBe('aceita');

    const resolved = await dp.ft.resolve(ft.id);
    expect(resolved.status).toBe('resolvida');
  });

  it('marca notificações como lidas', async () => {
    const dp = createDemoAdapter();

    const before = await dp.notifications.getUnreadCount();
    await dp.notifications.markAllRead();
    const after = await dp.notifications.getUnreadCount();

    expect(before).toBeGreaterThanOrEqual(0);
    expect(after).toBe(0);
  });

  it('cria auditoria e permite filtrar por entidade', async () => {
    const dp = createDemoAdapter();

    await dp.audit.write({
      company_id: DEMO_IDS.company,
      actor_id: DEMO_IDS.profiles.gerente,
      action: 'test_action',
      entity: 'test_entity',
      entity_id: 'test-entity-id',
      metadata: { source: 'vitest' },
    });

    const entries = await dp.audit.list({ entity: 'test_entity' });

    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].action).toBe('test_action');
    expect(entries[0].actor_name).toBeTruthy();
  });

  it('lista escalas demo e filtra por funcionário', async () => {
    const dp = createDemoAdapter();

    const schedules = await dp.schedules.list();
    const employeeSchedules = await dp.schedules.getByEmployee(schedules[0].employee_id);

    expect(schedules.length).toBeGreaterThan(0);
    expect(employeeSchedules.every(schedule => schedule.employee_id === schedules[0].employee_id)).toBe(true);
  });
});
