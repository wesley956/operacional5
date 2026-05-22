# OPERACIONAL5 — Sistema de Gestão de Segurança Privada

## Produto Final de Código — Pronto para Produção

### Início Rápido

```bash
npm install
npm run dev        # Desenvolvimento
npm run build      # Build produção
npm run test       # Testes
```

### Arquitetura de Dados

O sistema NÃO importa mockData diretamente nas páginas. Toda comunicação passa pela camada de dados:

```
Page → Hook → Service/Repository → Adapter → (Demo | Supabase)
```

- `src/lib/data/data-provider.ts` — Interface central + factory
- `src/lib/data/adapters/demo-adapter.ts` — Dados locais para desenvolvimento
- `src/lib/data/adapters/supabase-adapter.ts` — Preparado para Supabase real
- `src/hooks/index.ts` — 13 hooks que as páginas usam

### Modos de Operação

| Modo | Quando | Auth | Dados |
|------|--------|------|-------|
| Demo | Sem Supabase | Perfis demo | localStorage/memória via DemoAdapter |
| Produção | Com Supabase | Supabase Auth | PostgreSQL via SupabaseAdapter |

Para ativar produção, configurar `.env`:
```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-key
DEMO_MODE=false
```

### Perfis e Permissões

6 perfis com permissões centralizadas em `src/lib/utils.ts`:
- **Operador**: check-in, ocorrência, SOS, ronda
- **Líder**: + ver equipe, abrir FT local
- **Supervisor**: + encerrar SOS, resolver FT, ver mapa
- **Gerente**: + toda empresa, relatórios, auditoria
- **Diretor**: + visão executiva
- **Admin**: gestão do sistema

### Testes

```bash
npm run test
```

Cobrem: geofence, Haversine, mock detection, ciclo 12x36, conflitos de escala, status operacional, permissões.

### Configuração Final (Supabase)

1. Criar projeto em supabase.com
2. Aplicar `supabase/migrations/001_schema_rls.sql`
3. Popular com `supabase/seed/demo.sql`
4. Configurar Storage bucket `evidence`
5. Deploy Edge Functions em `supabase/functions/`
6. Configurar variáveis no `.env`

### Mobile

```bash
cd mobile
npm install
npx expo start
```

Estrutura: `mobile/src/services/` com offline queue, location, API, camera.

### Edge Functions

- `scan-absences/` — Detecta ausência, abre FT automática
- `escalate-alerts/` — Escala alertas sem ciência
- `sync-offline-event/` — Recebe eventos offline com idempotência

### Estrutura de Arquivos

```
src/
  App.tsx                          # Router + DataProvider init
  context/AuthContext.tsx           # Auth demo/supabase
  lib/
    types.ts                       # Tipos compartilhados
    geo.ts                         # Haversine, geofence, mock detection
    utils.ts                       # Permissões, audit, validação
    domain/
      post-status.ts               # Cálculo de status operacional
      cycle-12x36.ts               # Escala 12x36 e conflitos
    data/
      data-provider.ts             # Interface + factory
      adapters/
        demo-adapter.ts            # Dados demo isolados
        supabase-adapter.ts        # Preparado para Supabase
    mockData.ts                    # Dados demo (só usado pelo demo-adapter)
  hooks/index.ts                   # 13 hooks reais
  components/                      # UI, Layout, Dashboard
  pages/                           # 16 páginas
tests/                             # Testes de regras críticas
supabase/                          # Migrations, seed, functions
mobile/                            # App Expo completo
```
