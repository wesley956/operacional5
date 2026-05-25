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
