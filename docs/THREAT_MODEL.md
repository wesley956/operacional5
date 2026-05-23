# Modelo de Ameaças — OPERACIONAL5

## Objetivo

Identificar riscos principais do sistema antes da produção.

## Ativos sensíveis

- Localização em tempo real.
- Evidências fotográficas.
- Presença/check-in.
- Ocorrências críticas.
- SOS.
- Auditoria.
- Dados de clientes.
- Dados de funcionários.

## Ameaças principais

### 1. Usuário tentando alterar role pelo navegador

Risco: operador tentar virar supervisor/gerente/admin pelo DevTools.

Mitigação:

- permissões no frontend apenas para UX;
- validação real no Supabase RLS;
- Edge Functions verificando role;
- nunca confiar no role vindo do cliente.

### 2. Modo demo em produção

Risco: perfis demo e dados locais ficarem acessíveis em produção.

Mitigação implementada:

- VITE_APP_ENV;
- VITE_DEMO_MODE;
- assertSafeRuntimeConfig bloqueando demo fora de local.

### 3. GPS falso/mock location

Risco: funcionário simular presença no posto sem estar lá.

Mitigação:

- detectar mock location;
- validar raio no servidor;
- exigir QR/foto quando GPS for fraco;
- auditar rejeições;
- marcar presença como pending_review ou rejected.

### 4. Vazamento da anon key do Supabase

A anon key é pública por natureza, mas não pode conceder acesso indevido.

Mitigação:

- RLS obrigatório;
- policies por company_id;
- can_access_post(post_id);
- Storage privado;
- Edge Functions sem service_role exposto ao cliente.

### 5. Vazamento de evidências

Risco: fotos de ocorrências/funcionários acessadas por pessoas sem permissão.

Mitigação:

- bucket evidence privado;
- URLs assinadas;
- checagem de permissão antes de acesso;
- audit log de visualização.

### 6. Flood de eventos offline

Risco: atacante enviar milhares de eventos falsos para sync-offline-event.

Mitigação recomendada:

- rate limiting por usuário/IP;
- validação de idempotency_key;
- validação de schema;
- autenticação obrigatória;
- logs e bloqueio por abuso.

## Regra geral

Toda ação crítica precisa validar no servidor:

- usuário autenticado;
- company_id;
- role;
- acesso ao posto;
- idempotência;
- audit log.
