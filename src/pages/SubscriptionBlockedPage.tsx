import { Button, Card, Badge } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { AlertTriangle, LogOut } from 'lucide-react';

const REASON_LABELS: Record<string, string> = {
  suspended: 'Empresa suspensa',
  cancelled: 'Assinatura cancelada',
  expired: 'Assinatura expirada',
  trial_expired: 'Trial expirado',
  inactive: 'Empresa inativa',
  unknown: 'Acesso bloqueado',
};

export function SubscriptionBlockedPage() {
  const { companyAccess, logout } = useAuth();
  const reason = companyAccess?.reason ?? 'unknown';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-xl w-full text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <Badge variant="warning" className="mb-3">{REASON_LABELS[reason] ?? 'Acesso bloqueado'}</Badge>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso temporariamente bloqueado</h1>
        <p className="text-sm text-gray-600 mb-4">
          A empresa {companyAccess?.companyName ? <strong>{companyAccess.companyName}</strong> : 'vinculada ao seu usuário'} não está liberada para acessar o sistema neste momento.
        </p>
        {companyAccess?.trialEndsAt && (
          <p className="text-xs text-gray-500 mb-4">
            Fim do trial registrado: {new Date(companyAccess.trialEndsAt).toLocaleString('pt-BR')}
          </p>
        )}
        <div className="bg-gray-100 rounded-lg p-4 text-left text-sm text-gray-600 mb-6">
          <p className="font-medium text-gray-800 mb-1">O que fazer agora?</p>
          <p>Entre em contato com o responsável pela plataforma para ativar, reativar ou regularizar a assinatura.</p>
        </div>
        <Button variant="secondary" onClick={logout}>
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </Card>
    </div>
  );
}
