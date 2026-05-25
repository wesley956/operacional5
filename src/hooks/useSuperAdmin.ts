import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

export type CompanySubscriptionStatus = 'trialing' | 'active' | 'suspended' | 'cancelled' | 'expired' | string;

export interface SuperAdminCompany {
  id: string;
  name: string;
  legal_name?: string | null;
  cnpj?: string | null;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  active: boolean;
  subscription_status?: CompanySubscriptionStatus | null;
  last_access_at?: string | null;
  created_at: string;
}


export interface SuperAdminTrial {
  subscriptionId: string;
  companyId: string;
  companyName: string;
  companyActive: boolean;
  companySubscriptionStatus?: string | null;
  status: CompanySubscriptionStatus;
  trialEndsAt?: string | null;
  createdAt: string;
  daysRemaining: number | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getDaysRemaining(dateIso?: string | null): number | null {
  if (!dateIso) return null;
  const target = new Date(dateIso);
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  return Math.ceil((target.getTime() - today.getTime()) / MS_PER_DAY);
}

function normalizeTrial(row: Record<string, unknown>): SuperAdminTrial {
  const nestedCompany = row.companies as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
  const company = Array.isArray(nestedCompany) ? nestedCompany[0] : nestedCompany;
  const trialEndsAt = row.trial_ends_at as string | null | undefined;

  return {
    subscriptionId: String(row.id),
    companyId: String(row.company_id),
    companyName: String(company?.name ?? 'Empresa sem nome'),
    companyActive: company?.active !== false,
    companySubscriptionStatus: company?.subscription_status as string | null | undefined,
    status: String(row.status ?? 'trialing') as CompanySubscriptionStatus,
    trialEndsAt,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    daysRemaining: getDaysRemaining(trialEndsAt),
  };
}

export function useSuperAdminTrials() {
  const [trials, setTrials] = useState<SuperAdminTrial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: queryError } = await supabase
        .from('company_subscriptions')
        .select('id,company_id,status,trial_ends_at,created_at,companies(id,name,active,subscription_status,created_at)')
        .in('status', ['trialing', 'expired'])
        .order('trial_ends_at', { ascending: true, nullsFirst: false });

      if (queryError) throw queryError;

      setTrials((data ?? []).map(row => normalizeTrial(row as Record<string, unknown>)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar trials.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { trials, isLoading, error, refresh };
}

export interface PlatformStats {
  totalCompanies: number;
  activeCompanies: number;
  trialingCompanies: number;
  suspendedCompanies: number;
  cancelledCompanies: number;
}

function normalizeCompany(row: Record<string, unknown>): SuperAdminCompany {
  return {
    id: String(row.id),
    name: String(row.name ?? 'Empresa sem nome'),
    legal_name: row.legal_name as string | null | undefined,
    cnpj: row.cnpj as string | null | undefined,
    document: row.document as string | null | undefined,
    email: row.email as string | null | undefined,
    phone: row.phone as string | null | undefined,
    contact_name: row.contact_name as string | null | undefined,
    contact_phone: row.contact_phone as string | null | undefined,
    active: row.active !== false,
    subscription_status: row.subscription_status as CompanySubscriptionStatus | null | undefined,
    last_access_at: row.last_access_at as string | null | undefined,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export function useSuperAdminCompanies() {
  const [companies, setCompanies] = useState<SuperAdminCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: queryError } = await supabase
        .from('companies')
        .select('id,name,legal_name,cnpj,document,email,phone,contact_name,contact_phone,active,subscription_status,last_access_at,created_at')
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;

      setCompanies((data ?? []).map(row => normalizeCompany(row as Record<string, unknown>)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar empresas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo<PlatformStats>(() => {
    return {
      totalCompanies: companies.length,
      activeCompanies: companies.filter(c => c.subscription_status === 'active' && c.active).length,
      trialingCompanies: companies.filter(c => c.subscription_status === 'trialing').length,
      suspendedCompanies: companies.filter(c => c.subscription_status === 'suspended' || !c.active).length,
      cancelledCompanies: companies.filter(c => c.subscription_status === 'cancelled' || c.subscription_status === 'expired').length,
    };
  }, [companies]);

  return { companies, stats, isLoading, error, refresh };
}

export function useSuperAdminCompany(companyId?: string) {
  const { companies, isLoading, error, refresh } = useSuperAdminCompanies();
  const company = companies.find(item => item.id === companyId) ?? null;
  return { company, isLoading, error, refresh };
}

export async function updateCompanyStatus(input: {
  companyId: string;
  status: 'trialing' | 'active' | 'suspended' | 'cancelled' | 'expired';
  reason?: string;
}) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('update-company-status', {
    body: {
      company_id: input.companyId,
      status: input.status,
      reason: input.reason,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export interface CreateCompanyInput {
  company_name: string;
  legal_name?: string;
  document?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  admin_name: string;
  admin_email: string;
  plan: 'free_trial' | 'basic' | 'professional' | 'enterprise' | string;
  trial_days: number;
  timezone: string;
  locale: string;
}

export interface CreateCompanyResult {
  ok: boolean;
  company_id: string;
  company_name: string;
  admin_email: string;
  plan: string;
  trial_ends_at: string;
  note?: string;
}

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : 'Edge Function retornou erro.';

  const maybeContext = error as { context?: Response };
  if (!maybeContext.context) return fallback;

  try {
    const body = await maybeContext.context.clone().json();
    if (body?.error) return String(body.error);
    if (body?.message) return String(body.message);
  } catch {
    // Ignore JSON parse errors and try text below.
  }

  try {
    const text = await maybeContext.context.clone().text();
    if (text) return text;
  } catch {
    // Ignore text parse errors.
  }

  return fallback;
}

export async function createCompany(input: CreateCompanyInput): Promise<CreateCompanyResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('create-company', {
    body: input,
  });

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  if (!data || data.ok === false) {
    throw new Error(data?.error ?? 'Erro ao criar empresa.');
  }

  return data as CreateCompanyResult;
}
