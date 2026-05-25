import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

export type MobileRole = 'operador' | 'lider' | 'supervisor' | 'gerente' | 'diretor' | 'admin';

export const MOBILE_ALLOWED_ROLES: MobileRole[] = ['operador', 'lider', 'supervisor'];

export function isMobileFieldRole(role: MobileRole) {
  return MOBILE_ALLOWED_ROLES.includes(role);
}

export interface MobileProfile {
  id: string;
  user_id: string;
  company_id: string;
  role: MobileRole;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
}

interface AuthContextValue {
  loading: boolean;
  session: Session | null;
  profile: MobileProfile | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(userId: string): Promise<MobileProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,user_id,company_id,role,name,email,phone,active')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return (data as MobileProfile | null) ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    setError(null);
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    const currentSession = data.session ?? null;
    setSession(currentSession);

    if (currentSession?.user?.id) {
      const currentProfile = await fetchProfile(currentSession.user.id);
      setProfile(currentProfile);
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    loadSession()
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user?.id) {
        try {
          setProfile(await fetchProfile(nextSession.user.id));
        } catch (err) {
          setProfile(null);
          setError(err instanceof Error ? err.message : String(err));
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [loadSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      setSession(data.session ?? null);

      if (data.user?.id) {
        const currentProfile = await fetchProfile(data.user.id);
        if (!currentProfile) {
          throw new Error('Usuário autenticado, mas sem profile vinculado a uma empresa.');
        }
        if (!currentProfile.active) {
          throw new Error('Perfil inativo. Fale com o administrador da empresa.');
        }
        if (!isMobileFieldRole(currentProfile.role)) {
          await supabase.auth.signOut();
          setSession(null);
          setProfile(null);
          throw new Error('Este aplicativo mobile é para operação de campo. Use o painel web para funções administrativas.');
        }
        setProfile(currentProfile);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    setProfile(await fetchProfile(session.user.id));
  }, [session?.user?.id]);

  const value = useMemo(
    () => ({ loading, session, profile, error, signIn, signOut, refreshProfile }),
    [loading, session, profile, error, signIn, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa ser usado dentro de AuthProvider');
  return ctx;
}
