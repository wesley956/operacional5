// ============================================================
// OPERACIONAL5 — Contexto de Autenticação (Final)
// ============================================================
// Suporta dois modos:
// 1. DEMO_MODE=true  → usa o DataProvider demo
// 2. DEMO_MODE=false → usa Supabase Auth (preparado)
// ============================================================

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Profile, Role } from '@/lib/types';
import { getDataProvider } from '@/lib/data/data-provider';

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false';

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

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    profile: null,
    isLoading: false,
    mode: DEMO_MODE ? 'demo' : 'supabase',
  });

  const loginDemo = useCallback(async (role: Role) => {
    const dp = getDataProvider();
    const profiles = await dp.employees.list({ role, active: true });
    const profile = profiles[0];

    if (!profile) {
      throw new Error(`Nenhum perfil demo encontrado para o cargo ${role}.`);
    }

    setState({ isAuthenticated: true, profile, isLoading: false, mode: 'demo' });
  }, []);

  const login = useCallback(async (email: string, _password: string) => {
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

      // Supabase mode:
      // const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);
      // const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      // if (error) throw error;
      // const profile = await fetchProfile(data.user.id);
      // setState({ isAuthenticated: true, profile, isLoading: false, mode: 'supabase' });
      throw new Error('Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    setState(prev => ({ isAuthenticated: false, profile: null, isLoading: false, mode: prev.mode }));
    // Em Supabase: await supabase.auth.signOut();
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
