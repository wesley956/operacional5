// ============================================================
// OPERACIONAL5 — Página de Login
// ============================================================

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui';
import { useEmployees } from '@/hooks';
import { ROLE_LABELS, type Role } from '@/lib/types';
import { Shield, Eye, EyeOff, LogIn } from 'lucide-react';

const ROLE_COLORS: Record<Role, string> = {
  gerente: 'bg-blue-600 hover:bg-blue-700 text-white',
  supervisor: 'bg-purple-600 hover:bg-purple-700 text-white',
  lider: 'bg-teal-600 hover:bg-teal-700 text-white',
  operador: 'bg-green-600 hover:bg-green-700 text-white',
  diretor: 'bg-amber-600 hover:bg-amber-700 text-white',
  admin: 'bg-gray-800 hover:bg-gray-900 text-white',
};

export function LoginPage() {
  const { login, loginDemo, isAuthenticated, isLoading } = useAuth();
  const { employees } = useEmployees({ active: true });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const demoUsers = employees.filter(user => user.role in ROLE_COLORS);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      setStatus('Sessão autenticada. Redirecionando...');
      window.location.hash = '/';
    }
  }, [isAuthenticated, isLoading]);

  async function handleLogin(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    setLoading(true);
    setError('');
    setStatus('Tentando autenticar...');

    try {
      const normalizedEmail = email.trim();

      if (!normalizedEmail) {
        throw new Error('Informe o email.');
      }

      if (!password) {
        throw new Error('Informe a senha.');
      }

      await login(normalizedEmail, password);

      setStatus('Login aprovado. Redirecionando...');

      window.setTimeout(() => {
        window.location.hash = '/';
        window.location.reload();
      }, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao entrar.';
      setError(message);
      setStatus(`Falha no login: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin(role: Role) {
    setLoading(true);
    setError('');
    setStatus('Entrando em modo demo...');

    try {
      await loginDemo(role);
      setStatus('Login demo aprovado. Redirecionando...');

      window.setTimeout(() => {
        window.location.hash = '/';
        window.location.reload();
      }, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao entrar no demo.';
      setError(message);
      setStatus(`Falha no demo: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-600/30">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">OPERACIONAL5</h1>
          <p className="text-sm text-gray-400 mt-1">Sistema de Gestão de Segurança Privada</p>
        </div>

        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Entrar no sistema</h2>

          {error ? (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {status ? (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
              Status: {status}
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <LogIn className="w-4 h-4 mr-2" />
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </Card>

        <Card>
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Modo Demo</h3>
            <p className="text-xs text-gray-500">Clique para entrar como um perfil de demonstração</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {demoUsers.map(user => (
              <button
                key={user.id}
                type="button"
                disabled={loading}
                onClick={() => void handleDemoLogin(user.role)}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg text-xs font-medium transition-all disabled:opacity-60 ${ROLE_COLORS[user.role]}`}
              >
                <span className="font-bold">{user.name.split(' ')[0]}</span>
                <span className="opacity-80">{ROLE_LABELS[user.role]}</span>
              </button>
            ))}
          </div>
        </Card>

        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            OPERACIONAL5 v1.0.0-mvp1 • Gestão de Segurança Privada
          </p>
        </div>
      </div>
    </div>
  );
}
