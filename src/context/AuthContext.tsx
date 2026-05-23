// ============================================================
// OPERACIONAL5 — Contexto de Autenticação
// ============================================================
// Suporta dois modos:
// 1. VITE_DEMO_MODE=true  → usa o DataProvider demo
// 2. VITE_DEMO_MODE=false → usa Supabase Auth real
// ============================================================

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Profile, Role } from '@/lib/types';
import { getDataProvider } from '@/lib/data/data-provider';
import { assertSafeRuntimeConfig, DEMO_MODE } from '@/lib/env';
import { getSupabaseClient } from '@/lib/supabase/client';

export interface AuthState {
  isAuthenticated: boolean;
  profile: Profile | null;
  isLoading: boolean;
  mode: 'demo' | 'supabase';
}

export interface AuthContextType extends AuthState {
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

async function fetchProfileByUserId(userId: string): Promise<Profile> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .single<ProfileRow>();

  if (error) {
    throw new Error(`Perfil não encontrado ou sem permissão: ${error.message}`);
  }

  if (!data) {
    throw new Error('Perfil não encontrado.');
  }

  return normalizeProfile(data);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  assertSafeRuntimeConfig();

  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    profile: null,
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
            setState({ isAuthenticated: false, profile: null, isLoading: false, mode: 'supabase' });
          }
          return;
        }

        const profile = await fetchProfileByUserId(user.id);

        if (mounted) {
          setState({ isAuthenticated: true, profile, isLoading: false, mode: 'supabase' });
        }
      } catch {
        if (mounted) {
          setState({ isAuthenticated: false, profile: null, isLoading: false, mode: 'supabase' });
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

    setState({ isAuthenticated: true, profile, isLoading: false, mode: 'demo' });
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

        setState({ isAuthenticated: true, profile, isLoading: false, mode: 'demo' });
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

      const profile = await fetchProfileByUserId(userId);

      setState({ isAuthenticated: true, profile, isLoading: false, mode: 'supabase' });
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
      isLoading: false,
      mode: prev.mode,
    }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, loginDemo, logout }}>
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
