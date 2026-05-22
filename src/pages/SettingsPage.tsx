// ============================================================
// OPERACIONAL5 — Página de Configurações
// ============================================================

import { PageHeader, Card, Button, Input } from '@/components/ui';
import { DEMO_COMPANY, DEMO_CLIENT } from '@/lib/mockData';
import { Building2, MapPin, Phone, Mail, Clock, Shield, Bell, Smartphone, Database, Key } from 'lucide-react';

export function SettingsPage() {
  const company = DEMO_COMPANY;
  const client = DEMO_CLIENT;

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Configurações da empresa e do sistema" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Info */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Dados da Empresa</h3>
          </div>
          <div className="space-y-4">
            <Input id="company-name" label="Razão Social" defaultValue={company.name} />
            <Input id="company-cnpj" label="CNPJ" defaultValue={company.cnpj} />
            <Input id="company-phone" label="Telefone" defaultValue={company.phone} />
            <Input id="company-email" label="Email" defaultValue={company.email} />
            <Input id="company-address" label="Endereço" defaultValue={company.address} />
            <Button>Salvar Alterações</Button>
          </div>
        </Card>

        {/* Client Info */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Building2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Cliente Principal</h3>
              <p className="text-xs text-gray-500">{client.name}</p>
            </div>
          </div>
          <div className="space-y-4">
            <Input id="client-name" label="Nome do Cliente" defaultValue={client.name} />
            <Input id="client-contact" label="Contato" defaultValue={client.contact_name} />
            <Input id="client-phone" label="Telefone" defaultValue={client.contact_phone} />
            <Button variant="secondary">Editar Cliente</Button>
          </div>
        </Card>

        {/* Operational Settings */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Configurações Operacionais</h3>
          </div>
          <div className="space-y-4">
            <Input id="tolerance" label="Tolerância de Check-in (minutos)" type="number" defaultValue="15" />
            <Input id="default-radius" label="Raio GPS Padrão (metros)" type="number" defaultValue="50" />
            <Input id="min-accuracy" label="Acurácia Mínima GPS (metros)" type="number" defaultValue="50" />
            <Input id="ronda-interval" label="Intervalo de Rondas (minutos)" type="number" defaultValue="120" />
            <div className="flex items-center gap-2">
              <input type="checkbox" id="require-photo" className="rounded" defaultChecked />
              <label htmlFor="require-photo" className="text-sm text-gray-700">Exigir foto em todos os check-ins</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="mock-detect" className="rounded" defaultChecked />
              <label htmlFor="mock-detect" className="text-sm text-gray-700">Detectar GPS falso/mock location</label>
            </div>
            <Button>Salvar Configurações</Button>
          </div>
        </Card>

        {/* Notifications */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Bell className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Notificações</h3>
          </div>
          <div className="space-y-3">
            <NotificationSetting
              icon={<Shield className="w-4 h-4" />}
              title="SOS"
              description="Notificar supervisor e gerente quando SOS for disparado"
              enabled={true}
            />
            <NotificationSetting
              icon={<Clock className="w-4 h-4" />}
              title="Ausência"
              description="Alertar quando operador não aparece após tolerância"
              enabled={true}
            />
            <NotificationSetting
              icon={<MapPin className="w-4 h-4" />}
              title="GPS Falso"
              description="Alertar quando mock location for detectado"
              enabled={true}
            />
            <NotificationSetting
              icon={<Smartphone className="w-4 h-4" />}
              title="Push Notifications"
              description="FCM preparado para fase 2"
              enabled={false}
              disabled
            />
          </div>
        </Card>

        {/* Storage & Security */}
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Database className="w-5 h-5 text-gray-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Storage & Segurança</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Bucket de Evidências</h4>
              <p className="text-xs text-gray-500 mb-2">
                Fotos e evidências são armazenadas no Supabase Storage privado.
                Acesso apenas via URLs assinadas com expiração.
              </p>
              <div className="text-xs space-y-1">
                <p className="flex items-center gap-1 text-green-600">
                  <Key className="w-3 h-3" /> Bucket: <code className="bg-gray-200 px-1 rounded">evidence</code>
                </p>
                <p className="text-gray-400">Caminho: evidence/company_id/post_id/yyyy-mm/arquivo.jpg</p>
                <p className="text-gray-400">Formatos: JPEG, PNG, WebP</p>
                <p className="text-gray-400">Tamanho máximo: 10MB</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Segurança</h4>
              <div className="text-xs space-y-2">
                <p className="flex items-center gap-2 text-green-600">
                  <Shield className="w-3 h-3" /> RLS habilitado em todas as tabelas
                </p>
                <p className="flex items-center gap-2 text-green-600">
                  <Key className="w-3 h-3" /> Isolamento por company_id
                </p>
                <p className="flex items-center gap-2 text-green-600">
                  <Phone className="w-3 h-3" /> URLs assinadas para evidências
                </p>
                <p className="flex items-center gap-2 text-green-600">
                  <Mail className="w-3 h-3" /> Validação server-side
                </p>
                <p className="flex items-center gap-2 text-gray-400">
                  <Smartphone className="w-3 h-3" /> FCM/SMS — preparado fase 2
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 text-center">
        <p className="text-xs text-gray-400">
          OPERACIONAL5 v1.0.0-mvp1 • Configurações em modo demo
        </p>
      </div>
    </div>
  );
}

function NotificationSetting({ icon, title, description, enabled, disabled }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg ${disabled ? 'bg-gray-50 opacity-60' : 'bg-gray-50'}`}>
      <div className="flex items-center gap-3">
        <div className="text-gray-500">{icon}</div>
        <div>
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <div className="flex items-center">
        <div className={`w-10 h-5 rounded-full relative ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
          <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${enabled ? 'right-0.5' : 'left-0.5'}`} />
        </div>
      </div>
    </div>
  );
}
