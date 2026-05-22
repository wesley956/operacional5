// ============================================================
// OPERACIONAL5 — Centro de Notificações
// ============================================================

import { useState } from 'react';
import { PageHeader, Card, Badge, Button } from '@/components/ui';
import { DEMO_NOTIFICATIONS } from '@/lib/mockData';
import { formatRelativeTime, cn } from '@/lib/utils';
import {
  Bell, BellOff, Check, CheckCheck, AlertTriangle, Siren,
  Clock, Users, MapPin, Shield, ArrowRight, Eye,
  Filter,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  sos: <Siren className="w-5 h-5 text-red-600" />,
  absence: <Users className="w-5 h-5 text-orange-600" />,
  ft: <Shield className="w-5 h-5 text-blue-600" />,
  occurrence: <AlertTriangle className="w-5 h-5 text-red-600" />,
  ronda: <MapPin className="w-5 h-5 text-yellow-600" />,
  handover: <ArrowRight className="w-5 h-5 text-purple-600" />,
  system: <Check className="w-5 h-5 text-green-600" />,
  escalation: <AlertTriangle className="w-5 h-5 text-red-700" />,
  schedule: <Clock className="w-5 h-5 text-blue-600" />,
};

const SEVERITY_STYLES: Record<string, string> = {
  info: 'border-l-blue-500 bg-blue-50/50',
  warning: 'border-l-yellow-500 bg-yellow-50/50',
  danger: 'border-l-orange-500 bg-orange-50/50',
  critical: 'border-l-red-500 bg-red-50/50',
};

export function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(DEMO_NOTIFICATIONS);
  const [filterUnread, setFilterUnread] = useState(false);

  const filtered = filterUnread
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  return (
    <div>
      <PageHeader
        title="Notificações"
        subtitle={`${unreadCount} não lidas de ${notifications.length} total`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={filterUnread ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilterUnread(!filterUnread)}
            >
              <Filter className="w-4 h-4 mr-1" />
              {filterUnread ? 'Todas' : 'Não lidas'}
            </Button>
            {unreadCount > 0 && (
              <Button variant="secondary" size="sm" onClick={markAllRead}>
                <CheckCheck className="w-4 h-4 mr-1" /> Marcar todas como lidas
              </Button>
            )}
          </div>
        }
      />

      {filtered.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <BellOff className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {filterUnread ? 'Nenhuma notificação não lida' : 'Nenhuma notificação'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(notification => (
            <Card
              key={notification.id}
              className={cn(
                'border-l-4 transition-all cursor-pointer',
                SEVERITY_STYLES[notification.severity],
                !notification.is_read && 'ring-1 ring-blue-200'
              )}
              onClick={() => markAsRead(notification.id)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {TYPE_ICONS[notification.type] || <Bell className="w-5 h-5 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className={cn(
                      'text-sm font-semibold',
                      notification.is_read ? 'text-gray-700' : 'text-gray-900'
                    )}>
                      {notification.title}
                    </h3>
                    {!notification.is_read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                    )}
                  </div>
                  <p className={cn(
                    'text-sm',
                    notification.is_read ? 'text-gray-500' : 'text-gray-700'
                  )}>
                    {notification.message}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{formatRelativeTime(notification.created_at)}</span>
                    {notification.post_name && <span>• {notification.post_name}</span>}
                    {notification.employee_name && <span>• {notification.employee_name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {notification.action_url && (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(notification.action_url!); }}
                      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"
                      title="Ver detalhes"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-green-600 transition-colors"
                    title="Marcar como lida"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Notification Channels Info */}
      <Card className="mt-6">
        <div className="flex items-center gap-3 mb-3">
          <Bell className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Canais de Notificação</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ChannelCard name="Sistema" description="Alertas na interface web" status="active" />
          <ChannelCard name="Push (FCM)" description="Notificações no celular" status="prepared" />
          <ChannelCard name="SMS (Twilio)" description="Fallback para SMS" status="prepared" />
        </div>
      </Card>
    </div>
  );
}

function ChannelCard({ name, description, status }: { name: string; description: string; status: 'active' | 'prepared' }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-gray-900">{name}</p>
        <Badge variant={status === 'active' ? 'success' : 'warning'}>
          {status === 'active' ? 'Ativo' : 'Preparado'}
        </Badge>
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}
