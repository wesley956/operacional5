# OPERACIONAL5 Mobile

## Configuração local

1. Instale dependências:

```bash
cd mobile
npm install
```

2. Copie o env:

```bash
cp .env.example .env.local
```

3. Preencha com Supabase público:

```env
EXPO_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=SUA_SUPABASE_ANON_PUBLIC_KEY
```

4. Rode:

```bash
npm run typecheck
npm run start
```

## Implementado nesta fase

- Expo Router com rotas base.
- Supabase Auth real com persistência via SecureStore.
- Login real do operador.
- Home do operador com escala do dia.
- Check-in GPS com geofence.
- SOS criando ocorrência crítica.
- Registro de ocorrência com GPS opcional.

## Próximas fases

- QR Code no check-in.
- Upload de foto/evidência.
- Fila offline real com expo-sqlite.
- Sync engine.
- Push notifications/device tokens.

## Fase 6B — Offline Queue + Sync

Implementado:

- Fila offline real com `expo-sqlite`.
- Check-in, SOS e ocorrência podem ser salvos localmente quando o app está offline.
- Sincronização automática quando a conexão volta.
- Indicador online/offline na Home do operador.
- Botão "Sincronizar agora".
- Edge Function `sync-offline-event` com validação de usuário, empresa e payload sanitizado.

Depois de aplicar esta fase, faça deploy da função:

```bash
npx supabase functions deploy sync-offline-event --use-api
```

## Fase 6C — Câmera, QR Code e Evidências

Implementado:

- Upload de evidências no bucket `evidence`, usando paths por `company_id`.
- Foto no check-in quando o posto exige `require_photo`.
- Foto opcional em ocorrência.
- Leitor de QR Code com `expo-camera`.
- Tela de ronda com pontos cadastrados em `ronda_points`.
- Confirmação de ponto de ronda em `ronda_logs`.
- Sync offline de ronda ajustado para o schema real.

Dependências necessárias:

```bash
cd mobile
npx expo install expo-camera expo-image-picker
npm run typecheck
```

Depois, na raiz:

```bash
npm run verify
npx supabase functions deploy sync-offline-event --use-api
```

## Fase 6D — Polimento operacional de campo

Adicionado nesta fase:

- Tela de perfil do usuário logado
- Tela de histórico operacional
- Visualização de fila offline pendente
- Tela real de passagem de plantão
- Passagem de plantão com fallback offline
- Idempotência em `shift_handovers`
- Bloqueio básico para impedir uso administrativo no app mobile

Fluxo recomendado de teste:

1. Login como operador, líder ou supervisor.
2. Acessar Perfil.
3. Acessar Histórico.
4. Registrar passagem de plantão.
5. Testar passagem offline e sincronização posterior.

## Fase 7 — Push notifications

Implementado nesta fase:

- Registro de Expo Push Token no app mobile.
- Armazenamento em `device_tokens`.
- Tela de perfil mostra status de notificações.
- Edge Function `send-alert` envia notificações via Expo Push API.
- Logs em `notification_logs`.
- SOS online tenta notificar supervisores, gerentes e admins da empresa.

Observações importantes:

- No Android, push remoto não funciona no Expo Go moderno. Para testar push remoto, use Development Build/EAS.
- O app não quebra no Expo Go: se o token não puder ser gerado, a tela de perfil mostra o motivo.
- Para enhanced security do Expo Push Service, configure `EXPO_ACCESS_TOKEN` nos Supabase Secrets.
