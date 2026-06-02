// ============================================================
// OPERACIONAL5 — Dashboard Principal
// ============================================================

import { useState } from 'react';
import { useProfile } from '@/context/AuthContext';
import { getPermissions, formatRelativeTime, cn } from '@/lib/utils';
import { PageHeader, Card, Badge, EmptyState } from '@/components/ui';
import {
  StatCard, PostStatusCard, AlertCard, DASHBOARD_ICONS,
} from '@/components/DashboardComponents';
import {
  useEmployees,
  useFT,
  useNotifications,
  useOccurrences,
  usePosts,
  useRealtimeDashboard,
} from '@/hooks';
import { RefreshCw, ListFilter, AlertTriangle, Clock, ShieldAlert, ShieldOff, Siren, UserCheck } from 'lucide-react';

const OPEN_OCCURRENCE_STATUSES = new Set(['aberta', 'em_andamento', 'em_tratamento', 'pendente']);
const OPEN_FT_STATUSES = new Set(['aberta', 'acionando', 'em_andamento']);

export function DashboardPage() {
  const profile = useProfile();
  const permissions = getPermissions(profile.role);
  const [filterCritical, setFilterCritical] = useState(false);
  const { summary, postStatuses, loading: dashboardLoading, refresh } = useRealtimeDashboard();
  const { notifications: alerts } = useNotifications();
  const { occurrences } = useOccurrences();
  const { fts: ftRequests } = useFT();
  const { employees } = useEmployees({ active: true });
  const { posts } = usePosts();

  const getProfileName = (profileId: string) => employees.find(e => e.id === profileId)?.name ?? 'Não encontrado';
  const getPostName = (postId: string) => posts.find(p => p.id === postId)?.name ?? 'Posto não encontrado';
  const goTo = (path: string) => {
    window.location.hash = path;
  };

  const filteredAlerts = filterCritical
    ? alerts.filter(a => a.type === 'sos' || a.type === 'occurrence' || a.type === 'escalation' || a.severity === 'critical')
    : alerts;

  const filteredPosts = filterCritical
    ? postStatuses.filter(p => p.status === 'critico' || p.status === 'sos_ativo' || p.status === 'descoberto')
    : postStatuses;

  if (dashboardLoading || !summary) {
    return (
      <div>
        <PageHeader title="Dashboard Operacional" subtitle="Carregando visão operacional..." />
        <Card>
          <p className="text-sm text-gray-500 text-center py-12">Carregando dashboard...</p>
        </Card>
      </div>
    );
  }

  const openOccurrences = occurrences.filter(occ => OPEN_OCCURRENCE_STATUSES.has(String(occ.status)));
  const openSos = openOccurrences.filter(occ => occ.type === 'sos');
  const openAbsences = openOccurrences.filter(occ => String(occ.type) === 'ausencia');
  const criticalOccurrences = openOccurrences.filter(occ => occ.severity === 'critica' || occ.severity === 'alta');
  const openFTs = ftRequests.filter(ft => OPEN_FT_STATUSES.has(String(ft.status)));
  const pendingPresenceReviews = Number((summary as unknown as { presencas_pendentes?: number }).presencas_pendentes ?? 0);
  const uncoveredPosts = postStatuses.filter(post => Number(post.confirmed_count) < Number(post.min_staff));

  const operationalActions = [
    {
      key: 'descobertos',
      title: 'Postos descobertos',
      value: uncoveredPosts.length,
      description: 'Postos sem cobertura mínima agora.',
      href: '#/posts',
      icon: <ShieldOff className="h-5 w-5" />,
      activeClass: 'border-l-slate-700 bg-slate-50',
      iconClass: 'bg-slate-200 text-slate-700',
    },
    {
      key: 'sos',
      title: 'SOS abertos',
      value: openSos.length,
      description: 'Emergências acionadas pelo app.',
      href: '#/alerts',
      icon: <Siren className="h-5 w-5" />,
      activeClass: 'border-l-red-600 bg-red-50',
      iconClass: 'bg-red-100 text-red-700',
    },
    {
      key: 'ausencias',
      title: 'Ausências',
      value: openAbsences.length,
      description: 'Postos sem assunção dentro da tolerância.',
      href: '#/alerts',
      icon: <Clock className="h-5 w-5" />,
      activeClass: 'border-l-orange-500 bg-orange-50',
      iconClass: 'bg-orange-100 text-orange-700',
    },
    {
      key: 'revisoes',
      title: 'Assunções em revisão',
      value: pendingPresenceReviews,
      description: 'Registros de presença pendentes de análise.',
      href: '#/presence',
      icon: <ShieldAlert className="h-5 w-5" />,
      activeClass: 'border-l-yellow-500 bg-yellow-50',
      iconClass: 'bg-yellow-100 text-yellow-700',
    },
    {
      key: 'fts',
      title: 'FTs abertas',
      value: openFTs.length,
      description: 'Coberturas e acionamentos pendentes.',
      href: '#/ft',
      icon: <UserCheck className="h-5 w-5" />,
      activeClass: 'border-l-blue-600 bg-blue-50',
      iconClass: 'bg-blue-100 text-blue-700',
    },
    {
      key: 'criticas',
      title: 'Ocorrências críticas',
      value: criticalOccurrences.length,
      description: 'Ocorrências abertas de alta criticidade.',
      href: '#/alerts',
      icon: <AlertTriangle className="h-5 w-5" />,
      activeClass: 'border-l-rose-600 bg-rose-50',
      iconClass: 'bg-rose-100 text-rose-700',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard Operacional"
        subtitle={`Visão geral • ${profile.name} • ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterCritical(!filterCritical)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                filterCritical ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <ListFilter className="w-4 h-4" />
              {filterCritical ? 'Mostrar tudo' : 'Críticos'}
            </button>
            <button onClick={() => void refresh()} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard
          title="Cobertos"
          value={summary.cobertos}
          icon={DASHBOARD_ICONS.cobertos}
          color="text-green-600"
          subtitle={`${summary.total_posts} postos total`}
        />
        <StatCard
          title="Críticos"
          value={summary.criticos}
          icon={DASHBOARD_ICONS.criticos}
          color="text-red-600"
        />
        <StatCard
          title="SOS"
          value={summary.sos_ativos}
          icon={DASHBOARD_ICONS.sos}
          color="text-red-700"
          pulse={summary.sos_ativos > 0}
        />
        <StatCard
          title="FTs Abertas"
          value={summary.fts_abertas}
          icon={DASHBOARD_ICONS.ft}
          color="text-blue-600"
        />
      </div>

      {/* Operational Control */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Controle operacional imediato</h2>
          <a href="#/alerts" className="text-sm font-bold text-blue-700 hover:underline">
            Abrir Central de Alertas
          </a>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          {operationalActions.map(action => (
            <Card
              key={action.key}
              className={cn(
                'border-l-4 border-l-gray-200 transition-colors',
                action.value > 0 ? action.activeClass : 'bg-white'
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn('rounded-xl p-2', action.value > 0 ? action.iconClass : 'bg-gray-100 text-gray-500')}>
                  {action.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{action.title}</p>
                  <p className={cn('mt-1 text-3xl font-black', action.value > 0 ? 'text-gray-950' : 'text-gray-400')}>
                    {action.value}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">{action.description}</p>

                  {action.value > 0 ? (
                    <a href={action.href} className="mt-3 inline-flex text-xs font-bold text-blue-700 hover:underline">
                      Ver detalhes
                    </a>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Posts Status - 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Status dos Postos
              <span className="text-gray-400 font-normal ml-2">({filteredPosts.length})</span>
            </h2>
          </div>

          {filteredPosts.length === 0 ? (
            <EmptyState title="Nenhum posto encontrado" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPosts.map(post => (
                <PostStatusCard
                  key={post.post_id}
                  postName={post.post_name}
                  clientName={post.client_name}
                  status={post.status}
                  confirmedCount={post.confirmed_count}
                  minStaff={post.min_staff}
                  employeesPresent={post.employees_present}
                  employeesMissing={post.employees_missing}
                  activeSos={post.active_sos_count}
                  lastOccurrence={post.last_occurrence_at ? formatRelativeTime(post.last_occurrence_at) : undefined}
                  onViewDetails={() => goTo('/posts')}
                />
              ))}
            </div>
          )}

          {/* Occurrences Recent */}
          {permissions.canViewAllOccurrences && occurrences.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                Ocorrências Recentes
                <span className="text-gray-400 font-normal ml-2">({occurrences.length})</span>
              </h2>
              <Card padding={false}>
                <div className="divide-y divide-gray-100">
                  {occurrences.slice(0, 5).map(occ => (
                    <div key={occ.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge variant={occ.severity === 'critica' || occ.severity === 'alta' ? 'danger' : occ.severity === 'media' ? 'warning' : 'info'}>
                          {occ.severity.toUpperCase()}
                        </Badge>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {occ.type.toUpperCase()} — {getPostName(occ.post_id)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Por {getProfileName(occ.employee_id)} • {formatRelativeTime(occ.created_at)}
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        occ.status === 'aberta' ? 'danger' :
                        occ.status === 'em_tratamento' ? 'warning' :
                        occ.status === 'resolvida' ? 'success' : 'default'
                      }>
                        {occ.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Alerts - 1 col */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Alertas
              <span className="text-gray-400 font-normal ml-2">({filteredAlerts.length})</span>
            </h2>
          </div>

          {filteredAlerts.length === 0 ? (
            <Card>
              <EmptyState title="Sem alertas no momento" description="Tudo tranquilo por aqui." />
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map(alert => {
                const isCritical = alert.type === 'sos' || alert.type === 'occurrence' || alert.type === 'escalation' || alert.severity === 'critical';
                return (
                  <AlertCard
                    key={alert.id}
                    type={alert.type}
                    message={alert.message ?? alert.title ?? 'Sem detalhes'}
                    time={formatRelativeTime(alert.created_at)}
                    postName={alert.post_name}
                    isCritical={isCritical}
                    onAck={permissions.canAckAlert ? () => {} : undefined}
                    onView={() => goTo(alert.type === 'ausencia' ? '/ft' : alert.type === 'sos' ? '/alerts' : '/alerts')}
                    onAction={
                      alert.type === 'ausencia' && permissions.canManageFT
                        ? () => goTo('/ft')
                        : undefined
                    }
                    actionLabel={alert.type === 'ausencia' ? 'Ver FT' : undefined}
                  />
                );
              })}
            </div>
          )}

          {/* FT Requests */}
          {permissions.canViewFT && ftRequests.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">FTs Abertas</h3>
              {ftRequests.map(ft => (
                <Card key={ft.id} className="mb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{getPostName(ft.post_id)}</p>
                      <p className="text-xs text-gray-500">
                        {ft.reason.toUpperCase()} • {formatRelativeTime(ft.opened_at)}
                      </p>
                    </div>
                    <Badge variant="warning">{ft.status}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
