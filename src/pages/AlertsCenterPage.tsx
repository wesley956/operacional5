import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase/client';

type AlertRow = {
  id: string;
  type: string | null;
  severity: string | null;
  status: string | null;
  description: string | null;
  created_at: string;
  employee_id: string | null;
  post_id: string | null;
  photo_url?: string | null;
  profiles?: { name?: string | null } | null;
  posts?: { name?: string | null } | null;
};

type NotificationLog = {
  id: string;
  channel: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  target_user_id: string | null;
};

type PresenceAlertRow = {
  id: string;
  status: string | null;
  confirmed_at: string | null;
  created_at: string;
  employee_id: string | null;
  post_id: string | null;
  gps_valid: boolean | null;
  is_mock_location: boolean | null;
  accuracy: number | null;
  validation_method: string | null;
  photo_url: string | null;
  profiles?: { name?: string | null } | null;
  posts?: { name?: string | null } | null;
};

type UnifiedAlert =
  | { kind: 'occurrence'; item: AlertRow }
  | { kind: 'presence'; item: PresenceAlertRow };

const ALERTS_AUTO_REFRESH_MS = 30_000;

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}


function formatUnknownError(value: unknown): string {
  if (!value) return 'Erro desconhecido.';
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function severityClass(severity?: string | null) {
  if (severity === 'critica' || severity === 'alta') return 'bg-red-100 text-red-800 border-red-200';
  if (severity === 'media') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}


function presenceSeverityClass(item: PresenceAlertRow) {
  if (item.is_mock_location) return 'bg-red-100 text-red-800 border-red-200';
  if (item.status === 'rejected') return 'bg-red-100 text-red-800 border-red-200';
  if (item.status === 'pending_review' || item.gps_valid === false || !item.photo_url) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function presenceReason(item: PresenceAlertRow) {
  if (item.is_mock_location) return 'GPS suspeito/mock detectado';
  if (item.status === 'rejected') return 'Assunção rejeitada';
  if (item.status === 'pending_review') return 'Assunção aguardando revisão';
  if (item.gps_valid === false) return 'GPS fora do raio ou inválido';
  if (!item.photo_url) return 'Sem foto de evidência';
  return 'Assunção de posto';
}


function occurrenceQuickAction(alert: AlertRow) {
  if (alert.type === 'ausencia') {
    return {
      href: '/#/ft',
      label: 'Ver FT',
      className: 'rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-800',
    };
  }

  if (alert.type === 'sos') {
    return {
      href: '/#/occurrences',
      label: 'Abrir SOS',
      className: 'rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-800',
    };
  }

  return {
    href: '/#/occurrences',
    label: 'Ver ocorrência',
    className: 'rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800',
  };
}

async function readFunctionError(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : String(error);
  const ctx = error as { context?: Response };

  if (!ctx.context) return fallback;

  try {
    const body = await ctx.context.clone().json();
    if (body?.error) return formatUnknownError(body.error);
    if (body?.message) return formatUnknownError(body.message);
  } catch {
    // ignore
  }

  try {
    const text = await ctx.context.clone().text();
    if (text) return text;
  } catch {
    // ignore
  }

  return fallback;
}

export default function AlertsCenterPage() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [presenceAlerts, setPresenceAlerts] = useState<PresenceAlertRow[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [search, setSearch] = useState('');
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('occurrences')
        .select('id,type,severity,status,description,created_at,employee_id,post_id,photo_url,profiles:employee_id(name),posts:post_id(name)')
        .order('created_at', { ascending: false })
        .limit(80);

      if (!showResolved) query = query.in('status', ['aberta', 'em_tratamento', 'pendente']);
      if (onlyCritical) query = query.or('type.eq.sos,severity.eq.critica,severity.eq.alta');

      const { data, error: alertError } = await query;
      if (alertError) throw alertError;

      let presenceQuery = supabase
        .from('presences')
        .select('id,status,confirmed_at,created_at,employee_id,post_id,gps_valid,is_mock_location,accuracy,validation_method,photo_url,profiles:employee_id(name),posts:post_id(name)')
        .order('confirmed_at', { ascending: false })
        .limit(80);

      if (!showResolved) {
        presenceQuery = presenceQuery.or('status.eq.pending_review,status.eq.rejected,gps_valid.eq.false,is_mock_location.eq.true,photo_url.is.null');
      }

      const { data: presenceData, error: presenceError } = await presenceQuery;
      if (presenceError) throw presenceError;

      const { data: logData, error: logError } = await supabase
        .from('notification_logs')
        .select('id,channel,status,error_message,sent_at,target_user_id')
        .order('sent_at', { ascending: false })
        .limit(60);

      if (logError) throw logError;

      setAlerts((data ?? []) as AlertRow[]);
      setPresenceAlerts((presenceData ?? []) as PresenceAlertRow[]);
      setLogs((logData ?? []) as NotificationLog[]);
    } catch (err) {
      setError(formatUnknownError(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [onlyCritical, showResolved, supabase]);

  useEffect(() => {
    void load();

    const interval = window.setInterval(() => {
      void load({ silent: true });
    }, ALERTS_AUTO_REFRESH_MS);

    const handleFocus = () => {
      void load({ silent: true });
    };

    window.addEventListener('focus', handleFocus);

    let realtimeTimer: number | undefined;
    const scheduleRealtimeReload = () => {
      if (realtimeTimer) window.clearTimeout(realtimeTimer);
      realtimeTimer = window.setTimeout(() => {
        void load({ silent: true });
      }, 500);
    };

    const channel = supabase
      .channel('alerts-center-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'occurrences' }, scheduleRealtimeReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'presences' }, scheduleRealtimeReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notification_logs' }, scheduleRealtimeReload)
      .subscribe();

    return () => {
      window.clearInterval(interval);
      if (realtimeTimer) window.clearTimeout(realtimeTimer);
      window.removeEventListener('focus', handleFocus);
      void supabase.removeChannel(channel);
    };
  }, [load, supabase]);

  const unifiedAlerts = useMemo<UnifiedAlert[]>(() => {
    const occurrenceItems: UnifiedAlert[] = alerts.map((item) => ({ kind: 'occurrence', item }));
    const presenceItems: UnifiedAlert[] = presenceAlerts.map((item) => ({ kind: 'presence', item }));

    return [...occurrenceItems, ...presenceItems].sort((a, b) => {
      const aDate = a.kind === 'presence' ? (a.item.confirmed_at ?? a.item.created_at) : a.item.created_at;
      const bDate = b.kind === 'presence' ? (b.item.confirmed_at ?? b.item.created_at) : b.item.created_at;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }, [alerts, presenceAlerts]);

  const filteredAlerts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return unifiedAlerts;

    return unifiedAlerts.filter((entry) => {
      if (entry.kind === 'occurrence') {
        const alert = entry.item;
        return [
          alert.type ?? '',
          alert.severity ?? '',
          alert.status ?? '',
          alert.description ?? '',
          alert.profiles?.name ?? '',
          alert.posts?.name ?? '',
        ].join(' ').toLowerCase().includes(term);
      }

      const presence = entry.item;
      return [
        'assumir posto',
        'presença',
        presence.status ?? '',
        presence.validation_method ?? '',
        presence.profiles?.name ?? '',
        presence.posts?.name ?? '',
      ].join(' ').toLowerCase().includes(term);
    });
  }, [unifiedAlerts, search]);

  const stats = useMemo(() => {
    const criticalOpen = alerts.filter((item) =>
      item.status !== 'resolvida' &&
      (item.type === 'sos' || item.severity === 'critica' || item.severity === 'alta')
    ).length;

    const presenceReview = presenceAlerts.filter((item) =>
      item.status === 'pending_review' ||
      item.status === 'rejected' ||
      item.gps_valid === false ||
      item.is_mock_location === true ||
      !item.photo_url
    ).length;

    return {
      criticalOpen: criticalOpen + presenceAlerts.filter((item) => item.is_mock_location === true).length,
      openOccurrences: alerts.filter((item) => item.status !== 'resolvida').length + presenceReview,
      sent: logs.filter((item) => item.status === 'sent').length,
      failed: logs.filter((item) => item.status === 'failed').length,
    };
  }, [alerts, presenceAlerts, logs]);

  async function updateStatus(id: string, status: string) {
    setError(null);
    setMessage(null);

    try {
      const { error: updateError } = await supabase.from('occurrences').update({ status }).eq('id', id);
      if (updateError) throw updateError;

      setMessage('Status atualizado.');
      await load();
    } catch (err) {
      setError(formatUnknownError(err));
    }
  }

  async function resend(alert: AlertRow) {
    setSending(true);
    setError(null);
    setMessage(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('send-alert', {
        body: {
          roles: ['supervisor', 'gerente', 'admin'],
          title: alert.type === 'sos' ? '🚨 SOS Operacional5' : '⚠️ Alerta Operacional5',
          body: `${alert.type ?? 'Ocorrência'} — ${alert.posts?.name ?? 'posto não informado'}`,
          data: {
            type: alert.type ?? 'occurrence',
            occurrence_id: alert.id,
            post_id: alert.post_id,
            employee_id: alert.employee_id,
          },
        },
      });

      if (functionError) throw new Error(await readFunctionError(functionError));
      if (data?.ok === false) throw new Error(formatUnknownError(data?.error ?? 'Falha ao reenviar alerta.'));

      setMessage(`Alerta reenviado. Enviados: ${data?.sent ?? 0}, falhas: ${data?.failed ?? 0}.`);
      await load();
    } catch (err) {
      setError(formatUnknownError(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl bg-slate-950 p-6 text-white">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-200">Central operacional</p>
          <h1 className="mt-2 text-3xl font-black">Alertas e notificações</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Acompanhe SOS, ocorrências críticas e logs de envio de notificações.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-500">Críticos abertos</p>
            <p className="mt-2 text-3xl font-black text-red-700">{stats.criticalOpen}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-500">Ocorrências abertas</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{stats.openOccurrences}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-500">Push enviados</p>
            <p className="mt-2 text-3xl font-black text-emerald-700">{stats.sent}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-slate-500">Falhas de push</p>
            <p className="mt-2 text-3xl font-black text-amber-700">{stats.failed}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por operador, posto ou descrição..."
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-700">
              <input type="checkbox" checked={onlyCritical} onChange={(event) => setOnlyCritical(event.target.checked)} />
              Só críticos
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-700">
              <input type="checkbox" checked={showResolved} onChange={(event) => setShowResolved(event.target.checked)} />
              Mostrar resolvidos
            </label>
            <button type="button" onClick={() => void load()} className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white hover:bg-blue-800">
              Atualizar
            </button>
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div> : null}
        {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</div> : null}

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-950">Fila de alertas operacionais</h2>
            {loading ? <span className="text-sm font-bold text-slate-500">Carregando...</span> : null}
          </div>

          {!loading && filteredAlerts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">
              Nenhum alerta encontrado.
            </div>
          ) : null}

          {filteredAlerts.map((entry) => {
            if (entry.kind === 'presence') {
              const presence = entry.item;

              return (
                <article key={`presence-${presence.id}`} className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${presenceSeverityClass(presence)}`}>
                          Assumir posto
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                          {presence.status ?? 'pendente'}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">{formatDate(presence.confirmed_at ?? presence.created_at)}</span>
                      </div>

                      <h3 className="text-lg font-black text-slate-950">
                        {presenceReason(presence)}
                      </h3>

                      <p className="text-sm leading-6 text-slate-600">
                        Registro de assunção de posto precisa de atenção operacional.
                      </p>

                      <div className="grid gap-1 text-sm text-slate-500 md:grid-cols-2">
                        <p><strong>Operador:</strong> {presence.profiles?.name ?? 'Não informado'}</p>
                        <p><strong>Posto:</strong> {presence.posts?.name ?? 'Não informado'}</p>
                        <p><strong>GPS:</strong> {presence.gps_valid ? 'Válido' : 'Inválido/sem GPS'}</p>
                        <p><strong>Foto:</strong> {presence.photo_url ? 'Enviada' : 'Ausente'}</p>
                      </div>

                      {presence.photo_url ? (
                        <a className="inline-flex text-sm font-bold text-blue-700 hover:underline" href={presence.photo_url} target="_blank" rel="noreferrer">
                          Ver foto da assunção
                        </a>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 md:min-w-56 md:justify-end">
                      <a href="/#/presence" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
                        Analisar assunção
                      </a>
                    </div>
                  </div>
                </article>
              );
            }

            const alert = entry.item;

            return (
              <article key={`occurrence-${alert.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${severityClass(alert.severity)}`}>
                        {alert.severity ?? 'media'}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        {alert.status ?? 'aberta'}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">{formatDate(alert.created_at)}</span>
                    </div>
                    <h3 className="text-lg font-black text-slate-950">
                      {alert.type === 'sos' ? 'SOS acionado' : `Ocorrência: ${alert.type ?? 'outro'}`}
                    </h3>
                    <p className="text-sm leading-6 text-slate-600">{alert.description ?? 'Sem descrição.'}</p>
                    <div className="grid gap-1 text-sm text-slate-500 md:grid-cols-2">
                      <p><strong>Operador:</strong> {alert.profiles?.name ?? 'Não informado'}</p>
                      <p><strong>Posto:</strong> {alert.posts?.name ?? 'Não informado'}</p>
                    </div>
                    {alert.photo_url ? (
                      <a className="inline-flex text-sm font-bold text-blue-700 hover:underline" href={alert.photo_url} target="_blank" rel="noreferrer">
                        Ver evidência
                      </a>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 md:min-w-56 md:justify-end">
                    {(() => {
                      const action = occurrenceQuickAction(alert);
                      return (
                        <a href={action.href} className={action.className}>
                          {action.label}
                        </a>
                      );
                    })()}

                    <button type="button" onClick={() => updateStatus(alert.id, 'em_tratamento')} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800">
                      Em andamento
                    </button>
                    <button type="button" onClick={() => updateStatus(alert.id, 'resolvida')} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                      Resolver
                    </button>
                    <button type="button" onClick={() => resend(alert)} disabled={sending} className="rounded-xl border border-slate-300 bg-slate-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-60">
                      Reenviar alerta
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Últimos logs de notificação</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4">Data</th>
                  <th className="py-2 pr-4">Canal</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Erro</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 text-slate-600">{log.sent_at ? formatDate(log.sent_at) : '-'}</td>
                    <td className="py-2 pr-4 font-bold text-slate-700">{log.channel}</td>
                    <td className="py-2 pr-4 font-bold text-slate-700">{log.status}</td>
                    <td className="py-2 pr-4 text-slate-500">{log.error_message ?? '-'}</td>
                  </tr>
                ))}
                {logs.length === 0 ? (
                  <tr><td colSpan={4} className="py-5 text-center text-slate-500">Nenhum log encontrado.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
