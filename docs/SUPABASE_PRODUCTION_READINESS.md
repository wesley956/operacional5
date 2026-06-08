# Supabase Production Readiness — Operacional5

## Objetivo

Validar o Operacional5 contra o Supabase real antes de chamar o sistema de produção.

Esta fase deve confirmar:

- Auth real.
- Banco real.
- RLS por empresa.
- Storage de evidências.
- Realtime.
- Edge Functions.
- Variáveis de ambiente.
- Fluxos principais funcionando com dados reais.

## Projeto Supabase

Project ref:

zsbsczjhiujnhdznrzck

Região:

South America — São Paulo

Branch:

fix/production-supabase-readiness

## Regras de segurança

Nunca commitar:

- .env
- .env.local
- access token da Supabase
- senha do banco
- service_role key
- JWT secret
- secrets de Edge Functions
- credenciais de Twilio, Expo ou FCM

O frontend só pode usar:

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

A service_role deve ficar apenas em Edge Functions ou backend seguro.

## Já concluído antes desta fase

A auditoria crítica já foi mergeada na main.

Itens já corrigidos:

- Ações críticas de Ocorrências, FT e Passagem de Plantão.
- Clientes reais.
- Remoção de client_id hardcoded.
- AdminPage usando audit_logs reais.
- Validação real de CNPJ.
- Funcionários editáveis.
- Escalas editáveis.
- Postos editáveis.
- Upload de evidência em Ocorrências.
- Criação de Passagem de Plantão pela UI.
- Criação de Pontos de Ronda pela UI.
- Auto-refresh operacional.
- Auth listener.
- Relatórios exportáveis.
- Mapa com OpenStreetMap.
- Notificações com status honesto.
- Supabase Realtime nas áreas operacionais.

Última validação:

- npm run verify passou.
- Build passou.
- 40 testes passaram.

## Checklist Supabase real

### 1. Estrutura local

- Confirmar pasta supabase.
- Confirmar migrations.
- Confirmar functions.
- Confirmar seed.
- Confirmar projeto linkado.

Comandos:

- ls -la supabase
- find supabase -maxdepth 3 -type f | sort
- npx supabase migration list

### 2. Banco remoto

Validar tabelas:

- companies
- profiles
- clients
- posts
- schedules
- schedule_items
- presences
- occurrences
- ft_requests
- shift_handovers
- ronda_points
- ronda_logs
- notification_logs
- alert_log
- audit_logs

### 3. RLS por empresa

Validar que uma empresa não acessa dados da outra.

Tabelas críticas:

- clients
- posts
- schedules
- profiles
- presences
- occurrences
- ft_requests
- shift_handovers
- ronda_points
- ronda_logs
- notification_logs
- alert_log
- audit_logs

Perfis:

- owner
- operations_manager
- supervisor
- employee
- client_viewer
- super_admin

### 4. Storage evidence

Validar:

- bucket evidence existe.
- bucket evidence é privado.
- upload de JPEG funciona.
- upload de PNG funciona.
- upload de WebP funciona.
- arquivo acima de 5MB é bloqueado.
- tipo inválido é bloqueado.
- occurrences.photo_url salva corretamente.
- outro tenant não acessa evidência indevida.

### 5. Realtime

Validar realtime em:

- alert_log
- occurrences
- presences
- ft_requests
- posts
- schedules
- notification_logs

Fluxos:

- criar ocorrência em uma aba e ver atualizar em outra.
- alterar presença e ver dashboard atualizar.
- criar FT e ver central atualizar.
- criar notificação e ver central atualizar.

### 6. Auth

Validar:

- login real.
- logout real.
- refresh de sessão.
- usuário sem profile não quebra app.
- usuário com empresa bloqueada é tratado.
- role carrega corretamente.
- company_id carrega corretamente.

### 7. Fluxos core

Testar com Supabase real:

- criar cliente.
- criar posto.
- editar posto.
- criar funcionário.
- editar funcionário.
- criar escala.
- editar escala.
- criar ocorrência.
- enviar evidência.
- marcar ciência.
- resolver ocorrência.
- criar FT.
- designar funcionário.
- resolver FT.
- criar passagem de plantão.
- confirmar passagem.
- criar ponto de ronda.
- exportar relatório.
- abrir mapa.

### 8. Edge Functions

Validar funções:

- create-company
- update-company-status
- sync-offline-event
- scan-absences

Comando:

npx supabase functions list

### 9. Secrets

Comando:

npx supabase secrets list

Possíveis secrets necessários:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- APP_URL
- EXPO_ACCESS_TOKEN
- FCM_SERVER_KEY
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_FROM_NUMBER

Nunca colocar secrets no frontend.

### 10. Variáveis locais

Criar somente localmente, sem commit:

VITE_SUPABASE_URL=https://zsbsczjhiujnhdznrzck.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY

### 11. Definition of Done

Esta fase termina quando:

- app roda contra Supabase real.
- login real funciona.
- dados respeitam tenant.
- RLS bloqueia acesso cruzado.
- Storage evidence funciona.
- upload de evidência funciona.
- Realtime funciona.
- Edge Functions essenciais funcionam.
- .env.local não foi commitado.
- npm run verify passa.
- PR mergeado na main.
