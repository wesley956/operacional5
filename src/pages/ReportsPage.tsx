// ============================================================
// OPERACIONAL5 — Página de Relatórios
// ============================================================

import { useState } from 'react';
import { PageHeader, Card, Badge, Button, SelectField } from '@/components/ui';
import { useReports } from '@/hooks';
import { formatDate, formatRelativeTime, cn } from '@/lib/utils';
import {
  FileText, Download, TrendingUp, Users,
  Shield, AlertTriangle, BarChart3,
  Activity, Zap, Eye,
} from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
};

const TYPE_COLORS: Record<string, string> = {
  daily: 'bg-blue-100 text-blue-800',
  weekly: 'bg-purple-100 text-purple-800',
};

type ExportableReport = {
  id: string;
  type: string;
  title: string;
  date: string;
  posts_total: number;
  posts_covered: number;
  occurrences_count: number;
  critical_occurrences: number;
  fts_opened: number;
  fts_resolved: number;
  sos_count: number;
  avg_response_time_min: number;
  presence_rate: number;
  ronda_completion: number;
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function exportReportAsPdf(report: ExportableReport) {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!popup) {
    window.alert('O navegador bloqueou a janela de exportação. Permita pop-ups para gerar o PDF.');
    return;
  }

  const typeLabel = TYPE_LABELS[report.type];
  const safeTitle = escapeHtml(report.title);

  popup.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
    h1 { font-size: 24px; margin: 0 0 4px; }
    .meta { color: #6b7280; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; }
    .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
    .value { font-size: 22px; font-weight: 700; margin-top: 4px; }
    .footer { margin-top: 28px; color: #6b7280; font-size: 12px; }
    @media print { body { margin: 18mm; } button { display: none; } }
  </style>
</head>
<body>
  <button onclick="window.print()" style="float:right;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;background:white;cursor:pointer">Imprimir / Salvar PDF</button>
  <h1>${safeTitle}</h1>
  <div class="meta">${escapeHtml(typeLabel)} • ${escapeHtml(formatDate(report.date))}</div>
  <div class="grid">
    <div class="card"><div class="label">Taxa de presença</div><div class="value">${report.presence_rate}%</div></div>
    <div class="card"><div class="label">Rondas concluídas</div><div class="value">${report.ronda_completion}%</div></div>
    <div class="card"><div class="label">Postos cobertos</div><div class="value">${report.posts_covered}/${report.posts_total}</div></div>
    <div class="card"><div class="label">Ocorrências</div><div class="value">${report.occurrences_count}</div></div>
    <div class="card"><div class="label">Ocorrências críticas</div><div class="value">${report.critical_occurrences}</div></div>
    <div class="card"><div class="label">SOS</div><div class="value">${report.sos_count}</div></div>
    <div class="card"><div class="label">FTs abertas/resolvidas</div><div class="value">${report.fts_opened}/${report.fts_resolved}</div></div>
    <div class="card"><div class="label">Tempo médio de resposta</div><div class="value">${report.avg_response_time_min} min</div></div>
  </div>
  <div class="footer">Gerado pelo Operacional5 em ${escapeHtml(new Date().toLocaleString('pt-BR'))}.</div>
  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 300));<\/script>
</body>
</html>`);
  popup.document.close();
}

export function ReportsPage() {
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const { daily, weekly, loading } = useReports();
  const reports = [daily, weekly].filter((report): report is NonNullable<typeof daily> => report !== null);
  const ftAutoActions: Array<{ id: string; type: string; post_name: string; description: string; timestamp: string; automated: boolean }> = [];
  const filtered = typeFilter ? reports.filter(r => r.type === typeFilter) : reports;
  const selectedReport = selectedReportId ? reports.find(r => r.id === selectedReportId) : null;

  return (
    <div>
      <PageHeader
        title="Relatórios"
        subtitle={`${reports.length} relatórios disponíveis`}
        actions={
          <div className="flex items-center gap-2">
            <SelectField
              id="report-type"
              placeholder="Todos os tipos"
              options={Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="w-36"
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reports List */}
        <div className="lg:col-span-2 space-y-4">
          {filtered.map(report => (
            <Card
              key={report.id}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                selectedReportId === report.id && 'ring-2 ring-blue-500'
              )}
              onClick={() => setSelectedReportId(report.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <FileText className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{report.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded', TYPE_COLORS[report.type])}>
                        {TYPE_LABELS[report.type]}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(report.date)}</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    exportReportAsPdf(report);
                  }}
                  aria-label={`Exportar ${report.title} em PDF`}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>

              {/* KPI Row */}
              <div className="grid grid-cols-4 gap-3 mt-4 pt-3 border-t border-gray-100">
                <KPI icon={<Shield className="w-3.5 h-3.5" />} label="Cobertura" value={`${report.presence_rate}%`}
                  color={report.presence_rate >= 90 ? 'text-green-600' : report.presence_rate >= 70 ? 'text-yellow-600' : 'text-red-600'} />
                <KPI icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Ocorrências" value={`${report.occurrences_count} (${report.critical_occurrences} crit.)`}
                  color={report.critical_occurrences > 0 ? 'text-red-600' : 'text-gray-700'} />
                <KPI icon={<Users className="w-3.5 h-3.5" />} label="FTs" value={`${report.fts_resolved}/${report.fts_opened}`}
                  color="text-blue-600" />
                <KPI icon={<Activity className="w-3.5 h-3.5" />} label="Rondas" value={`${report.ronda_completion}%`}
                  color={report.ronda_completion >= 90 ? 'text-green-600' : 'text-yellow-600'} />
              </div>
            </Card>
          ))}
        </div>

        {/* Report Detail / Dashboard */}
        <div className="space-y-4">
          {loading ? (
            <Card>
              <div className="text-center py-8">
                <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3 animate-pulse" />
                <p className="text-sm text-gray-500">Carregando relatórios...</p>
              </div>
            </Card>
          ) : selectedReport ? (
            <>
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">Métricas do Relatório</h3>
                <div className="space-y-3">
                  <MetricBar label="Taxa de Presença" value={selectedReport.presence_rate} max={100}
                    color={selectedReport.presence_rate >= 90 ? 'bg-green-500' : 'bg-yellow-500'} />
                  <MetricBar label="Conclusão de Rondas" value={selectedReport.ronda_completion} max={100}
                    color={selectedReport.ronda_completion >= 90 ? 'bg-green-500' : 'bg-yellow-500'} />
                  <MetricBar label="Cobertura de Postos" value={(selectedReport.posts_covered / selectedReport.posts_total) * 100} max={100}
                    color="bg-blue-500" />
                </div>
              </Card>

              <Card>
                <h3 className="font-semibold text-gray-900 mb-3">Resumo</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Postos cobertos</span><span className="font-medium">{selectedReport.posts_covered}/{selectedReport.posts_total}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Ocorrências</span><span className="font-medium">{selectedReport.occurrences_count}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Críticas</span><span className="font-medium text-red-600">{selectedReport.critical_occurrences}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">SOS</span><span className="font-medium text-red-600">{selectedReport.sos_count}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">FTs abertas/resolvidas</span><span className="font-medium">{selectedReport.fts_opened}/{selectedReport.fts_resolved}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Tempo médio resposta</span><span className="font-medium">{selectedReport.avg_response_time_min} min</span></div>
                </div>
              </Card>

              <Button className="w-full" onClick={() => exportReportAsPdf(selectedReport)}>
                <Download className="w-4 h-4 mr-2" /> Exportar PDF
              </Button>
            </>
          ) : (
            <Card>
              <div className="text-center py-8">
                <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Selecione um relatório para ver detalhes</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* FT Automation Log */}
      <div className="mt-8">
        <PageHeader title="Log de Automação" subtitle="Ações automáticas do sistema" />

        <Card padding={false}>
          <div className="divide-y divide-gray-100">
            {ftAutoActions.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                Nenhuma ação automática registrada no período.
              </div>
            ) : ftAutoActions.map(action => (
              <div key={action.id} className="p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                <div className={cn(
                  'p-1.5 rounded-lg flex-shrink-0',
                  action.type === 'scan_absence' ? 'bg-yellow-100' :
                  action.type === 'auto_ft' ? 'bg-red-100' :
                  action.type === 'escalate' ? 'bg-orange-100' :
                  'bg-blue-100'
                )}>
                  {action.type === 'scan_absence' ? <Eye className="w-4 h-4 text-yellow-600" /> :
                   action.type === 'auto_ft' ? <Zap className="w-4 h-4 text-red-600" /> :
                   action.type === 'escalate' ? <TrendingUp className="w-4 h-4 text-orange-600" /> :
                   <Activity className="w-4 h-4 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{action.description}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>{formatRelativeTime(action.timestamp)}</span>
                    {action.post_name && <span>• {action.post_name}</span>}
                    {action.automated && <Badge variant="info">Automático</Badge>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function KPI({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">{icon}</div>
      <p className={cn('text-sm font-bold', color)}>{value}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  );
}

function MetricBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-bold text-gray-900">{Math.round(pct)}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
