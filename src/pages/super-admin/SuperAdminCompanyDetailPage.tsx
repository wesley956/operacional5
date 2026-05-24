import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, Loading, Textarea } from '@/components/ui';
import { updateCompanyStatus, useSuperAdminCompany } from '@/hooks/useSuperAdmin';
import { ArrowLeft, CheckCircle2, PauseCircle, XCircle } from 'lucide-react';

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm text-gray-900 mt-1">{value || '—'}</p>
    </div>
  );
}

export function SuperAdminCompanyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { company, isLoading, error, refresh } = useSuperAdminCompany(id);
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  async function handleStatus(status: 'active' | 'suspended' | 'cancelled') {
    if (!id) return;
    setActionLoading(status);
    setActionError(null);
    setActionSuccess(null);

    try {
      await updateCompanyStatus({ companyId: id, status, reason: reason || undefined });
      setActionSuccess(`Status atualizado para ${status}.`);
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao atualizar status.');
    } finally {
      setActionLoading(null);
    }
  }

  if (isLoading) return <Loading message="Carregando empresa..." />;

  if (error) {
    return <Card className="border-red-200 bg-red-50"><p className="text-sm text-red-700">{error}</p></Card>;
  }

  if (!company) {
    return <Card><p className="text-sm text-gray-500">Empresa não encontrada.</p></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <button onClick={() => navigate('/super-admin/companies')} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar para empresas
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
          <p className="text-sm text-gray-500">Gestão comercial e operacional do tenant.</p>
        </div>
        <Badge variant={company.subscription_status === 'active' ? 'success' : company.subscription_status === 'trialing' ? 'warning' : 'danger'}>
          {company.active ? (company.subscription_status ?? 'active') : 'inactive'}
        </Badge>
      </div>

      {(actionError || actionSuccess) && (
        <Card className={actionError ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
          <p className={actionError ? 'text-sm text-red-700' : 'text-sm text-green-700'}>
            {actionError || actionSuccess}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados cadastrais</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <DetailRow label="Nome fantasia" value={company.name} />
            <DetailRow label="Razão social" value={company.legal_name} />
            <DetailRow label="CNPJ/Documento" value={company.document ?? company.cnpj} />
            <DetailRow label="E-mail" value={company.email} />
            <DetailRow label="Telefone" value={company.phone} />
            <DetailRow label="Contato" value={company.contact_name} />
            <DetailRow label="Telefone do contato" value={company.contact_phone} />
            <DetailRow label="Criada em" value={new Date(company.created_at).toLocaleString('pt-BR')} />
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Controle de status</h2>
          <Textarea
            label="Motivo / observação"
            placeholder="Ex.: pagamento confirmado, inadimplência, pedido do cliente..."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="space-y-2 mt-4">
            <Button className="w-full" variant="primary" loading={actionLoading === 'active'} onClick={() => handleStatus('active')}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Ativar/Reativar
            </Button>
            <Button className="w-full" variant="secondary" loading={actionLoading === 'suspended'} onClick={() => handleStatus('suspended')}>
              <PauseCircle className="w-4 h-4 mr-2" />
              Suspender
            </Button>
            <Button className="w-full" variant="danger" loading={actionLoading === 'cancelled'} onClick={() => handleStatus('cancelled')}>
              <XCircle className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            As ações chamam a Edge Function update-company-status e registram auditoria global.
          </p>
        </Card>
      </div>
    </div>
  );
}
