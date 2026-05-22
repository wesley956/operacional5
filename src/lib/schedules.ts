// ============================================================
// OPERACIONAL5 — Escala 12x36 e Detecção de Conflitos
// ============================================================

import type { RegimeTrabalho, Schedule } from './types';

/**
 * Calcula se uma data/hora é dia de trabalho no regime 12x36.
 * O ciclo 12x36 significa: trabalha 12h, folga 36h (ciclo de 48h).
 *
 * Regras:
 * - Usa data_referencia_ciclo como ponto de partida (dia de trabalho)
 * - Turno pode cruzar meia-noite
 * - Timezone America/Sao_Paulo
 * - Geração por data absoluta, não depende de semana fixa
 */
export function is12x36WorkDay(
  referenceDate: Date,
  checkDate: Date
): { isWorkDay: boolean; cycleDay: number; cyclePosition: number } {
  const CYCLE_HOURS = 48; // 12 trabalho + 36 folga
  const WORK_HOURS = 12;

  const diffMs = checkDate.getTime() - referenceDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  // Normalizar para posição dentro do ciclo atual
  const cyclePosition = ((diffHours % CYCLE_HOURS) + CYCLE_HOURS) % CYCLE_HOURS;
  const cycleDay = Math.floor(diffHours / 24);
  const isWorkDay = cyclePosition < WORK_HOURS;

  return { isWorkDay, cycleDay, cyclePosition };
}

/**
 * Verifica se uma data/hora está dentro do horário de turno.
 * Considera turno que cruza meia-noite (ex: 18:00-06:00).
 */
export function isWithinShift(
  shiftStart: string, // "HH:mm"
  shiftEnd: string,   // "HH:mm"
  checkTime: string   // "HH:mm"
): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const start = toMinutes(shiftStart);
  const end = toMinutes(shiftEnd);
  const check = toMinutes(checkTime);

  // Turno normal (não cruza meia-noite)
  if (start <= end) {
    return check >= start && check <= end;
  }

  // Turno que cruza meia-noite (ex: 22:00-06:00)
  return check >= start || check <= end;
}

/**
 * Detecta conflitos de escala para um funcionário.
 * Um conflito ocorre quando o funcionário está escalado em dois postos
 * no mesmo período de tempo.
 */
export interface ScheduleConflict {
  schedule_id_1: string;
  schedule_id_2: string;
  post_id_1: string;
  post_id_2: string;
  overlap_start: Date;
  overlap_end: Date;
  conflict_type: 'full' | 'partial';
}

export function detectScheduleConflicts(
  employeeId: string,
  schedules: Schedule[],
  _targetDate?: Date
): ScheduleConflict[] {
  void _targetDate;
  const conflicts: ScheduleConflict[] = [];

  // Filtrar escalas ativas do funcionário
  const activeSchedules = schedules.filter(
    s => s.employee_id === employeeId && s.is_active
  );

  for (let i = 0; i < activeSchedules.length; i++) {
    for (let j = i + 1; j < activeSchedules.length; j++) {
      const s1 = activeSchedules[i];
      const s2 = activeSchedules[j];

      const start1 = new Date(s1.shift_start);
      const end1 = new Date(s1.shift_end);
      const start2 = new Date(s2.shift_start);
      const end2 = new Date(s2.shift_end);

      // Verificar sobreposição
      const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
      const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));

      if (overlapStart < overlapEnd) {
        const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
        const minMs = Math.min(
          end1.getTime() - start1.getTime(),
          end2.getTime() - start2.getTime()
        );

        conflicts.push({
          schedule_id_1: s1.id,
          schedule_id_2: s2.id,
          post_id_1: s1.post_id,
          post_id_2: s2.post_id,
          overlap_start: overlapStart,
          overlap_end: overlapEnd,
          conflict_type: overlapMs >= minMs ? 'full' : 'partial',
        });
      }
    }
  }

  return conflicts;
}

/**
 * Gera as datas de trabalho para um mês baseado no regime 12x36.
 */
export function generateMonthlyWorkDays(
  referenceDate: Date,
  year: number,
  month: number, // 0-indexed
  regime: RegimeTrabalho
): Date[] {
  const workDays: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let current = new Date(firstDay);

  while (current <= lastDay) {
    if (regime === '12x36' || regime === '12x36_noturno') {
      const { isWorkDay } = is12x36WorkDay(referenceDate, current);
      if (isWorkDay) {
        workDays.push(new Date(current));
      }
    } else if (regime === '24x48') {
      // 24h trabalho, 48h folga (ciclo de 72h)
      const diffHours = (current.getTime() - referenceDate.getTime()) / (1000 * 60 * 60);
      const cyclePosition = ((diffHours % 72) + 72) % 72;
      if (cyclePosition < 24) {
        workDays.push(new Date(current));
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return workDays;
}

/**
 * Retorna o turno atual baseado na hora do dia e regime.
 */
export function getCurrentShiftTimes(
  regime: RegimeTrabalho,
  referenceDate?: Date
): { shiftStart: string; shiftEnd: string } {
  const now = referenceDate ?? new Date();
  const hour = now.getHours();

  switch (regime) {
    case '12x36_noturno':
      return hour >= 18
        ? { shiftStart: '18:00', shiftEnd: '06:00' }
        : { shiftStart: '18:00', shiftEnd: '06:00' };
    case '12x36':
      return { shiftStart: '06:00', shiftEnd: '18:00' };
    case '24x48':
      return { shiftStart: '07:00', shiftEnd: '07:00' };
    default:
      return { shiftStart: '06:00', shiftEnd: '18:00' };
  }
}

/**
 * Calcula tempo restante do turno em minutos.
 */
export function getRemainingShiftMinutes(
  shiftEnd: string,
  now?: Date
): number {
  const currentTime = now ?? new Date();
  const [endH, endM] = shiftEnd.split(':').map(Number);
  const endMinutes = endH * 60 + endM;
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  let remaining = endMinutes - currentMinutes;
  if (remaining < 0) remaining += 24 * 60; // Cruzou meia-noite

  return remaining;
}
