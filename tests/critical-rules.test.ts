// ============================================================
// OPERACIONAL5 — Testes de Regras Críticas
// ============================================================

import { describe, it, expect } from 'vitest';
import { haversineDistance, isWithinGeofence, checkGeofence, detectMockLocation } from '../src/lib/geo';
import { is12x36WorkDay, isWithinShift, detectScheduleConflicts } from '../src/lib/domain/cycle-12x36';
import { getPostOperationalStatus } from '../src/lib/domain/post-status';
import { getPermissions, hasMinimumRole, getRoleLevel } from '../src/lib/utils';

// ==================== GEO / GEOFENCE ====================
describe('Haversine Distance', () => {
  it('calcula distância entre dois pontos iguais como 0', () => {
    expect(haversineDistance(-23.5505, -46.6333, -23.5505, -46.6333)).toBe(0);
  });

  it('calcula distância aproximada entre São Paulo e Rio (~360km)', () => {
    const dist = haversineDistance(-23.5505, -46.6333, -22.9068, -43.1729);
    expect(dist).toBeGreaterThan(350000);
    expect(dist).toBeLessThan(380000);
  });

  it('calcula distância curta corretamente (~50m)', () => {
    const dist = haversineDistance(-23.5505, -46.6333, -23.5510, -46.6340);
    expect(dist).toBeGreaterThan(10);
    expect(dist).toBeLessThan(100);
  });
});

describe('Geofence', () => {
  const postLat = -23.5505;
  const postLng = -46.6333;
  const radius = 50;

  it('detecta ponto dentro do raio', () => {
    expect(isWithinGeofence(-23.5504, -46.6332, postLat, postLng, radius)).toBe(true);
  });

  it('detecta ponto fora do raio', () => {
    expect(isWithinGeofence(-23.5600, -46.6500, postLat, postLng, radius)).toBe(false);
  });
});

describe('Mock Location Detection', () => {
  it('detecta acurácia suspeita', () => {
    const result = detectMockLocation(200, null, null);
    expect(result.isMock).toBe(false); // Só 1 motivo
  });

  it('detecta múltiplos indicadores de mock', () => {
    const result = detectMockLocation(2, 0, 0); // Acurácia perfeita + velocidade 0 + altitude 0
    expect(result.isMock).toBe(true);
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it('não detecta falso positivo', () => {
    const result = detectMockLocation(15, 5, 750);
    expect(result.isMock).toBe(false);
  });
});

describe('checkGeofence', () => {
  it('aprova GPS válido dentro do raio', () => {
    const result = checkGeofence(-23.5504, -46.6332, -23.5505, -46.6333, 50, 12, null, null);
    expect(result.within_fence).toBe(true);
    expect(result.recommendation).toBe('approve');
  });

  it('rejeita GPS fora do raio', () => {
    const result = checkGeofence(-23.5600, -46.6500, -23.5505, -46.6333, 50, 10, null, null);
    expect(result.within_fence).toBe(false);
    expect(result.recommendation).toBe('reject');
  });

  it('pede QR fallback com acurácia ruim', () => {
    const result = checkGeofence(-23.5504, -46.6332, -23.5505, -46.6333, 50, 200, null, null);
    expect(result.accuracy_ok).toBe(false);
    expect(result.recommendation).toBe('use_qr_fallback');
  });
});

// ==================== CICLO 12x36 ====================
describe('Ciclo 12x36', () => {
  it('identifica dia de trabalho corretamente', () => {
    const ref = new Date('2024-01-01T06:00:00');
    const workDay = new Date('2024-01-01T12:00:00');
    const { isWorkDay } = is12x36WorkDay(ref, workDay);
    expect(isWorkDay).toBe(true);
  });

  it('identifica dia de folga corretamente', () => {
    const ref = new Date('2024-01-01T06:00:00');
    const offDay = new Date('2024-01-02T18:00:00'); // 36h depois = folga
    const { isWorkDay } = is12x36WorkDay(ref, offDay);
    expect(isWorkDay).toBe(false);
  });

  it('ciclo se repete a cada 48h', () => {
    const ref = new Date('2024-01-01T06:00:00');
    const day3 = new Date('2024-01-03T06:00:00'); // 48h depois = mesmo ciclo
    const { isWorkDay } = is12x36WorkDay(ref, day3);
    expect(isWorkDay).toBe(true);
  });
});

describe('Turno cruzando meia-noite', () => {
  it('detecta horário dentro do turno noturno', () => {
    expect(isWithinShift('18:00', '06:00', '22:00')).toBe(true);
    expect(isWithinShift('18:00', '06:00', '02:00')).toBe(true);
  });

  it('detecta horário fora do turno noturno', () => {
    expect(isWithinShift('18:00', '06:00', '12:00')).toBe(false);
  });

  it('detecta horário dentro do turno diurno', () => {
    expect(isWithinShift('06:00', '18:00', '10:00')).toBe(true);
    expect(isWithinShift('06:00', '18:00', '20:00')).toBe(false);
  });
});

describe('Conflitos de Escala', () => {
  it('detecta conflito quando horários se sobrepõem', () => {
    const schedules = [
      { id: 's1', employee_id: 'emp1', post_id: 'p1', shift_start: '2024-01-15T06:00:00Z', shift_end: '2024-01-15T18:00:00Z' },
      { id: 's2', employee_id: 'emp1', post_id: 'p2', shift_start: '2024-01-15T12:00:00Z', shift_end: '2024-01-16T00:00:00Z' },
    ];
    const conflicts = detectScheduleConflicts('emp1', schedules);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].conflict_type).toBe('partial');
  });

  it('não detecta conflito quando horários não se sobrepõem', () => {
    const schedules = [
      { id: 's1', employee_id: 'emp1', post_id: 'p1', shift_start: '2024-01-15T06:00:00Z', shift_end: '2024-01-15T18:00:00Z' },
      { id: 's2', employee_id: 'emp1', post_id: 'p2', shift_start: '2024-01-15T18:00:00Z', shift_end: '2024-01-16T06:00:00Z' },
    ];
    const conflicts = detectScheduleConflicts('emp1', schedules);
    expect(conflicts.length).toBe(0);
  });
});

// ==================== STATUS OPERACIONAL DO POSTO ====================
describe('Post Operational Status', () => {
  const baseInput = {
    postId: 'p1',
    postName: 'Test Post',
    minStaff: 1,
    toleranceMinutes: 15,
    radiusMeters: 50,
    shiftStart: new Date(Date.now() - 30 * 60000).toISOString(), // 30 min atrás
    shiftEnd: new Date(Date.now() + 11 * 3600000).toISOString(),
    presences: [],
    activeSOS: 0,
    schedules: [{ employeeId: 'e1', employeeName: 'João', shiftStart: '', shiftEnd: '' }],
  };

  it('retorna sos_ativo quando há SOS', () => {
    const result = getPostOperationalStatus({ ...baseInput, activeSOS: 1 });
    expect(result.status).toBe('sos_ativo');
  });

  it('retorna descoberto após tolerância sem presença', () => {
    const result = getPostOperationalStatus(baseInput);
    expect(result.status).toBe('descoberto');
  });

  it('retorna coberto quando mínimo confirmado', () => {
    const result = getPostOperationalStatus({
      ...baseInput,
      presences: [{ employeeId: 'e1', employeeName: 'João', confirmedAt: new Date().toISOString(), status: 'valid' }],
    });
    expect(result.status).toBe('coberto');
  });

  it('retorna parcialmente_coberto com min_staff > 1', () => {
    const result = getPostOperationalStatus({
      ...baseInput,
      minStaff: 2,
      presences: [{ employeeId: 'e1', employeeName: 'João', confirmedAt: new Date().toISOString(), status: 'valid' }],
      schedules: [
        { employeeId: 'e1', employeeName: 'João', shiftStart: '', shiftEnd: '' },
        { employeeId: 'e2', employeeName: 'Pedro', shiftStart: '', shiftEnd: '' },
      ],
    });
    expect(result.status).toBe('parcialmente_coberto');
    expect(result.confirmedCount).toBe(1);
    expect(result.missingCount).toBe(1);
  });
});

// ==================== PERMISSÕES ====================
describe('Permissões por Cargo', () => {
  it('operador pode confirmar presença e disparar SOS', () => {
    const perms = getPermissions('operador');
    expect(perms.canConfirmPresence).toBe(true);
    expect(perms.canTriggerSOS).toBe(true);
    expect(perms.canCloseSOS).toBe(false);
    expect(perms.canViewAllPosts).toBe(false);
  });

  it('supervisor pode encerrar SOS mas não acessar admin', () => {
    const perms = getPermissions('supervisor');
    expect(perms.canCloseSOS).toBe(true);
    expect(perms.canResolveOccurrence).toBe(true);
    expect(perms.canAccessAdmin).toBe(false);
  });

  it('gerente tem acesso total à empresa', () => {
    const perms = getPermissions('gerente');
    expect(perms.canViewAllPosts).toBe(true);
    expect(perms.canViewAllEmployees).toBe(true);
    expect(perms.canViewAudit).toBe(true);
    expect(perms.canManageSettings).toBe(true);
  });

  it('hierarquia de roles está correta', () => {
    expect(getRoleLevel('operador')).toBeLessThan(getRoleLevel('lider'));
    expect(getRoleLevel('lider')).toBeLessThan(getRoleLevel('supervisor'));
    expect(getRoleLevel('supervisor')).toBeLessThan(getRoleLevel('gerente'));
    expect(getRoleLevel('gerente')).toBeLessThan(getRoleLevel('diretor'));
  });

  it('hasMinimumRole funciona', () => {
    expect(hasMinimumRole('supervisor', 'supervisor')).toBe(true);
    expect(hasMinimumRole('gerente', 'supervisor')).toBe(true);
    expect(hasMinimumRole('operador', 'supervisor')).toBe(false);
  });
});
