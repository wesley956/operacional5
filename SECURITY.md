# Política de Segurança — OPERACIONAL5

## Reporte de vulnerabilidades

Caso encontre uma vulnerabilidade, não abra uma issue pública com detalhes exploráveis.

Entre em contato com o mantenedor do projeto pelo GitHub ou pelo canal interno definido pela equipe.

## Escopo

Este projeto lida com dados sensíveis de operação de segurança privada, incluindo:

- localização de funcionários;
- registros de presença;
- evidências fotográficas;
- ocorrências operacionais;
- SOS;
- auditoria;
- dados de clientes e postos.

## SLA sugerido

- Vulnerabilidade crítica: resposta inicial em até 48h.
- Alta severidade: resposta inicial em até 5 dias úteis.
- Média/baixa: triagem em até 15 dias.

## Regras de produção

Antes de qualquer deploy real:

- VITE_DEMO_MODE deve ser false.
- VITE_APP_ENV deve ser production.
- Supabase RLS deve estar ativo.
- Storage evidence deve ser privado.
- Edge Functions devem validar permissão e payload.
- npm run verify deve passar.
- GitHub Actions deve estar verde.

## Segredos

Nunca commitar:

- .env real;
- tokens;
- service_role key;
- FCM private key;
- senhas;
- chaves de SMS/e-mail.

Apenas .env.example deve ir para o repositório.
