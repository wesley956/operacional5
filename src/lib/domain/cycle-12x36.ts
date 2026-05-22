// ============================================================
// OPERACIONAL5 — Domain: Ciclo 12x36 e Conflitos de Escala
// ============================================================

/**
 * Calcula se uma data é dia de trabalho no regime 12x36.
 * Ciclo: 12h trabalho + 36h folga = 48h total.
 * Usa data_referencia_ciclo como ponto de partida (dia de trabalho).
 */
export function is12x36WorkDay(
  referenceDate: Date,
  checkDate: Date
): { isWorkDay: boolean; cycleDay: number } {
  const CYCLE_HOURS = 48;
  const WORK_HOURS = 12;
  const diffMs = checkDate.getTime() - referenceDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const cyclePosition = ((diffHours % CYCLE_HOURS) + CYCLE_HOURS) % CYCLE_HOURS;
  const cycleDay = Math.floor(diffHours / 24);
  const isWorkDay = cyclePosition < WORK_HOURS;
  return { isWorkDay, cycleDay };
}

/**
 * Verifica se um horário está dentro de um turno.
 * Suporta turno que cruza meia-noite (ex: 18:00-06:00).
 */
export function isWithinShift(
  shiftStart: string,
  shiftEnd: string,
  checkTime: string
): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const start = toMinutes(shiftStart);
  const end = toMinutes(shiftEnd);
  const check = toMinutes(checkTime);
  if (start <= end) return check >= start && check <= end;
  return check >= start || check <= end;
}

export interface ScheduleConflict {
  schedule_id_1: string;
  schedule_id_2: string;
  overlap_start: Date;
  overlap_end: Date;
  conflict_type: 'full' | 'partial';
}

export interface ScheduleData {
  id: string;
  employee_id: string;
  post_id: string;
  shift_start: string;
  shift_end: string;
}

/**
 * Detecta conflitos de escala para um funcionário.
 */
export function detectScheduleConflicts(
  employeeId: string,
  schedules: ScheduleData[]
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const active = schedules.filter(s => s.employee_id === employeeId);

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const s1 = active[i];
      const s2 = active[j];
      const start1 = new Date(s1.shift_start);
      const end1 = new Date(s1.shift_end);
      const start2 = new Date(s2.shift_start);
      const end2 = new Date(s2.shift_end);
      const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
      const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));
      if (overlapStart < overlapEnd) {
        conflicts.push({
          schedule_id_1: s1.id,
          schedule_id_2: s2.id,
          overlap_start: overlapStart,
          overlap_end: overlapEnd,
          conflict_type: 'partial',
        });
      }
    }
  }
  return conflicts;
}

/**
 * Gera datas de trabalho para um mês no regime 12x36.
 */
export function generateMonthlyWorkDays(
  referenceDate: Date,
  year: number,
  month: number
): Date[] {
  const workDays: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let current = new Date(firstDay);
  while (current <= lastDay) {
    const { isWorkDay } = is12x36WorkDay(referenceDate, current);
    if (isWorkDay) workDays.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return workDays;
}

/**
 * Retorna tempo restante do turno em minutos.
 */
export function getRemainingShiftMinutes(shiftEnd: string): number {
  const now = new Date();
  const [endH, endM] = shiftEnd.split(':').map(Number);
  const endMinutes = endH * 60 + (endM || 0);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let remaining = endMinutes - currentMinutes;
  if (remaining < 0) remaining += 24 * 60;
  return remaining;
}
