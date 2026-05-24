import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, Input, Loading } from '@/components/ui';
import { useSuperAdminCompanies } from '@/hooks/useSuperAdmin';
import { Search } from 'lucide-react';

function statusVariant(status?: string | null): 'success' | 'warning' | 'danger' | 'default' | 'info' {
  if (status === 'active') return 'success';
  if (status === 'trialing') return 'warning';
  if (status === 'suspended' || status === 'cancelled' || status === 'expired') return 'danger';
  return 'default';
}

export function SuperAdminCompaniesPage() {
  const navigate = useNavigate();
  const { companies, isLoading, error, refresh } = useSuperAdminCompanies();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return companies;
    return companies.filter(company => [company.name, company.legal_name, company.cnpj, company.document, company.email]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(normalized))
    );
  }, [companies, query]);

  if (isLoading) return <Loading message="Carregando empresas..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
          <p className="text-sm text-gray-500">Lista global dos tenants do Operacional5.</p>
        </div>
        <Button variant="secondary" onClick={refresh}>Atualizar</Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, CNPJ ou e-mail..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-3 font-medium">Empresa</th>
                <th className="py-2 pr-3 font-medium">Documento</th>
                <th className="py-2 pr-3 font-medium">Contato</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Criada em</th>
                <th className="py-2 pr-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(company => (
                <tr key={company.id} className="border-b last:border-0">
                  <td className="py-3 pr-3">
                    <p className="font-medium text-gray-900">{company.name}</p>
                    {company.legal_name && <p className="text-xs text-gray-500">{company.legal_name}</p>}
                  </td>
                  <td className="py-3 pr-3 text-gray-600">{company.document ?? company.cnpj ?? '—'}</td>
                  <td className="py-3 pr-3 text-gray-600">{company.email ?? company.contact_phone ?? '—'}</td>
                  <td className="py-3 pr-3">
                    <Badge variant={statusVariant(company.subscription_status)}>
                      {company.active ? (company.subscription_status ?? 'active') : 'inactive'}
                    </Badge>
                  </td>
                  <td className="py-3 pr-3 text-gray-500">{new Date(company.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="py-3 pr-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => navigate(`/super-admin/companies/${company.id}`)}>
                      Detalhes
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">Nenhuma empresa encontrada.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
