import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Ban, Building2, CalendarClock, CheckCircle2, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Loading } from '@/components/ui';
import { type SuperAdminTrial, updateCompanyStatus, useSuperAdminTrials } from '@/hooks/useSuperAdmin';

function formatDate(dateIso?: string | null) {
  if (!dateIso) return 'Sem data';
  return new Date(dateIso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function TrialBadge({ trial }: { trial: SuperAdminTrial }) {
  if (trial.daysRemaining === null) return <Badge>Sem vencimento</Badge>;
  if (trial.daysRemaining < 0) return <Badge variant="danger">Expirado</Badge>;
  if (trial.daysRemaining <= 3) return <Badge variant="warning">Crítico</Badge>;
  if (trial.daysRemaining <= 7) return <Badge variant="info">Expira em breve</Badge>;
  return <Badge variant="success">Em trial</Badge>;
}

function daysText(trial: SuperAdminTrial) {
  if (trial.daysRemaining === null) return 'Trial sem data de vencimento cadastrada.';
  if (trial.daysRemaining < 0) return `Expirou há ${Math.abs(trial.daysRemaining)} dia${Math.abs(trial.daysRemaining) === 1 ? '' : 's'}.`;
  if (trial.daysRemaining === 0) return 'Expira hoje.';
  return `Expira em ${trial.daysRemaining} dia${trial.daysRemaining === 1 ? '' : 's'}.`;
}

export function SuperAdminTrialsPage() {
  const { trials, isLoading, error, refresh } = useSuperAdminTrials();
  const [actionCompanyId, setActionCompanyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const sortedTrials = useMemo(() => {
    return [...trials].sort((a, b) => {
      const aDays = a.daysRemaining ?? 9999;
      const bDays = b.daysRemaining ?? 9999;
      return aDays - bDays;
    });
  }, [trials]);

  const expiringSoon = sortedTrials.filter(trial => trial.daysRemaining !== null && trial.daysRemaining >= 0 && trial.daysRemaining <= 7).length;
  const expired = sortedTrials.filter(trial => trial.daysRemaining !== null && trial.daysRemaining < 0).length;

  async function runStatusAction(trial: SuperAdminTrial, status: 'active' | 'suspended') {
    const reason = status === 'suspended'
      ? window.prompt(`Informe o motivo da suspensão de ${trial.companyName}:`)?.trim()
      : undefined;

    if (status === 'suspended' && !reason) return;

    setActionCompanyId(trial.companyId);
    setActionError(null);
    try {
      await updateCompanyStatus({
        companyId: trial.companyId,
        status,
        reason,
      });
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao atualizar status.');
    } finally {
      setActionCompanyId(null);
    }
  }

  if (isLoading) {
    return <Loading message="Carregando trials..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600">SuperAdmin</p>
          <h1 className="text-2xl font-bold text-gray-900">Trials e ativação</h1>
          <p className="mt-1 text-sm text-gray-500">Acompanhe empresas em teste, expiradas e prontas para ativação comercial.</p>
        </div>
        <Button variant="secondary" onClick={refresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {(error || actionError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error ?? actionError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">Trials totais</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{sortedTrials.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Vencendo em até 7 dias</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{expiringSoon}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Expirados</p>
          <p className="mt-2 text-3xl font-bold text-red-600">{expired}</p>
        </Card>
      </div>

      <Card padding={false}>
        {sortedTrials.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-12 w-12 text-gray-300" />}
            title="Nenhum trial em andamento"
            description="Quando uma empresa for criada com plano de teste, ela aparecerá aqui para ativação ou suspensão."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Empresa</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Vencimento</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Situação</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sortedTrials.map(trial => (
                  <tr key={trial.subscriptionId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <Link to={`/super-admin/companies/${trial.companyId}`} className="font-medium text-gray-900 hover:text-blue-700">
                            {trial.companyName}
                          </Link>
                          <p className="text-xs text-gray-500">{trial.companyId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={trial.status === 'trialing' ? 'info' : 'danger'}>{trial.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(trial.trialEndsAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <TrialBadge trial={trial} />
                        <span className="text-xs text-gray-500">{daysText(trial)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          loading={actionCompanyId === trial.companyId}
                          onClick={() => void runStatusAction(trial, 'active')}
                        >
                          <CheckCircle2 className="mr-1.5 h-4 w-4" />
                          Ativar
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={actionCompanyId === trial.companyId}
                          onClick={() => void runStatusAction(trial, 'suspended')}
                        >
                          <Ban className="mr-1.5 h-4 w-4" />
                          Suspender
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <div className="flex gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            Empresas com trial vencido são bloqueadas pelo guard de assinatura no login. Use esta tela para ativar clientes pagantes ou suspender acessos manualmente.
          </p>
        </div>
      </div>
    </div>
  );
}
