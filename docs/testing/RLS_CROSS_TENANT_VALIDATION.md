# RLS Cross-Tenant Validation — Operacional5

## Objetivo

Validar que o Operacional5 isola corretamente os dados entre empresas/tenants no Supabase real.

Nenhum usuário da Empresa A deve conseguir ver, criar, editar ou apagar dados da Empresa B, e vice-versa.

## Ambiente

- Projeto Supabase: zsbsczjhiujnhdznrzck
- Branch: test/rls-cross-tenant-validation
- Base: main
- Data do teste: pendente

## Contas de teste

### Empresa A
- Empresa: pendente
- Usuário: pendente
- Role: pendente
- company_id: pendente

### Empresa B
- Empresa: pendente
- Usuário: pendente
- Role: pendente
- company_id: pendente

## Fluxos a validar

- [ ] clients
- [ ] posts
- [ ] profiles/employees
- [ ] schedules
- [ ] occurrences
- [ ] ft_requests
- [ ] shift_handovers
- [ ] ronda_points
- [ ] ronda_logs
- [ ] notification_logs
- [ ] alert_log
- [ ] audit_logs
- [ ] storage.objects / bucket evidence

## Teste 1 — Empresa A não vê dados da Empresa B

- [ ] Empresa A cria cliente/posto/funcionário/ocorrência.
- [ ] Empresa B cria cliente/posto/funcionário/ocorrência.
- [ ] Logado como Empresa A, dados da Empresa B não aparecem.
- [ ] Acesso direto por ID da Empresa B retorna vazio ou erro de permissão.

Resultado: pendente.

## Teste 2 — Empresa B não vê dados da Empresa A

- [ ] Logado como Empresa B, dados da Empresa A não aparecem.
- [ ] Acesso direto por ID da Empresa A retorna vazio ou erro de permissão.

Resultado: pendente.

## Teste 3 — Storage evidence

- [ ] Empresa A sobe evidência A.
- [ ] Empresa B sobe evidência B.
- [ ] Empresa A não acessa evidência B.
- [ ] Empresa B não acessa evidência A.

Resultado: pendente.

## Teste 4 — Super Admin

- [ ] Super Admin acessa painel admin.
- [ ] Super Admin vê empresas.
- [ ] Super Admin não quebra isolamento nas telas tenant comuns.

Resultado: pendente.

## Falhas encontradas

Nenhuma registrada ainda.

## Conclusão

Pendente.
