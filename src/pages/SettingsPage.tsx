// ============================================================
// OPERACIONAL5 — Página de Configurações Reais por Tenant
// ============================================================

import { useEffect, useState, type ReactNode } from 'react';
import { PageHeader, Card, Button, Input } from '@/components/ui';
import { useCompanySettings, type CompanySettingsState } from '@/hooks/useCompanySettings';
import {
  AlertCircle,
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  Database,
  Key,
  Mail,
  MapPin,
  Palette,
  Phone,
  RefreshCcw,
  Shield,
  Smartphone,
  Upload,
} from 'lucide-react';

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function validateSettings(form: CompanySettingsState): string | null {
  if (form.companyName.trim().length < 3) return 'Informe o nome da empresa com pelo menos 3 caracteres.';
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Informe um e-mail válido.';

  const cnpj = onlyDigits(form.cnpj || form.document);
  if (cnpj && cnpj.length !== 14) return 'O CNPJ deve ter 14 dígitos.';

  if (Number(form.toleranceMinutes) < 0) return 'A tolerância não pode ser negativa.';
  if (Number(form.defaultGpsRadius) < 1) return 'O raio GPS padrão deve ser maior que zero.';
  if (Number(form.minGpsAccuracy) < 1) return 'A acurácia mínima deve ser maior que zero.';
  if (Number(form.rondaIntervalMinutes) < 1) return 'O intervalo de rondas deve ser maior que zero.';

  return null;
}

export function SettingsPage() {
  const { settings, isLoading, isSaving, isUploading, error, refresh, saveSettings, uploadLogo } = useCompanySettings();
  const [form, setForm] = useState<CompanySettingsState | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  function updateField<K extends keyof CompanySettingsState>(field: K, value: CompanySettingsState[K]) {
    setForm(current => current ? { ...current, [field]: value } : current);
    setFeedback(null);
    setFormError(null);
  }

  async function handleSave() {
    if (!form) return;

    const validation = validateSettings(form);
    if (validation) {
      setFormError(validation);
      return;
    }

    try {
      const saved = await saveSettings(form);
      setForm(saved);
      setFeedback('Configurações salvas com sucesso.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível salvar as configurações.');
    }
  }

  async function handleLogoChange(file?: File | null) {
    if (!file || !form) return;

    try {
      const logoUrl = await uploadLogo(file);
      const next = { ...form, logoUrl };
      const saved = await saveSettings(next);
      setForm(saved);
      setFeedback('Logo enviada e salva com sucesso.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível enviar a logo.');
    }
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Configurações" subtitle="Carregando dados reais da empresa..." />
        <Card>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Buscando configurações do tenant logado.
          </div>
        </Card>
      </div>
    );
  }

  if (!form) {
    return (
      <div>
        <PageHeader title="Configurações" subtitle="Não foi possível carregar as configurações." />
        <Card>
          <div className="flex items-start gap-3 text-sm text-red-700">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-semibold">Configurações indisponíveis</p>
              <p>{error || 'Seu usuário não está vinculado a uma empresa válida.'}</p>
              <Button className="mt-4" variant="secondary" onClick={() => void refresh()}>
                Tentar novamente
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const visibleError = formError || error;

  return (
    <div>
      <PageHeader
        title="Configurações"
        subtitle="Dados reais da empresa, parâmetros operacionais e notificações do tenant logado"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void refresh()} disabled={isSaving || isUploading}>
              <RefreshCcw className="w-4 h-4 mr-2" />
              Recarregar
            </Button>
            <Button onClick={() => void handleSave()} loading={isSaving} disabled={isUploading}>
              Salvar alterações
            </Button>
          </div>
        }
      />

      {(visibleError || feedback) && (
        <div className={`mb-6 rounded-lg border p-4 text-sm ${visibleError ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          <div className="flex items-start gap-2">
            {visibleError ? <AlertCircle className="w-4 h-4 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 mt-0.5" />}
            <p>{visibleError || feedback}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <SectionTitle icon={<Building2 className="w-5 h-5 text-blue-600" />} color="blue" title="Dados da Empresa" />
          <div className="space-y-4">
            <Input id="company-name" label="Nome fantasia" value={form.companyName} onChange={(event) => updateField('companyName', event.target.value)} />
            <Input id="company-legal-name" label="Razão social" value={form.legalName} onChange={(event) => updateField('legalName', event.target.value)} />
            <Input id="company-cnpj" label="CNPJ" value={form.cnpj} onChange={(event) => updateField('cnpj', event.target.value)} placeholder="00.000.000/0000-00" />
            <Input id="company-email" label="E-mail da empresa" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} />
            <Input id="company-phone" label="Telefone" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
            <Input id="company-address" label="Endereço" value={form.address} onChange={(event) => updateField('address', event.target.value)} />
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<Phone className="w-5 h-5 text-green-600" />} color="green" title="Contato e Branding" />
          <div className="space-y-4">
            <Input id="contact-name" label="Responsável comercial/operacional" value={form.contactName} onChange={(event) => updateField('contactName', event.target.value)} />
            <Input id="contact-phone" label="Telefone do responsável" value={form.contactPhone} onChange={(event) => updateField('contactPhone', event.target.value)} />
            <Input id="primary-color" label="Cor principal" type="color" value={form.primaryColor} onChange={(event) => updateField('primaryColor', event.target.value)} />
            <Input id="logo-url" label="URL da logo" value={form.logoUrl} onChange={(event) => updateField('logoUrl', event.target.value)} placeholder="https://..." />
            <div>
              <label htmlFor="logo-file" className="block text-sm font-medium text-gray-700 mb-1">Enviar logo</label>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <input
                  id="logo-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  disabled={isUploading || isSaving}
                  onChange={(event) => void handleLogoChange(event.target.files?.[0])}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
                />
                {isUploading && <span className="text-xs text-gray-500">Enviando...</span>}
              </div>
              <p className="mt-1 text-xs text-gray-500">JPEG, PNG, WebP ou SVG até 2MB.</p>
            </div>
            {form.logoUrl && (
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Prévia da logo</p>
                <img src={form.logoUrl} alt="Logo da empresa" className="max-h-16 max-w-full object-contain" />
              </div>
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<Clock className="w-5 h-5 text-orange-600" />} color="orange" title="Configurações Operacionais" />
          <div className="space-y-4">
            <Input id="timezone" label="Timezone" value={form.timezone} onChange={(event) => updateField('timezone', event.target.value)} />
            <Input id="locale" label="Localidade" value={form.locale} onChange={(event) => updateField('locale', event.target.value)} />
            <Input id="tolerance" label="Tolerância de check-in (minutos)" type="number" min="0" value={form.toleranceMinutes} onChange={(event) => updateField('toleranceMinutes', Number(event.target.value))} />
            <Input id="default-radius" label="Raio GPS padrão (metros)" type="number" min="1" value={form.defaultGpsRadius} onChange={(event) => updateField('defaultGpsRadius', Number(event.target.value))} />
            <Input id="min-accuracy" label="Acurácia mínima GPS (metros)" type="number" min="1" value={form.minGpsAccuracy} onChange={(event) => updateField('minGpsAccuracy', Number(event.target.value))} />
            <Input id="ronda-interval" label="Intervalo de rondas (minutos)" type="number" min="1" value={form.rondaIntervalMinutes} onChange={(event) => updateField('rondaIntervalMinutes', Number(event.target.value))} />
            <CheckboxSetting id="require-photo" label="Exigir foto nos check-ins" checked={form.requirePhoto} onChange={(value) => updateField('requirePhoto', value)} />
            <CheckboxSetting id="mock-detect" label="Detectar GPS falso/mock location" checked={form.detectMockLocation} onChange={(value) => updateField('detectMockLocation', value)} />
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<Bell className="w-5 h-5 text-purple-600" />} color="purple" title="Notificações" />
          <div className="space-y-3">
            <NotificationSetting
              icon={<Shield className="w-4 h-4" />}
              title="SOS"
              description="Notificar supervisor e gerente quando SOS for disparado"
              enabled={form.notifySos}
              onChange={(value) => updateField('notifySos', value)}
            />
            <NotificationSetting
              icon={<Clock className="w-4 h-4" />}
              title="Ausência"
              description="Alertar quando operador não aparecer após a tolerância"
              enabled={form.notifyAbsence}
              onChange={(value) => updateField('notifyAbsence', value)}
            />
            <NotificationSetting
              icon={<MapPin className="w-4 h-4" />}
              title="GPS falso"
              description="Alertar quando mock location for detectado"
              enabled={form.notifyMockLocation}
              onChange={(value) => updateField('notifyMockLocation', value)}
            />
            <NotificationSetting
              icon={<Smartphone className="w-4 h-4" />}
              title="Push notifications"
              description="Depende da configuração real de FCM na fase de push"
              enabled={false}
              disabled
            />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle icon={<Database className="w-5 h-5 text-gray-600" />} color="gray" title="Storage & Segurança" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Buckets</h4>
              <div className="text-xs space-y-1">
                <p className="flex items-center gap-1 text-green-600"><Key className="w-3 h-3" /> Evidências: <code className="bg-gray-200 px-1 rounded">evidence/company_id/...</code></p>
                <p className="flex items-center gap-1 text-green-600"><Upload className="w-3 h-3" /> Logos: <code className="bg-gray-200 px-1 rounded">logos/company_id/...</code></p>
                <p className="text-gray-400">Policies isolam escrita por company_id.</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Segurança</h4>
              <div className="text-xs space-y-2">
                <p className="flex items-center gap-2 text-green-600"><Shield className="w-3 h-3" /> RLS habilitado nas tabelas de configuração</p>
                <p className="flex items-center gap-2 text-green-600"><Key className="w-3 h-3" /> Isolamento por company_id</p>
                <p className="flex items-center gap-2 text-green-600"><Mail className="w-3 h-3" /> Dados persistidos no tenant real</p>
                <p className="flex items-center gap-2 text-green-600"><Palette className="w-3 h-3" /> Branding por empresa</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 text-center">
        <p className="text-xs text-gray-400">
          OPERACIONAL5 v1.0.0-mvp1 • Configurações reais por tenant
        </p>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, color }: { icon: ReactNode; title: string; color: 'blue' | 'green' | 'orange' | 'purple' | 'gray' }) {
  const background = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    orange: 'bg-orange-100',
    purple: 'bg-purple-100',
    gray: 'bg-gray-100',
  }[color];

  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`p-2 ${background} rounded-lg`}>{icon}</div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
    </div>
  );
}

function CheckboxSetting({ id, label, checked, onChange }: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input id={id} type="checkbox" className="rounded" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <label htmlFor={id} className="text-sm text-gray-700">{label}</label>
    </div>
  );
}

function NotificationSetting({ icon, title, description, enabled, disabled, onChange }: {
  icon: ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onChange?: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange?.(!enabled)}
      className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${disabled ? 'bg-gray-50 opacity-60 cursor-not-allowed' : 'bg-gray-50 hover:bg-gray-100'}`}
    >
      <div className="flex items-center gap-3">
        <div className="text-gray-500">{icon}</div>
        <div>
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <div className="flex items-center">
        <div className={`w-10 h-5 rounded-full relative ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
          <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${enabled ? 'right-0.5' : 'left-0.5'}`} />
        </div>
      </div>
    </button>
  );
}
