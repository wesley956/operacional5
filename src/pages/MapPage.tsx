// ============================================================
// OPERACIONAL5 — Página de Mapa Operacional
// ============================================================

import { useState } from 'react';
import { PageHeader, Card, Badge } from '@/components/ui';
import { OperationalStatusBadge } from '@/components/DashboardComponents';
import { usePosts } from '@/hooks';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, Clock, Users, Siren } from 'lucide-react';
import type { OperationalStatus } from '@/lib/types';

const STATUS_COLORS: Record<OperationalStatus, string> = {
  coberto: '#22c55e',
  parcialmente_coberto: '#3b82f6',
  atencao: '#eab308',
  descoberto: '#9ca3af',
  critico: '#ef4444',
  sos_ativo: '#dc2626',
};

export function MapPage() {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const { posts, statuses, loading } = usePosts();

  if (loading) {
    return (
      <div>
        <PageHeader title="Mapa Operacional" subtitle="Carregando postos..." />
        <Card><p className="text-sm text-gray-500 text-center py-12">Carregando mapa operacional...</p></Card>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div>
        <PageHeader title="Mapa Operacional" subtitle="Nenhum posto ativo" />
        <Card><p className="text-sm text-gray-500 text-center py-12">Nenhum posto cadastrado para exibir no mapa.</p></Card>
      </div>
    );
  }

  // Min/max lat/lng for bounding box
  const lats = posts.map(p => p.lat);
  const lngs = posts.map(p => p.lng);
  const minLat = Math.min(...lats) - 0.005;
  const maxLat = Math.max(...lats) + 0.005;
  const minLng = Math.min(...lngs) - 0.005;
  const maxLng = Math.max(...lngs) + 0.005;
  const latRange = maxLat - minLat;
  const lngRange = maxLng - minLng;

  // Convert lat/lng to % position
  const toX = (lng: number) => ((lng - minLng) / lngRange) * 100;
  const toY = (lat: number) => (1 - (lat - minLat) / latRange) * 100;

  return (
    <div>
      <PageHeader
        title="Mapa Operacional"
        subtitle={`${posts.length} postos ativos — visão em tempo real`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Area */}
        <div className="lg:col-span-2">
          <Card padding={false} className="overflow-hidden">
            {/* Map Visualization */}
            <div className="relative bg-gradient-to-br from-green-50 via-blue-50 to-gray-100" style={{ height: '500px' }}>
              {/* Grid overlay */}
              <svg className="absolute inset-0 w-full h-full opacity-10">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#666" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>

              {/* Roads simulation */}
              <svg className="absolute inset-0 w-full h-full opacity-20">
                <line x1="10%" y1="50%" x2="90%" y2="50%" stroke="#888" strokeWidth="2" strokeDasharray="8,4" />
                <line x1="50%" y1="10%" x2="50%" y2="90%" stroke="#888" strokeWidth="2" strokeDasharray="8,4" />
                <line x1="20%" y1="20%" x2="80%" y2="80%" stroke="#aaa" strokeWidth="1" strokeDasharray="4,4" />
                <line x1="80%" y1="20%" x2="20%" y2="80%" stroke="#aaa" strokeWidth="1" strokeDasharray="4,4" />
              </svg>

              {/* Street labels */}
              <div className="absolute top-[48%] left-[8%] text-xs text-gray-400 font-medium transform -rotate-2">
                R. Augusta →
              </div>
              <div className="absolute top-[8%] left-[48%] text-xs text-gray-400 font-medium transform -rotate-90">
                Av. Paulista →
              </div>

              {/* Post Markers */}
              {posts.map((post) => {
                const status = statuses.find(s => s.post_id === post.id);
                const color = STATUS_COLORS[status?.status ?? 'descoberto'];
                const isSelected = selectedPostId === post.id;
                const isSos = status?.status === 'sos_ativo';
                const isCritical = status?.status === 'critico';

                return (
                  <div key={post.id} className="absolute" style={{ left: `${toX(post.lng)}%`, top: `${toY(post.lat)}%` }}>
                    {/* Geofence radius circle */}
                    <div
                      className={cn(
                        'absolute rounded-full border-2 transform -translate-x-1/2 -translate-y-1/2 transition-all',
                        isSelected ? 'border-blue-400 bg-blue-100/30' : 'border-transparent',
                        isSos && 'border-red-400 bg-red-100/20 animate-pulse'
                      )}
                      style={{
                        width: `${Math.max(post.radius_meters / 3, 60)}px`,
                        height: `${Math.max(post.radius_meters / 3, 60)}px`,
                        left: '50%',
                        top: '50%',
                      }}
                    />

                    {/* Pulse ring for SOS/Critical */}
                    {(isSos || isCritical) && (
                      <div
                        className="absolute rounded-full animate-ping opacity-30"
                        style={{
                          width: '40px',
                          height: '40px',
                          backgroundColor: color,
                          left: '50%',
                          top: '50%',
                          transform: 'translate(-50%, -50%)',
                        }}
                      />
                    )}

                    {/* Marker */}
                    <button
                      onClick={() => setSelectedPostId(isSelected ? null : post.id)}
                      className={cn(
                        'relative z-10 flex items-center justify-center w-10 h-10 rounded-full shadow-lg transition-all transform -translate-x-1/2 -translate-y-1/2 border-2 border-white',
                        isSelected && 'scale-125 ring-4 ring-blue-300'
                      )}
                      style={{ backgroundColor: color }}
                    >
                      {isSos ? (
                        <Siren className="w-5 h-5 text-white" />
                      ) : (
                        <MapPin className="w-5 h-5 text-white" />
                      )}
                    </button>

                    {/* Label */}
                    <div className="absolute left-1/2 transform -translate-x-1/2 mt-1 whitespace-nowrap">
                      <div className={cn(
                        'px-2 py-0.5 rounded text-xs font-semibold shadow-sm',
                        isSelected ? 'bg-blue-600 text-white' : 'bg-white/90 text-gray-800 border'
                      )}>
                        {post.name.split(' - ')[0]}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Legend */}
              <div className="absolute bottom-4 left-4 bg-white/95 rounded-lg p-3 shadow-lg border border-gray-200">
                <p className="text-xs font-semibold text-gray-700 mb-2">Legenda</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {[
                    { label: 'Coberto', color: '#22c55e' },
                    { label: 'Parcial', color: '#3b82f6' },
                    { label: 'Atenção', color: '#eab308' },
                    { label: 'Descoberto', color: '#9ca3af' },
                    { label: 'Crítico', color: '#ef4444' },
                    { label: 'SOS', color: '#dc2626' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-gray-600">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Compass */}
              <div className="absolute top-4 right-4 bg-white/95 rounded-lg p-2 shadow border">
                <Navigation className="w-6 h-6 text-gray-600" />
              </div>

              {/* Scale */}
              <div className="absolute bottom-4 right-4 bg-white/95 rounded-lg px-3 py-1.5 shadow border">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-0.5 bg-gray-400" />
                  <span className="text-xs text-gray-500">~500m</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Post Details Sidebar */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Postos no Mapa</h2>

          {posts.map(post => {
            const status = statuses.find(s => s.post_id === post.id);
            const isSelected = selectedPostId === post.id;

            return (
              <Card
                key={post.id}
                className={cn('cursor-pointer transition-all', isSelected && 'ring-2 ring-blue-500 border-blue-300')}
                onClick={() => setSelectedPostId(isSelected ? null : post.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[status?.status ?? 'descoberto'] }} />
                    <h3 className="text-sm font-semibold text-gray-900">{post.name.split(' - ')[0]}</h3>
                  </div>
                  {status && <OperationalStatusBadge status={status.status} />}
                </div>

                <p className="text-xs text-gray-500 mb-2">{post.address}</p>

                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {status?.confirmed_count ?? 0}/{post.min_staff}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {post.radius_meters}m
                  </span>
                  {status?.active_sos_count ? (
                    <span className="flex items-center gap-1 text-red-600 font-semibold animate-pulse">
                      <Siren className="w-3 h-3" /> SOS
                    </span>
                  ) : null}
                </div>

                {isSelected && status && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                    <p className="text-xs font-medium text-gray-500">Detalhes</p>
                    {status.employees_present.length > 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-green-600 font-medium">Presentes:</span>
                        {status.employees_present.join(', ')}
                      </div>
                    )}
                    {status.employees_missing.length > 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-red-600 font-medium">Ausentes:</span>
                        {status.employees_missing.join(', ')}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      Turno: {status.current_shift_start ? new Date(status.current_shift_start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'} — {status.current_shift_end ? new Date(status.current_shift_end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={post.indoor_mode ? 'warning' : 'success'}>
                        {post.indoor_mode ? 'Indoor' : 'Outdoor'}
                      </Badge>
                      <Badge variant="default">
                        GPS: {post.lat.toFixed(4)}, {post.lng.toFixed(4)}
                      </Badge>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
