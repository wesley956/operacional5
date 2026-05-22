// ============================================================
// OPERACIONAL5 — Environment Guard
// ============================================================
// Centraliza variáveis públicas do Vite e impede que o modo demo
// seja usado fora do ambiente local.
// ============================================================

export type AppEnv = 'local' | 'development' | 'staging' | 'production';

export const APP_ENV: AppEnv = (import.meta.env.VITE_APP_ENV ?? 'local') as AppEnv;
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export function assertSafeRuntimeConfig(): void {
  if (APP_ENV !== 'local' && DEMO_MODE) {
    throw new Error(
      [
        'Configuração insegura bloqueada:',
        `VITE_APP_ENV=${APP_ENV}`,
        'VITE_DEMO_MODE=true',
        'O modo demo só pode rodar com VITE_APP_ENV=local.',
      ].join(' ')
    );
  }

  if (!DEMO_MODE && (!SUPABASE_URL || !SUPABASE_ANON_KEY)) {
    throw new Error(
      'Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY quando VITE_DEMO_MODE=false.'
    );
  }
}

export function isProductionLike(): boolean {
  return APP_ENV === 'production' || APP_ENV === 'staging';
}
