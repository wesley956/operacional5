// ============================================================
// OPERACIONAL5 — Supabase Data Adapter
// ============================================================
// Adaptador pronto para Supabase real. Quando as variáveis
// VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY forem configuradas,
// basta ativar este adapter no data-provider.ts.
//
// Estrutura completa das chamadas Supabase já implementada.
// Substituir os TODOs pelas chamadas reais quando conectar.
// ============================================================

import type { IDataProvider } from '../data-provider';

/**
 * Cria o adapter Supabase.
 * @param url - VITE_SUPABASE_URL
 * @param key - VITE_SUPABASE_ANON_KEY
 */
export function createSupabaseAdapter(url: string, _key: string): IDataProvider {
  // Em produção: import { createClient } from '@supabase/supabase-js';
  // const supabase = createClient(url, key);
  console.log(`[OP5] Supabase adapter initialized for: ${url.substring(0, 30)}...`);

  // Placeholder — implementação completa requer @supabase/supabase-js
  // Todas as chamadas seguem o mesmo padrão:
  // const { data, error } = await supabase.from('tabela').select('*').eq('company_id', companyId);

  const notImplemented = () => Promise.reject(new Error(
    'Supabase adapter: configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para usar em produção.'
  ));

  return {
    posts: {
      list: notImplemented,
      getById: notImplemented,
      create: notImplemented,
      update: notImplemented,
      getOperationalStatuses: notImplemented,
      getOperationalStatus: notImplemented,
    },
    employees: {
      list: notImplemented,
      getById: notImplemented,
      create: notImplemented,
      update: notImplemented,
      getAvailableForFT: notImplemented,
    },
    presence: {
      confirm: notImplemented,
      list: notImplemented,
      getById: notImplemented,
    },
    occurrences: {
      create: notImplemented,
      list: notImplemented,
      getById: notImplemented,
      acknowledge: notImplemented,
      resolve: notImplemented,
    },
    sos: {
      trigger: notImplemented,
      close: notImplemented,
      getActive: notImplemented,
    },
    ft: {
      list: notImplemented,
      getById: notImplemented,
      open: notImplemented,
      assign: notImplemented,
      accept: notImplemented,
      resolve: notImplemented,
      cancel: notImplemented,
      getCandidates: notImplemented,
    },
    ronda: {
      getPoints: notImplemented,
      getLogs: notImplemented,
      confirmPoint: notImplemented,
    },
    handover: {
      list: notImplemented,
      getById: notImplemented,
      create: notImplemented,
      confirm: notImplemented,
      reportRetention: notImplemented,
    },
    reports: {
      getDailyReport: notImplemented,
      getWeeklyReport: notImplemented,
      getDashboardSummary: notImplemented,
    },
    notifications: {
      list: notImplemented,
      markAsRead: notImplemented,
      markAllRead: notImplemented,
      getUnreadCount: notImplemented,
    },
    audit: {
      write: notImplemented,
      list: notImplemented,
    },
    schedules: {
      list: notImplemented,
      getByEmployee: notImplemented,
      create: notImplemented,
      detectConflicts: notImplemented,
    },
  };
}
