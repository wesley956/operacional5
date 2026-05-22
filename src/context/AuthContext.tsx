// ============================================================
// OPERACIONAL5 — Contexto de Autenticação (Final)
// ============================================================
// Suporta dois modos:
// 1. DEMO_MODE=true  → usa perfis demo em memória
// 2. DEMO_MODE=false → usa Supabase Auth (preparado)
// ============================================================

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Profile, Role } from '@/lib/types';
import { DEMO_PROFILES } from '@/lib/mockData';

export const DEMO_MODE = true; // Trocar para false quando Supabase estiver configurado

export interface AuthState {
  isAuthenticated: boolean;
  profile: Profile | null;
  isLoading: boolean;
  mode: 'demo' | 'supabase';
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  loginDemo: (role: Role) => void;
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

  const loginDemo = useCallback((role: Role) => {
    const profile = DEMO_PROFILES.find(p => p.role === role);
    if (profile) {
      setState({ isAuthenticated: true, profile, isLoading: false, mode: 'demo' });
    }
  }, []);

  const login = useCallback(async (_email: string, _password: string) => {
    if (DEMO_MODE) {
      // Demo mode: login por email
      const profile = DEMO_PROFILES.find(p => p.email === _email);
      if (profile) {
        setState({ isAuthenticated: true, profile, isLoading: false, mode: 'demo' });
      } else {
        throw new Error('Email não encontrado no demo.');
      }
    } else {
      // Supabase mode: usar supabase.auth.signInWithPassword
      // const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);
      // const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      // if (error) throw error;
      // const profile = await fetchProfile(data.user.id);
      // setState({ isAuthenticated: true, profile, isLoading: false, mode: 'supabase' });
      throw new Error('Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
    }
  }, []);

  const logout = useCallback(() => {
    setState({ isAuthenticated: false, profile: null, isLoading: false, mode: state.mode });
    // Em Supabase: await supabase.auth.signOut();
  }, [state.mode]);

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
