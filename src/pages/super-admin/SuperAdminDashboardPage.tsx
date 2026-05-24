import { Card, Loading, Badge, Button } from '@/components/ui';
import { useSuperAdminCompanies } from '@/hooks/useSuperAdmin';
import { Building2, CheckCircle2, Clock, ShieldAlert, XCircle } from 'lucide-react';

function MetricCard({ title, value, icon, tone }: {
  title: string;
  value: number;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tone}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

export function SuperAdminDashboardPage() {
  const { companies, stats, isLoading, error, refresh } = useSuperAdminCompanies();

  if (isLoading) return <Loading message="Carregando visão global..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Global</h1>
          <p className="text-sm text-gray-500">Visão inicial do SaaS multi-tenant.</p>
        </div>
        <Button variant="secondary" onClick={refresh}>Atualizar</Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard title="Empresas" value={stats.totalCompanies} icon={<Building2 className="w-6 h-6" />} tone="bg-blue-100 text-blue-700" />
        <MetricCard title="Ativas" value={stats.activeCompanies} icon={<CheckCircle2 className="w-6 h-6" />} tone="bg-green-100 text-green-700" />
        <MetricCard title="Trial" value={stats.trialingCompanies} icon={<Clock className="w-6 h-6" />} tone="bg-amber-100 text-amber-700" />
        <MetricCard title="Suspensas" value={stats.suspendedCompanies} icon={<ShieldAlert className="w-6 h-6" />} tone="bg-red-100 text-red-700" />
        <MetricCard title="Canceladas/Expiradas" value={stats.cancelledCompanies} icon={<XCircle className="w-6 h-6" />} tone="bg-gray-100 text-gray-700" />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Empresas recentes</h2>
            <p className="text-sm text-gray-500">Últimos tenants cadastrados.</p>
          </div>
          <Badge variant="info">SuperAdmin</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-3 font-medium">Empresa</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Criada em</th>
              </tr>
            </thead>
            <tbody>
              {companies.slice(0, 6).map(company => (
                <tr key={company.id} className="border-b last:border-0">
                  <td className="py-3 pr-3 font-medium text-gray-900">{company.name}</td>
                  <td className="py-3 pr-3"><Badge>{company.subscription_status ?? 'active'}</Badge></td>
                  <td className="py-3 pr-3 text-gray-500">{new Date(company.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-gray-500">Nenhuma empresa encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
