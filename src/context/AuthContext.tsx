// ============================================================
// OPERACIONAL5 — Contexto de Autenticação
// ============================================================
// Suporta dois modos:
// 1. VITE_DEMO_MODE=true  → usa o DataProvider demo
// 2. VITE_DEMO_MODE=false → usa Supabase Auth real
//
// Também separa o administrador da plataforma (platform_admins)
// dos perfis de tenant (profiles). Essa separação evita misturar
// admin da empresa com dono global da plataforma.
// ============================================================

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Profile, Role } from '@/lib/types';
import { getDataProvider } from '@/lib/data/data-provider';
import { assertSafeRuntimeConfig, DEMO_MODE } from '@/lib/env';
import { getSupabaseClient } from '@/lib/supabase/client';

export type CompanyAccessReason = 'active' | 'trialing' | 'trial_expired' | 'suspended' | 'cancelled' | 'expired' | 'inactive' | 'unknown';

export interface PlatformAdmin {
  id: string;
  user_id: string;
  name: string;
  email: string;
  active: boolean;
  created_at?: string;
}

export interface CompanyAccessState {
  companyId: string;
  companyName?: string;
  subscriptionStatus: 'trialing' | 'active' | 'suspended' | 'cancelled' | 'expired' | string;
  active: boolean;
  trialEndsAt?: string | null;
  isBlocked: boolean;
  reason: CompanyAccessReason;
}

export interface AuthState {
  isAuthenticated: boolean;
  profile: Profile | null;
  platformAdmin: PlatformAdmin | null;
  companyAccess: CompanyAccessState | null;
  isLoading: boolean;
  mode: 'demo' | 'supabase';
}

export interface AuthContextType extends AuthState {
  isPlatformAdmin: boolean;
  accessBlocked: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginDemo: (role: Role) => Promise<void>;
  logout: () => void;
}

type ProfileRow = {
  id: string;
  user_id?: string | null;
  company_id: string;
  role: Role;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  fcm_token?: string | null;
  ft_available?: boolean | null;
  regime_trabalho?: Profile['regime_trabalho'];
  data_referencia_ciclo?: string | null;
  active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PlatformAdminRow = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  active?: boolean | null;
  created_at?: string | null;
};

type CompanyAccessRow = {
  id: string;
  name?: string | null;
  active?: boolean | null;
  subscription_status?: string | null;
};

type CompanySubscriptionRow = {
  status?: string | null;
  trial_ends_at?: string | null;
};

const AuthContext = createContext<AuthContextType | null>(null);

function normalizeProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    user_id: row.user_id ?? row.id,
    company_id: row.company_id,
    role: row.role,
    name: row.name,
    email: row.email ?? '',
    phone: row.phone ?? undefined,
    avatar_url: row.avatar_url ?? undefined,
    fcm_token: row.fcm_token ?? undefined,
    ft_available: row.ft_available ?? false,
    regime_trabalho: row.regime_trabalho ?? '12x36',
    data_referencia_ciclo: row.data_referencia_ciclo ?? '2024-01-01',
    active: row.active ?? true,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

function normalizePlatformAdmin(row: PlatformAdminRow): PlatformAdmin {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    email: row.email,
    active: row.active ?? true,
    created_at: row.created_at ?? undefined,
  };
}

async function fetchProfileByUserId(userId: string): Promise<Profile | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle<ProfileRow>();

  if (error) {
    throw new Error(`Erro ao buscar perfil: ${error.message}`);
  }

  return data ? normalizeProfile(data) : null;
}

async function fetchPlatformAdminByUserId(userId: string): Promise<PlatformAdmin | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('platform_admins')
    .select('id,user_id,name,email,active,created_at')
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle<PlatformAdminRow>();

  if (error) {
    // Se a migration SaaS ainda não foi aplicada no Supabase remoto,
    // o usuário não deve quebrar a aplicação inteira; apenas não será
    // tratado como SuperAdmin.
    console.warn('[auth] platform_admins indisponível:', error.message);
    return null;
  }

  return data ? normalizePlatformAdmin(data) : null;
}

async function fetchCompanyAccess(profile: Profile): Promise<CompanyAccessState> {
  if (DEMO_MODE) {
    return {
      companyId: profile.company_id,
      companyName: 'Empresa Demo',
      subscriptionStatus: 'active',
      active: true,
      trialEndsAt: null,
      isBlocked: false,
      reason: 'active',
    };
  }

  const supabase = getSupabaseClient();

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id,name,active,subscription_status')
    .eq('id', profile.company_id)
    .maybeSingle<CompanyAccessRow>();

  if (companyError || !company) {
    return {
      companyId: profile.company_id,
      subscriptionStatus: 'unknown',
      active: false,
      trialEndsAt: null,
      isBlocked: true,
      reason: 'unknown',
    };
  }

  const { data: subscription } = await supabase
    .from('company_subscriptions')
    .select('status,trial_ends_at')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<CompanySubscriptionRow>();

  const subscriptionStatus = company.subscription_status ?? subscription?.status ?? 'active';
  const trialEndsAt = subscription?.trial_ends_at ?? null;

  let isBlocked = false;
  let reason: CompanyAccessReason = subscriptionStatus === 'trialing' ? 'trialing' : 'active';

  if (company.active === false) {
    isBlocked = true;
    reason = 'inactive';
  } else if (subscriptionStatus === 'suspended') {
    isBlocked = true;
    reason = 'suspended';
  } else if (subscriptionStatus === 'cancelled') {
    isBlocked = true;
    reason = 'cancelled';
  } else if (subscriptionStatus === 'expired') {
    isBlocked = true;
    reason = 'expired';
  } else if (subscriptionStatus === 'trialing' && trialEndsAt && new Date(trialEndsAt).getTime() < Date.now()) {
    isBlocked = true;
    reason = 'trial_expired';
  }

  return {
    companyId: profile.company_id,
    companyName: company.name ?? undefined,
    subscriptionStatus,
    active: company.active ?? true,
    trialEndsAt,
    isBlocked,
    reason,
  };
}

async function resolveAuthenticatedUser(userId: string): Promise<Pick<AuthState, 'profile' | 'platformAdmin' | 'companyAccess'>> {
  const profile = await fetchProfileByUserId(userId);

  if (profile) {
    const companyAccess = await fetchCompanyAccess(profile);
    return { profile, platformAdmin: null, companyAccess };
  }

  const platformAdmin = await fetchPlatformAdminByUserId(userId);

  if (platformAdmin) {
    return { profile: null, platformAdmin, companyAccess: null };
  }

  throw new Error('Usuário autenticado, mas sem profile de empresa ou platform_admin ativo.');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  assertSafeRuntimeConfig();

  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    profile: null,
    platformAdmin: null,
    companyAccess: null,
    isLoading: !DEMO_MODE,
    mode: DEMO_MODE ? 'demo' : 'supabase',
  });

  useEffect(() => {
    if (DEMO_MODE) return;

    let mounted = true;

    const loadSession = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        const user = data.session?.user;

        if (!user) {
          if (mounted) {
            setState({ isAuthenticated: false, profile: null, platformAdmin: null, companyAccess: null, isLoading: false, mode: 'supabase' });
          }
          return;
        }

        const resolved = await resolveAuthenticatedUser(user.id);

        if (mounted) {
          setState({ isAuthenticated: true, ...resolved, isLoading: false, mode: 'supabase' });
        }
      } catch {
        if (mounted) {
          setState({ isAuthenticated: false, profile: null, platformAdmin: null, companyAccess: null, isLoading: false, mode: 'supabase' });
        }
      }
    };

    void loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  const loginDemo = useCallback(async (role: Role) => {
    if (!DEMO_MODE) {
      throw new Error('Login demo desativado fora do modo demo.');
    }

    const dp = getDataProvider();
    const profiles = await dp.employees.list({ role, active: true });
    const profile = profiles[0];

    if (!profile) {
      throw new Error(`Nenhum perfil demo encontrado para o cargo ${role}.`);
    }

    const companyAccess = await fetchCompanyAccess(profile);
    setState({ isAuthenticated: true, profile, platformAdmin: null, companyAccess, isLoading: false, mode: 'demo' });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      if (DEMO_MODE) {
        const dp = getDataProvider();
        const profiles = await dp.employees.list({ active: true });
        const profile = profiles.find(p => p.email === email);

        if (!profile) {
          throw new Error('Email não encontrado no demo.');
        }

        const companyAccess = await fetchCompanyAccess(profile);
        setState({ isAuthenticated: true, profile, platformAdmin: null, companyAccess, isLoading: false, mode: 'demo' });
        return;
      }

      const supabase = getSupabaseClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const userId = data.user?.id;

      if (!userId) {
        throw new Error('Login realizado, mas usuário não retornado pelo Supabase.');
      }

      const resolved = await resolveAuthenticatedUser(userId);

      setState({ isAuthenticated: true, ...resolved, isLoading: false, mode: 'supabase' });
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    if (!DEMO_MODE) {
      const supabase = getSupabaseClient();
      void supabase.auth.signOut();
    }

    setState(prev => ({
      isAuthenticated: false,
      profile: null,
      platformAdmin: null,
      companyAccess: null,
      isLoading: false,
      mode: prev.mode,
    }));
  }, []);

  const value: AuthContextType = {
    ...state,
    isPlatformAdmin: Boolean(state.platformAdmin),
    accessBlocked: Boolean(state.companyAccess?.isBlocked),
    login,
    loginDemo,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}

export function useProfile(): Profile {
  const { profile } = useAuth();
  if (!profile) throw new Error('Nenhum perfil autenticado');
  return profile;
}

export function useRole(): Role {
  const profile = useProfile();
  return profile.role;
}
