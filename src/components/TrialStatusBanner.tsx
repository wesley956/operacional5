import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function daysUntil(dateIso?: string | null) {
  if (!dateIso) return null;
  const target = new Date(dateIso);
  if (Number.isNaN(target.getTime())) return null;
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - startOfToday()) / MS_PER_DAY);
}

function formatDate(dateIso?: string | null) {
  if (!dateIso) return 'data não informada';
  return new Date(dateIso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function TrialStatusBanner() {
  const { companyAccess } = useAuth();

  const daysRemaining = useMemo(
    () => daysUntil(companyAccess?.trialEndsAt),
    [companyAccess?.trialEndsAt]
  );

  if (!companyAccess || companyAccess.subscriptionStatus !== 'trialing' || !companyAccess.trialEndsAt) {
    return null;
  }

  if (daysRemaining === null || daysRemaining > 7 || daysRemaining < 0) {
    return null;
  }

  const critical = daysRemaining <= 3;
  const isLastDay = daysRemaining === 0;

  return (
    <div className={critical ? 'mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4' : 'mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4'}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={critical ? 'mt-0.5 rounded-lg bg-amber-100 p-2 text-amber-700' : 'mt-0.5 rounded-lg bg-blue-100 p-2 text-blue-700'}>
            {critical ? <AlertTriangle className="h-5 w-5" /> : <CalendarClock className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-gray-900">
                {isLastDay ? 'O trial termina hoje' : `Trial termina em ${daysRemaining} dia${daysRemaining === 1 ? '' : 's'}`}
              </p>
              <Badge variant={critical ? 'warning' : 'info'}>Trial</Badge>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              A empresa {companyAccess.companyName ? <strong>{companyAccess.companyName}</strong> : 'atual'} está em período de teste até {formatDate(companyAccess.trialEndsAt)}.
            </p>
          </div>
        </div>

        <Link
          to="/settings"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50"
        >
          <ShieldCheck className="h-4 w-4" />
          Revisar dados da empresa
        </Link>
      </div>
    </div>
  );
}
