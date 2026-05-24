import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getSupabaseClient } from '@/lib/supabase/client';

export interface CompanySettingsState {
  companyId: string;
  companyName: string;
  legalName: string;
  cnpj: string;
  document: string;
  phone: string;
  email: string;
  address: string;
  contactName: string;
  contactPhone: string;
  logoUrl: string;
  primaryColor: string;
  timezone: string;
  locale: string;
  toleranceMinutes: number;
  defaultGpsRadius: number;
  minGpsAccuracy: number;
  requirePhoto: boolean;
  detectMockLocation: boolean;
  rondaIntervalMinutes: number;
  notifySos: boolean;
  notifyAbsence: boolean;
  notifyMockLocation: boolean;
}

type CompanyRow = {
  id: string;
  name?: string | null;
  legal_name?: string | null;
  cnpj?: string | null;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logo_url?: string | null;
  timezone?: string | null;
  locale?: string | null;
  tolerance_minutes?: number | null;
  default_gps_radius?: number | null;
  min_gps_accuracy?: number | null;
  require_photo?: boolean | null;
  detect_mock_location?: boolean | null;
};

type CompanySettingsRow = {
  company_id: string;
  logo_url?: string | null;
  primary_color?: string | null;
  timezone?: string | null;
  tolerance_minutes?: number | null;
  default_gps_radius?: number | null;
  min_gps_accuracy?: number | null;
  require_photo?: boolean | null;
  detect_mock_location?: boolean | null;
  ronda_interval_minutes?: number | null;
  notify_sos?: boolean | null;
  notify_absence?: boolean | null;
  notify_mock_location?: boolean | null;
};

const LOCAL_SETTINGS_KEY = 'operacional5-company-settings';

function numberOrDefault(value: number | null | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function boolOrDefault(value: boolean | null | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function fallbackSettings(companyId: string, companyName?: string): CompanySettingsState {
  return {
    companyId,
    companyName: companyName || 'Empresa',
    legalName: companyName || '',
    cnpj: '',
    document: '',
    phone: '',
    email: '',
    address: '',
    contactName: '',
    contactPhone: '',
    logoUrl: '',
    primaryColor: '#1e40af',
    timezone: 'America/Sao_Paulo',
    locale: 'pt-BR',
    toleranceMinutes: 15,
    defaultGpsRadius: 50,
    minGpsAccuracy: 50,
    requirePhoto: true,
    detectMockLocation: true,
    rondaIntervalMinutes: 120,
    notifySos: true,
    notifyAbsence: true,
    notifyMockLocation: true,
  };
}

function normalizeSettings(company: CompanyRow, settings?: CompanySettingsRow | null): CompanySettingsState {
  const base = fallbackSettings(company.id, company.name ?? undefined);

  return {
    ...base,
    companyName: company.name || base.companyName,
    legalName: company.legal_name || company.name || '',
    cnpj: company.cnpj || '',
    document: company.document || company.cnpj || '',
    phone: company.phone || '',
    email: company.email || '',
    address: company.address || '',
    logoUrl: settings?.logo_url || company.logo_url || '',
    primaryColor: settings?.primary_color || base.primaryColor,
    timezone: settings?.timezone || company.timezone || base.timezone,
    locale: company.locale || base.locale,
    toleranceMinutes: numberOrDefault(settings?.tolerance_minutes ?? company.tolerance_minutes, base.toleranceMinutes),
    defaultGpsRadius: numberOrDefault(settings?.default_gps_radius ?? company.default_gps_radius, base.defaultGpsRadius),
    minGpsAccuracy: numberOrDefault(settings?.min_gps_accuracy ?? company.min_gps_accuracy, base.minGpsAccuracy),
    requirePhoto: boolOrDefault(settings?.require_photo ?? company.require_photo, base.requirePhoto),
    detectMockLocation: boolOrDefault(settings?.detect_mock_location ?? company.detect_mock_location, base.detectMockLocation),
    rondaIntervalMinutes: numberOrDefault(settings?.ronda_interval_minutes, base.rondaIntervalMinutes),
    notifySos: boolOrDefault(settings?.notify_sos, base.notifySos),
    notifyAbsence: boolOrDefault(settings?.notify_absence, base.notifyAbsence),
    notifyMockLocation: boolOrDefault(settings?.notify_mock_location, base.notifyMockLocation),
  };
}

function getLocalSettings(base: CompanySettingsState): CompanySettingsState {
  try {
    const raw = window.localStorage.getItem(`${LOCAL_SETTINGS_KEY}:${base.companyId}`);
    if (!raw) return base;
    return { ...base, ...JSON.parse(raw), companyId: base.companyId } as CompanySettingsState;
  } catch {
    return base;
  }
}

function setLocalSettings(settings: CompanySettingsState) {
  window.localStorage.setItem(`${LOCAL_SETTINGS_KEY}:${settings.companyId}`, JSON.stringify(settings));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}

function validateLogoFile(file: File) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
  if (!allowed.includes(file.type)) {
    throw new Error('Use uma imagem JPEG, PNG, WebP ou SVG.');
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new Error('A logo deve ter no máximo 2MB.');
  }
}

export function useCompanySettings() {
  const { profile, companyAccess, mode } = useAuth();
  const [settings, setSettings] = useState<CompanySettingsState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!profile) {
      setSettings(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'demo') {
        const base = fallbackSettings(profile.company_id, companyAccess?.companyName);
        setSettings(getLocalSettings(base));
        return;
      }

      const supabase = getSupabaseClient();

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id,name,legal_name,cnpj,document,phone,email,address,logo_url,timezone,locale,tolerance_minutes,default_gps_radius,min_gps_accuracy,require_photo,detect_mock_location')
        .eq('id', profile.company_id)
        .maybeSingle<CompanyRow>();

      if (companyError) throw companyError;
      if (!company) throw new Error('Empresa não encontrada para o usuário logado.');

      const { data: companySettings, error: settingsError } = await supabase
        .from('company_settings')
        .select('company_id,logo_url,primary_color,timezone,tolerance_minutes,default_gps_radius,min_gps_accuracy,require_photo,detect_mock_location,ronda_interval_minutes,notify_sos,notify_absence,notify_mock_location')
        .eq('company_id', profile.company_id)
        .maybeSingle<CompanySettingsRow>();

      if (settingsError) throw settingsError;

      setSettings(normalizeSettings(company, companySettings));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar configurações.');
    } finally {
      setIsLoading(false);
    }
  }, [companyAccess?.companyName, mode, profile]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveSettings = useCallback(async (next: CompanySettingsState): Promise<CompanySettingsState> => {
    if (!profile) throw new Error('Usuário sem empresa vinculada.');

    setIsSaving(true);
    setError(null);

    try {
      const normalized: CompanySettingsState = {
        ...next,
        companyId: profile.company_id,
        companyName: next.companyName.trim(),
        legalName: next.legalName.trim(),
        cnpj: next.cnpj.trim(),
        document: next.document.trim(),
        phone: next.phone.trim(),
        email: next.email.trim(),
        address: next.address.trim(),
        contactName: next.contactName.trim(),
        contactPhone: next.contactPhone.trim(),
        logoUrl: next.logoUrl.trim(),
        timezone: next.timezone.trim() || 'America/Sao_Paulo',
        locale: next.locale.trim() || 'pt-BR',
        toleranceMinutes: Math.max(0, Number(next.toleranceMinutes) || 0),
        defaultGpsRadius: Math.max(1, Number(next.defaultGpsRadius) || 50),
        minGpsAccuracy: Math.max(1, Number(next.minGpsAccuracy) || 50),
        rondaIntervalMinutes: Math.max(1, Number(next.rondaIntervalMinutes) || 120),
      };

      if (mode === 'demo') {
        setLocalSettings(normalized);
        setSettings(normalized);
        return normalized;
      }

      const supabase = getSupabaseClient();

      const companyUpdate = {
        name: normalized.companyName,
        legal_name: normalized.legalName || normalized.companyName,
        cnpj: normalized.cnpj || null,
        document: normalized.document || normalized.cnpj || null,
        phone: normalized.phone || null,
        email: normalized.email || null,
        address: normalized.address || null,
        logo_url: normalized.logoUrl || null,
        timezone: normalized.timezone,
        locale: normalized.locale,
        tolerance_minutes: normalized.toleranceMinutes,
        default_gps_radius: normalized.defaultGpsRadius,
        min_gps_accuracy: normalized.minGpsAccuracy,
        require_photo: normalized.requirePhoto,
        detect_mock_location: normalized.detectMockLocation,
        updated_at: new Date().toISOString(),
      };

      const { error: companyError } = await supabase
        .from('companies')
        .update(companyUpdate)
        .eq('id', profile.company_id);

      if (companyError) throw companyError;

      const settingsUpdate = {
        company_id: profile.company_id,
        logo_url: normalized.logoUrl || null,
        primary_color: normalized.primaryColor || '#1e40af',
        timezone: normalized.timezone,
        tolerance_minutes: normalized.toleranceMinutes,
        default_gps_radius: normalized.defaultGpsRadius,
        min_gps_accuracy: normalized.minGpsAccuracy,
        require_photo: normalized.requirePhoto,
        detect_mock_location: normalized.detectMockLocation,
        ronda_interval_minutes: normalized.rondaIntervalMinutes,
        notify_sos: normalized.notifySos,
        notify_absence: normalized.notifyAbsence,
        notify_mock_location: normalized.notifyMockLocation,
        updated_at: new Date().toISOString(),
      };

      const { error: settingsError } = await supabase
        .from('company_settings')
        .upsert(settingsUpdate, { onConflict: 'company_id' });

      if (settingsError) throw settingsError;

      setSettings(normalized);
      return normalized;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar configurações.';
      setError(message);
      throw new Error(message);
    } finally {
      setIsSaving(false);
    }
  }, [mode, profile]);

  const uploadLogo = useCallback(async (file: File): Promise<string> => {
    if (!profile) throw new Error('Usuário sem empresa vinculada.');
    validateLogoFile(file);

    setIsUploading(true);
    setError(null);

    try {
      if (mode === 'demo') {
        return await readFileAsDataUrl(file);
      }

      const supabase = getSupabaseClient();
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
      const safeExtension = ['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(extension) ? extension : 'png';
      const path = `${profile.company_id}/logo-${Date.now()}.${safeExtension}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('logos').getPublicUrl(path);
      if (!data.publicUrl) throw new Error('Upload concluído, mas URL pública não foi gerada.');
      return data.publicUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar logo.';
      setError(message);
      throw new Error(message);
    } finally {
      setIsUploading(false);
    }
  }, [mode, profile]);

  return {
    settings,
    isLoading,
    isSaving,
    isUploading,
    error,
    refresh,
    saveSettings,
    uploadLogo,
  };
}
