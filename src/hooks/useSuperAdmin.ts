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
