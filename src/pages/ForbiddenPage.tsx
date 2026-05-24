import { Button, Card } from '@/components/ui';
import { ShieldAlert } from 'lucide-react';

export function ForbiddenPage({ title = 'Acesso negado', message = 'Você não tem permissão para acessar esta área.' }: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <Card className="max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">{title}</h1>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <Button variant="secondary" onClick={() => window.history.back()}>
          Voltar
        </Button>
      </Card>
    </div>
  );
}
