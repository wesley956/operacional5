# Client Viewer Real Login — Operacional5

## Objetivo

Validar login real de um usuário externo com role `client_viewer`, vinculado a um `client_id` específico.

O usuário cliente deve acessar somente o portal do cliente e enxergar somente dados do cliente vinculado.

---

## Ambiente

- Branch: test/client-viewer-real-login
- Supabase: zsbsczjhiujnhdznrzck
- Base: main

---

## Dados do teste

### Empresa

- company_id: pendente
- nome: pendente

### Cliente vinculado

- client_id: pendente
- nome: pendente

### Usuário client_viewer

- email: pendente
- role: client_viewer
- profile.client_id: pendente

---

## Checklist

- [ ] Usuário criado no Supabase Auth.
- [ ] Profile criado com role `client_viewer`.
- [ ] Profile vinculado ao `company_id` correto.
- [ ] Profile vinculado ao `client_id` correto.
- [ ] Login realizado com sucesso.
- [ ] Usuário caiu direto em `/client-portal`.
- [ ] Usuário visualizou somente o cliente vinculado.
- [ ] Usuário visualizou somente postos do cliente vinculado.
- [ ] Usuário visualizou somente ocorrências dos postos do cliente vinculado.
- [ ] Usuário não acessou `/dashboard`.
- [ ] Usuário não acessou `/employees`.
- [ ] Usuário não acessou `/schedules`.
- [ ] Usuário não acessou `/admin`.
- [ ] Console sem erro crítico.

---

## Resultado

Pendente.

---

## Conclusão

Pendente.

## Resultado executado

- Usuário `cliente.b.rls@teste.local` criado no Supabase Auth.
- Profile criado com role `client_viewer`.
- Profile vinculado ao `company_id` da Empresa B.
- Profile vinculado ao `client_id` do Cliente Teste Empresa B.
- Posto `BETA Posto Portal Cliente` criado para o cliente vinculado.
- Login real realizado com sucesso.
- Usuário caiu corretamente em `/client-portal`.
- Portal exibiu somente o cliente vinculado.
- Portal exibiu somente posto do cliente vinculado.
- Usuário não conseguiu acessar áreas internas como Dashboard, Funcionários, Escalas e Admin.
- Console sem erro crítico observado durante o teste.

## Conclusão final

A validação real do login externo com `client_viewer` passou. O portal do cliente está funcionando com usuário autenticado, `client_id` vinculado e isolamento esperado por RLS.
