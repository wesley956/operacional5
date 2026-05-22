// ============================================================
// OPERACIONAL5 — Domain: Post Operational Status
// ============================================================
// Calcula o status operacional REAL de um posto baseado em
// presenças confirmadas, SOS ativos, escalas e tolerância.
// Esta é lógica de domínio pura, sem dependência de dados.
// ============================================================

import type { OperationalStatus } from '../types';
import { haversineDistance } from '../geo';
import { isWithinShift, is12x36WorkDay } from './cycle-12x36';

export interface PostStatusInput {
  postId: string;
  postName: string;
  minStaff: number;
  toleranceMinutes: number;
  radiusMeters: number;
  shiftStart: string;
  shiftEnd: string;
  presences: Array<{
    employeeId: string;
    employeeName: string;
    confirmedAt: string;
    status: 'valid' | 'pending_review' | 'rejected';
  }>;
  activeSOS: number;
  schedules: Array<{
    employeeId: string;
    employeeName: string;
    shiftStart: string;
    shiftEnd: string;
  }>;
}

export interface PostStatusResult {
  postId: string;
  postName: string;
  status: OperationalStatus;
  confirmedCount: number;
  missingCount: number;
  employeesPresent: string[];
  employeesMissing: string[];
  activeSosCount: number;
  details: string;
}

/**
 * Calcula o status operacional de um posto.
 * Ordem de prioridade:
 * 1. SOS ativo → sos_ativo
 * 2. Sem escala → sem_escala
 * 3. Nenhuma presença após tolerância → descoberto
 * 4. Atraso dentro da tolerância → atencao
 * 5. Confirmado mas abaixo de min_staff → parcialmente_coberto
 * 6. Ausência prolongada → critico
 * 7. Mínimo confirmado → coberto
 */
export function getPostOperationalStatus(input: PostStatusInput): PostStatusResult {
  const now = new Date();
  const shiftStart = new Date(input.shiftStart);
  const shiftEnd = new Date(input.shiftEnd);
  const isDuringShift = now >= shiftStart && now <= shiftEnd;
  const minutesSinceShiftStart = (now.getTime() - shiftStart.getTime()) / 60000;
  const isPastTolerance = minutesSinceShiftStart > input.toleranceMinutes;

  // Presenças válidas do turno atual
  const validPresences = input.presences.filter(p =>
    p.status === 'valid' && new Date(p.confirmedAt) >= shiftStart
  );
  const confirmedCount = validPresences.length;
  const employeesPresent = validPresences.map(p => p.employeeName);

  // Funcionários escalados sem presença
  const presentIds = new Set(validPresences.map(p => p.employeeId));
  const missingEmployees = input.schedules.filter(s => !presentIds.has(s.employeeId));
  const employeesMissing = missingEmployees.map(s => s.employeeName);
  const missingCount = Math.max(0, input.minStaff - confirmedCount);

  // 1. SOS ativo tem prioridade máxima
  if (input.activeSOS > 0) {
    return {
      postId: input.postId,
      postName: input.postName,
      status: 'sos_ativo',
      confirmedCount, missingCount,
      employeesPresent, employeesMissing,
      activeSosCount: input.activeSOS,
      details: `SOS ativo com ${input.activeSOS} ocorrência(s). ${confirmedCount}/${input.minStaff} vigilantes.`,
    };
  }

  // 2. Fora do turno
  if (!isDuringShift) {
    return {
      postId: input.postId,
      postName: input.postName,
      status: 'coberto',
      confirmedCount: 0,
      missingCount: 0,
      employeesPresent: [],
      employeesMissing: [],
      activeSosCount: 0,
      details: 'Fora do horário de turno.',
    };
  }

  // 3. Descoberto — após tolerância, nenhuma presença
  if (isPastTolerance && confirmedCount === 0) {
    // Crítico se mais de 2x a tolerância
    if (minutesSinceShiftStart > input.toleranceMinutes * 3) {
      return {
        postId: input.postId,
        postName: input.postName,
        status: 'critico',
        confirmedCount: 0,
        missingCount: input.minStaff,
        employeesPresent: [],
        employeesMissing: employeesMissing.length > 0 ? employeesMissing : Array(input.minStaff).fill('(vaga)'),
        activeSosCount: 0,
        details: `CRÍTICO: ${Math.round(minutesSinceShiftStart)}min sem vigilante. Mínimo: ${input.minStaff}.`,
      };
    }
    return {
      postId: input.postId,
      postName: input.postName,
      status: 'descoberto',
      confirmedCount: 0,
      missingCount: input.minStaff,
      employeesPresent: [],
      employeesMissing: employeesMissing.length > 0 ? employeesMissing : Array(input.minStaff).fill('(vaga)'),
      activeSosCount: 0,
      details: `Descoberto há ${Math.round(minutesSinceShiftStart)}min. Mínimo: ${input.minStaff}.`,
    };
  }

  // 4. Atenção — dentro da tolerância, sem confirmação ainda
  if (!isPastTolerance && confirmedCount === 0) {
    return {
      postId: input.postId,
      postName: input.postName,
      status: 'atencao',
      confirmedCount: 0,
      missingCount: input.minStaff,
      employeesPresent: [],
      employeesMissing,
      activeSosCount: 0,
      details: `Aguardando confirmação. ${Math.round(input.toleranceMinutes - minutesSinceShiftStart)}min de tolerância restantes.`,
    };
  }

  // 5. Parcialmente coberto
  if (confirmedCount > 0 && confirmedCount < input.minStaff) {
    return {
      postId: input.postId,
      postName: input.postName,
      status: 'parcialmente_coberto',
      confirmedCount,
      missingCount,
      employeesPresent,
      employeesMissing,
      activeSosCount: 0,
      details: `Parcial: ${confirmedCount}/${input.minStaff}. Faltam ${missingCount}.`,
    };
  }

  // 6. Coberto
  return {
    postId: input.postId,
    postName: input.postName,
    status: 'coberto',
    confirmedCount,
    missingCount: 0,
    employeesPresent,
    employeesMissing: [],
    activeSosCount: 0,
    details: `Coberto: ${confirmedCount}/${input.minStaff} vigilantes confirmados.`,
  };
}

// Re-export geo functions for convenience
export { haversineDistance, isWithinShift, is12x36WorkDay };
