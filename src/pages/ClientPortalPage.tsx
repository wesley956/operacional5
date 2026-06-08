// ============================================================
// OPERACIONAL5 — Portal Externo do Cliente
// ============================================================

import { PageHeader, Card, Badge, Button } from '@/components/ui';
import { useClients, useOccurrences, usePosts } from '@/hooks';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useProfile } from '@/context/AuthContext';
import { formatRelativeTime, cn } from '@/lib/utils';
import {
  Building2, Eye, FileText, Phone, Mail, ExternalLink,
  BarChart3, AlertTriangle, CheckCircle, Lock,
} from 'lucide-react';

export function ClientPortalPage() {
  const profile = useProfile();
  const linkedClientId = profile.client_id ?? null;

  const { clients, loading: clientsLoading } = useClients({ active: true });
  const { posts } = usePosts(linkedClientId ? { client_id: linkedClientId } : undefined);
  const { occurrences } = useOccurrences();
  const { settings } = useCompanySettings();

  const isClientViewer = profile.role === 'client_viewer';
  const client = linkedClientId
    ? clients.find(item => item.id === linkedClientId) ?? null
    : null;

  const clientPosts = linkedClientId ? posts.filter(post => post.client_id === linkedClientId) : [];
  const clientPostIds = new Set(clientPosts.map(post => post.id));
  const clientOccurrences = occurrences.filter(occurrence => clientPostIds.has(occurrence.post_id));

  const openOccurrences = clientOccurrences.filter(item => item.status === 'aberta' || item.status === 'em_tratamento').length;
  const activePosts = clientPosts.length;
  const coverage = activePosts > 0 && openOccurrences === 0 ? 100 : activePosts > 0 ? 85 : 0;

  const coverageColor = coverage >= 90
    ? 'text-green-600' : coverage >= 70
    ? 'text-yellow-600' : 'text-red-600';

  const coverageBg = coverage >= 90
    ? 'bg-green-500' : coverage >= 70
    ? 'bg-yellow-500' : 'bg-red-500';

  const contactPhone = settings?.phone || client?.contact_phone || 'Não informado';
  const contactEmail = settings?.email || client?.contact_email || 'Não informado';

  if (!isClientViewer || !linkedClientId) {
    return (
      <div>
        <PageHeader
          title="Portal do Cliente"
          subtitle="Este acesso é exclusivo para usuários externos vinculados a um cliente."
          actions={
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-100 px-3 py-2 rounded-lg">
              <Lock className="w-3.5 h-3.5" />
              Acesso restrito ao cliente
            </div>
          }
        />
        <Card>
          <div className="text-center py-8">
            <Lock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900">Usuário não vinculado a cliente</h3>
            <p className="text-sm text-gray-500 mt-1">
              Para acessar este portal, o perfil precisa ter role client_viewer e client_id preenchido.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (!client && !clientsLoading) {
    return (
      <div>
        <PageHeader
          title="Portal do Cliente"
          subtitle="Não foi possível carregar o cliente vinculado ao seu usuário."
          actions={
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-100 px-3 py-2 rounded-lg">
              <Lock className="w-3.5 h-3.5" />
              Acesso restrito ao cliente
            </div>
          }
        />
        <Card>
          <div className="text-center py-8">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900">Cliente não encontrado</h3>
            <p className="text-sm text-gray-500 mt-1">
              O vínculo existe no perfil, mas o cliente não foi retornado pelas regras de acesso.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Portal do Cliente"
        subtitle={clientsLoading ? 'Carregando cliente...' : `Visão exclusiva para ${client?.name ?? 'cliente'}`}
        actions={
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-100 px-3 py-2 rounded-lg">
            <Lock className="w-3.5 h-3.5" />
            Acesso restrito ao cliente
          </div>
        }
      />

      <Card className="mb-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{client?.name ?? 'Cliente'}</h2>
              <p className="text-blue-200 text-sm">{activePosts} postos ativos vinculados</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => { if (contactPhone !== 'Não informado') window.location.href = `tel:${contactPhone}`; }}>
              <Phone className="w-4 h-4 mr-1" /> Contato
            </Button>
            <Button variant="secondary" size="sm">
              <FileText className="w-4 h-4 mr-1" /> Relatório
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{activePosts}</p>
            <p className="text-xs text-gray-500 mt-1">Postos Ativos</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className={cn('text-3xl font-bold', coverageColor)}>{coverage.toFixed(0)}%</p>
            <p className="text-xs text-gray-500 mt-1">Indicador Operacional</p>
            <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full', coverageBg)} style={{ width: `${coverage}%` }} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-3xl font-bold text-orange-600">{clientOccurrences.length}</p>
            <p className="text-xs text-gray-500 mt-1">Ocorrências Visíveis</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-3xl font-bold text-yellow-600">{openOccurrences}</p>
            <p className="text-xs text-gray-500 mt-1">Pendências</p>
          </div>
        </Card>
      </div>

      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Postos Vinculados</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {clientPosts.map(post => (
            <Card key={post.id} className="border-t-4 border-t-blue-500">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">{post.name}</h3>
                <Badge variant={post.active ? 'success' : 'warning'}>
                  {post.active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> Endereço</span>
                  <span className="font-medium text-right">{post.address}</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100">
                <button className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" /> Ver detalhes
                </button>
              </div>
            </Card>
          ))}

          {clientPosts.length === 0 && (
            <Card>
              <p className="text-sm text-gray-500 text-center py-4">Nenhum posto vinculado a este cliente.</p>
            </Card>
          )}
        </div>
      </div>

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Ocorrências Recentes</h3>
          <Badge variant="info">{clientOccurrences.length}</Badge>
        </div>
        <div className="space-y-3">
          {clientOccurrences.slice(0, 5).map(occ => (
            <div key={occ.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-1.5 rounded-lg',
                  occ.severity === 'critica' ? 'bg-red-100' : occ.severity === 'alta' ? 'bg-orange-100' : 'bg-yellow-100'
                )}>
                  {occ.severity === 'critica' ? <AlertTriangle className="w-4 h-4 text-red-600" /> : <CheckCircle className="w-4 h-4 text-green-600" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{occ.type.toUpperCase()}</p>
                  <p className="text-xs text-gray-500">{formatRelativeTime(occ.created_at)}</p>
                </div>
              </div>
              <Badge variant={occ.status === 'aberta' ? 'danger' : occ.status === 'em_tratamento' ? 'warning' : 'success'}>
                {occ.status.replace('_', ' ')}
              </Badge>
            </div>
          ))}
          {clientOccurrences.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">Nenhuma ocorrência recente para este cliente.</p>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-3 text-center">
          🔒 Detalhes sensíveis omitidos para proteção operacional.
        </p>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Relatórios Disponíveis</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Solicite relatórios consolidados do serviço de segurança do seu contrato.
          </p>
          <Button variant="outline" size="sm" className="w-full">
            <ExternalLink className="w-4 h-4 mr-1" /> Solicitar Relatório
          </Button>
        </Card>
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <Phone className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Contato de Emergência</h3>
          </div>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2 text-gray-600"><Phone className="w-4 h-4" /> {contactPhone}</p>
            <p className="flex items-center gap-2 text-gray-600"><Mail className="w-4 h-4" /> {contactEmail}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
