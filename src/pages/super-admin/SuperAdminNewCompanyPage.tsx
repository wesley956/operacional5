import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, Input, SelectField } from '@/components/ui';
import { createCompany, type CreateCompanyInput, type CreateCompanyResult } from '@/hooks/useSuperAdmin';
import { ArrowLeft, Building2, CheckCircle2 } from 'lucide-react';

type FormState = CreateCompanyInput;

const INITIAL_FORM: FormState = {
  company_name: '',
  legal_name: '',
  document: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  admin_name: '',
  admin_email: '',
  plan: 'free_trial',
  trial_days: 14,
  timezone: 'America/Sao_Paulo',
  locale: 'pt-BR',
};

const PLAN_OPTIONS = [
  { value: 'free_trial', label: 'Teste grátis' },
  { value: 'basic', label: 'Basic' },
  { value: 'professional', label: 'Professional' },
  { value: 'enterprise', label: 'Enterprise' },
];

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validate(form: FormState): string | null {
  if (form.company_name.trim().length < 3) return 'Informe o nome da empresa com pelo menos 3 caracteres.';
  if (form.contact_email && !isEmail(form.contact_email)) return 'E-mail de contato inválido.';
  if (form.admin_name.trim().length < 3) return 'Informe o nome do admin da empresa.';
  if (!isEmail(form.admin_email)) return 'Informe um e-mail válido para o admin da empresa.';
  if (form.document && digitsOnly(form.document).length !== 14) return 'O CNPJ deve ter 14 dígitos ou ficar em branco.';
  if (Number(form.trial_days) < 1 || Number(form.trial_days) > 90) return 'O trial deve ter entre 1 e 90 dias.';
  return null;
}

export function SuperAdminNewCompanyPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateCompanyResult | null>(null);

  const previewTrialEnd = useMemo(() => {
    const days = Number(form.trial_days || 0);
    if (!Number.isFinite(days) || days < 1) return '—';
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('pt-BR');
  }, [form.trial_days]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const validationError = validate(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createCompany({
        ...form,
        document: digitsOnly(form.document || ''),
        trial_days: Number(form.trial_days),
      });
      setResult(created);
      setForm(INITIAL_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar empresa.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <button onClick={() => navigate('/super-admin/companies')} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar para empresas
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Criar empresa</h1>
          <p className="text-sm text-gray-500">Onboarding inicial de um novo tenant do Operacional5.</p>
        </div>
        <Badge variant="info">create-company</Badge>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      )}

      {result && (
        <Card className="border-green-200 bg-green-50">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-700 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-green-900">Empresa criada com sucesso.</p>
              <p className="text-sm text-green-800">
                {result.company_name} foi criada no plano {result.plan}. Convite enviado para {result.admin_email}.
              </p>
              <p className="text-xs text-green-700">Trial até {new Date(result.trial_ends_at).toLocaleString('pt-BR')}.</p>
              <Button size="sm" variant="secondary" onClick={() => navigate(`/super-admin/companies/${result.company_id}`)}>
                Ver detalhes da empresa
              </Button>
            </div>
          </div>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Dados da empresa</h2>
              <p className="text-sm text-gray-500">Esses dados ficam em companies e company_settings.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nome fantasia *" value={form.company_name} onChange={(event) => updateField('company_name', event.target.value)} placeholder="Alpha Segurança" />
            <Input label="Razão social" value={form.legal_name} onChange={(event) => updateField('legal_name', event.target.value)} placeholder="Alpha Segurança e Vigilância Ltda" />
            <Input label="CNPJ" value={form.document} onChange={(event) => updateField('document', event.target.value)} placeholder="12345678000190" />
            <Input label="Nome do contato" value={form.contact_name} onChange={(event) => updateField('contact_name', event.target.value)} placeholder="Ricardo Silva" />
            <Input label="E-mail de contato" type="email" value={form.contact_email} onChange={(event) => updateField('contact_email', event.target.value)} placeholder="financeiro@empresa.com.br" />
            <Input label="Telefone de contato" value={form.contact_phone} onChange={(event) => updateField('contact_phone', event.target.value)} placeholder="(11) 99999-0000" />
            <SelectField label="Timezone" value={form.timezone} onChange={(event) => updateField('timezone', event.target.value)} options={[{ value: 'America/Sao_Paulo', label: 'America/Sao_Paulo' }]} />
            <SelectField label="Locale" value={form.locale} onChange={(event) => updateField('locale', event.target.value)} options={[{ value: 'pt-BR', label: 'pt-BR' }]} />
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Admin da empresa</h2>
            <div className="space-y-4">
              <Input label="Nome do admin *" value={form.admin_name} onChange={(event) => updateField('admin_name', event.target.value)} placeholder="Carlos Mendes" />
              <Input label="E-mail do admin *" type="email" value={form.admin_email} onChange={(event) => updateField('admin_email', event.target.value)} placeholder="admin@empresa.com.br" />
            </div>
            <p className="text-xs text-gray-500 mt-3">A Edge Function criará o usuário no Supabase Auth e o profile com role admin.</p>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Plano e trial</h2>
            <div className="space-y-4">
              <SelectField label="Plano" value={form.plan} onChange={(event) => updateField('plan', event.target.value)} options={PLAN_OPTIONS} />
              <Input label="Dias de trial" type="number" min={1} max={90} value={form.trial_days} onChange={(event) => updateField('trial_days', Number(event.target.value))} />
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                <p className="text-xs text-gray-500">Previsão de fim do trial</p>
                <p className="text-sm font-semibold text-gray-900">{previewTrialEnd}</p>
              </div>
            </div>
          </Card>

          <Card>
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Criar empresa
            </Button>
            <p className="text-xs text-gray-500 mt-3">A criação é feita pela Edge Function create-company com service_role e auditoria global.</p>
          </Card>
        </div>
      </form>
    </div>
  );
}
