// ============================================================
// OPERACIONAL5 — Passagem de Plantão (Shift Handover)
// ============================================================

import { useState } from 'react';
import { PageHeader, Card, Badge, Modal, Button } from '@/components/ui';
import { Avatar } from '@/components/Layout';
import { DEMO_HANDOVERS, getPostName, getProfileName } from '@/lib/mockData';
import { formatDateTime, formatRelativeTime, cn } from '@/lib/utils';
import { ArrowRightLeft, Clock, AlertTriangle, CheckCircle, AlertCircle, User } from 'lucide-react';

const STATUS_CONFIG = {
  confirmada: { badge: 'success' as const, icon: <CheckCircle className="w-5 h-5 text-green-600" />, label: 'Confirmada', color: 'border-l-green-500 bg-green-50' },
  pendente: { badge: 'warning' as const, icon: <Clock className="w-5 h-5 text-yellow-600" />, label: 'Pendente', color: 'border-l-yellow-500 bg-yellow-50' },
  retido: { badge: 'danger' as const, icon: <AlertTriangle className="w-5 h-5 text-red-600" />, label: 'Retido', color: 'border-l-red-500 bg-red-50' },
};

export function HandoverPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const handovers = DEMO_HANDOVERS;
  const selected = selectedId ? handovers.find(h => h.id === selectedId) : null;

  const confirmed = handovers.filter(h => h.status === 'confirmada').length;
  const pending = handovers.filter(h => h.status === 'pendente').length;
  const retained = handovers.filter(h => h.status === 'retido').length;

  return (
    <div>
      <PageHeader
        title="Passagem de Plantão"
        subtitle={`${handovers.length} passagens — ${retained} retenções`}
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            <div>
              <p className="text-2xl font-bold text-green-600">{confirmed}</p>
              <p className="text-xs text-gray-500">Confirmadas</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg"><Clock className="w-5 h-5 text-yellow-600" /></div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{pending}</p>
              <p className="text-xs text-gray-500">Pendentes</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
            <div>
              <p className="text-2xl font-bold text-red-600">{retained}</p>
              <p className="text-xs text-gray-500">Retenções</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Retention Alert */}
      {retained > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 mb-6">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">⚠️ Retenção Involuntária Detectada</p>
            <p className="text-xs text-red-700 mt-0.5">
              {retained} vigilante(s) retido(s) além do turno porque o substituto não compareceu.
              Acione FT imediatamente.
            </p>
          </div>
        </div>
      )}

      {/* Handover Cards */}
      <div className="space-y-4">
        {handovers.map(handover => {
          const cfg = STATUS_CONFIG[handover.status];
          return (
            <Card
              key={handover.id}
              className={cn('border-l-4 cursor-pointer transition-all hover:shadow-md', cfg.color)}
              onClick={() => setSelectedId(handover.id)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  {/* Outgoing */}
                  <div className="text-center">
                    <Avatar name={getProfileName(handover.outgoing_employee_id)} />
                    <p className="text-xs font-medium text-gray-900 mt-1">{getProfileName(handover.outgoing_employee_id).split(' ')[0]}</p>
                    <p className="text-[10px] text-gray-400">Sai</p>
                  </div>

                  <div className="flex flex-col items-center">
                    <ArrowRightLeft className="w-5 h-5 text-gray-400" />
                    <p className="text-[10px] text-gray-400 mt-0.5">{getPostName(handover.post_id).split(' - ')[0]}</p>
                  </div>

                  {/* Incoming */}
                  <div className="text-center">
                    <Avatar name={getProfileName(handover.incoming_employee_id)} />
                    <p className="text-xs font-medium text-gray-900 mt-1">{getProfileName(handover.incoming_employee_id).split(' ')[0]}</p>
                    <p className="text-[10px] text-gray-400">Entra</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <Badge variant={cfg.badge}>{cfg.label}</Badge>
                    <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(handover.created_at)}</p>
                  </div>
                  {cfg.icon}
                </div>
              </div>

              {handover.notes && (
                <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-200/50">{handover.notes}</p>
              )}

              {handover.pending_items.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200/50">
                  <p className="text-xs font-medium text-gray-500 mb-1">Pendências:</p>
                  <div className="flex flex-wrap gap-1">
                    {handover.pending_items.map((item, i) => (
                      <Badge key={i} variant="warning">{item}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {handover.retention_reason && (
                <div className="mt-3 pt-3 border-t border-gray-200/50 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <p className="text-xs font-semibold text-red-700">
                    Retenção: {handover.retention_reason === 'ausencia_substituto' ? 'Substituto não compareceu' : handover.retention_reason}
                  </p>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelectedId(null)} title="Detalhes da Passagem" size="lg">
        {selected && (() => {
          const cfg = STATUS_CONFIG[selected.status];
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-6 py-4">
                <div className="text-center">
                  <Avatar name={getProfileName(selected.outgoing_employee_id)} size="lg" />
                  <p className="font-semibold text-gray-900 mt-2">{getProfileName(selected.outgoing_employee_id)}</p>
                  <Badge variant="default">Saída</Badge>
                </div>
                <div className="flex flex-col items-center">
                  <ArrowRightLeft className="w-8 h-8 text-gray-400" />
                  <p className="text-xs text-gray-400 mt-1">{getPostName(selected.post_id)}</p>
                </div>
                <div className="text-center">
                  <Avatar name={getProfileName(selected.incoming_employee_id)} size="lg" />
                  <p className="font-semibold text-gray-900 mt-2">{getProfileName(selected.incoming_employee_id)}</p>
                  <Badge variant="info">Entrada</Badge>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <Badge variant={cfg.badge}>
                  <span className="flex items-center gap-1.5 text-sm">{cfg.icon} {cfg.label}</span>
                </Badge>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-gray-500">Posto</p><p className="font-medium">{getPostName(selected.post_id)}</p></div>
                <div><p className="text-xs text-gray-500">Data/Hora</p><p className="font-medium">{formatDateTime(selected.created_at)}</p></div>
                {selected.confirmed_at && (
                  <div><p className="text-xs text-gray-500">Confirmada em</p><p className="font-medium">{formatDateTime(selected.confirmed_at)}</p></div>
                )}
              </div>

              {selected.notes && (
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">Observações</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{selected.notes}</p>
                </div>
              )}

              {selected.pending_items.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">Pendências Transferidas</p>
                  <div className="space-y-1">
                    {selected.pending_items.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm text-yellow-800">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.retention_reason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-red-800">Motivo da Retenção</p>
                  <p className="text-sm text-red-700 mt-1">
                    {selected.retention_reason === 'ausencia_substituto'
                      ? 'O substituto não compareceu para o turno. O vigilante atual foi retido involuntariamente.'
                      : selected.retention_reason}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {selected.status === 'pendente' && (
                  <Button className="flex-1"><CheckCircle className="w-4 h-4 mr-1" /> Confirmar Passagem</Button>
                )}
                {selected.status === 'retido' && (
                  <>
                    <Button className="flex-1"><User className="w-4 h-4 mr-1" /> Acionar FT</Button>
                    <Button variant="secondary">Resolver</Button>
                  </>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
