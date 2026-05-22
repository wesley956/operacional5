// ============================================================
// OPERACIONAL5 — Página de Login
// ============================================================

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button, Input, Card } from '@/components/ui';
import { DEMO_USERS } from '@/lib/mockData';
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
  const { loginDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = () => {
    setLoading(true);
    setError('');
    // Demo: login por email
    const demoUser = DEMO_USERS.find(u => u.profile.email === email);
    if (demoUser) {
      loginDemo(demoUser.role);
    } else {
      setError('Email não encontrado no demo. Use os botões abaixo para acesso rápido.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-600/30">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">OPERACIONAL5</h1>
          <p className="text-sm text-gray-400 mt-1">Sistema de Gestão de Segurança Privada</p>
        </div>

        {/* Login Form */}
        <Card className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Entrar no sistema</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
            <div className="relative">
              <Input
                id="password"
                label="Senha"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Button className="w-full" onClick={handleLogin} loading={loading}>
              <LogIn className="w-4 h-4 mr-2" />
              Entrar
            </Button>
          </div>
        </Card>

        {/* Demo Mode */}
        <Card>
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Modo Demo</h3>
            <p className="text-xs text-gray-500">Clique para entrar como um perfil de demonstração</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_USERS.map(user => (
              <button
                key={user.role}
                onClick={() => loginDemo(user.role)}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg text-xs font-medium transition-all ${ROLE_COLORS[user.role]}`}
              >
                <span className="font-bold">{user.label.split(' ')[0]}</span>
                <span className="opacity-80">{ROLE_LABELS[user.role]}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            OPERACIONAL5 v1.0.0-mvp1 • Gestão de Segurança Privada
          </p>
        </div>
      </div>
    </div>
  );
}
