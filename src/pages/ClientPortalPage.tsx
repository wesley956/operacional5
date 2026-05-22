// ============================================================
// OPERACIONAL5 — Portal do Cliente
// ============================================================

import { PageHeader, Card, Badge, Button } from '@/components/ui';
import { DEMO_CLIENT_PORTAL, DEMO_OCCURRENCES } from '@/lib/mockData';
import { formatRelativeTime, cn } from '@/lib/utils';
import {
  Building2, Eye, Clock, Users,
  FileText, Phone, Mail, ExternalLink, BarChart3,
  AlertTriangle, CheckCircle, Lock,
} from 'lucide-react';

export function ClientPortalPage() {
  const portal = DEMO_CLIENT_PORTAL;

  const coverageColor = portal.current_shift_coverage >= 90
    ? 'text-green-600' : portal.current_shift_coverage >= 70
    ? 'text-yellow-600' : 'text-red-600';

  const coverageBg = portal.current_shift_coverage >= 90
    ? 'bg-green-500' : portal.current_shift_coverage >= 70
    ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div>
      <PageHeader
        title="Portal do Cliente"
        subtitle={`Visão para ${portal.client_name}`}
        actions={
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-100 px-3 py-2 rounded-lg">
            <Lock className="w-3.5 h-3.5" />
            Acesso restrito ao cliente
          </div>
        }
      />

      {/* Client Header */}
      <Card className="mb-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{portal.client_name}</h2>
              <p className="text-blue-200 text-sm">{portal.total_posts} postos ativos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm">
              <Phone className="w-4 h-4 mr-1" /> Contato
            </Button>
            <Button variant="secondary" size="sm">
              <FileText className="w-4 h-4 mr-1" /> Relatório
            </Button>
          </div>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card>
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{portal.active_posts}</p>
            <p className="text-xs text-gray-500 mt-1">Postos Ativos</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className={cn('text-3xl font-bold', coverageColor)}>
              {portal.current_shift_coverage.toFixed(0)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">Cobertura Atual</p>
            <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full', coverageBg)} style={{ width: `${portal.current_shift_coverage}%` }} />
            </div>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-3xl font-bold text-orange-600">{portal.occurrences_today}</p>
            <p className="text-xs text-gray-500 mt-1">Ocorrências Hoje</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-3xl font-bold text-yellow-600">{portal.pending_items}</p>
            <p className="text-xs text-gray-500 mt-1">Pendências</p>
          </div>
        </Card>
      </div>

      {/* Post Status Grid */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Status dos Postos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {portal.posts.map((post, i) => {
            const statusColor = post.status === 'Coberto' ? 'bg-green-500' :
                               post.status === 'SOS Ativo' ? 'bg-red-600 animate-pulse' :
                               post.status === 'Crítico' ? 'bg-red-500' :
                               'bg-yellow-500';

            return (
              <Card key={i} className={cn('border-t-4', statusColor.replace('bg-', 'border-t-').replace('animate-pulse', ''))}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{post.name}</h3>
                  <Badge variant={
                    post.status === 'Coberto' ? 'success' :
                    post.status === 'SOS Ativo' ? 'danger' :
                    post.status === 'Crítico' ? 'danger' : 'warning'
                  }>
                    {post.status === 'SOS Ativo' && <span className="animate-pulse mr-1">●</span>}
                    {post.status}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Vigilantes</span>
                    <span className="font-medium">{post.vigilantes}/{post.min_staff}</span>
                  </div>
                  {post.last_incident && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Últ. incidente</span>
                      <span className="text-xs text-gray-600">{formatRelativeTime(post.last_incident)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100">
                  <button className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> Ver detalhes
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Occurrences (sanitized for client) */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Ocorrências Recentes</h3>
          <Badge variant="info">{DEMO_OCCURRENCES.length}</Badge>
        </div>
        <div className="space-y-3">
          {DEMO_OCCURRENCES.slice(0, 3).map(occ => (
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
        </div>
        <p className="text-xs text-gray-400 mt-3 text-center">
          🔒 Detalhes sensíveis omitidos para proteção do cliente
        </p>
      </Card>

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Relatórios Disponíveis</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Acesse relatórios diários, semanais e mensais do serviço de segurança.
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
            <p className="flex items-center gap-2 text-gray-600">
              <Phone className="w-4 h-4 text-gray-400" /> (11) 98765-4321 — Plantão 24h
            </p>
            <p className="flex items-center gap-2 text-gray-600">
              <Mail className="w-4 h-4 text-gray-400" /> contato@segurancatotal.com.br
            </p>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Em caso de emergência, ligue diretamente para o plantão.
          </p>
        </Card>
      </div>
    </div>
  );
}
