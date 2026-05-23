# LGPD e Retenção de Dados — OPERACIONAL5

## Dados tratados

O OPERACIONAL5 pode tratar dados pessoais e operacionais, como:

- nome;
- telefone;
- e-mail;
- cargo;
- localização;
- foto;
- registros de presença;
- ocorrências;
- logs de auditoria.

## Finalidade

Os dados devem ser usados apenas para:

- controle operacional;
- segurança patrimonial;
- comprovação de presença;
- resposta a incidentes;
- auditoria;
- prestação de contas ao cliente;
- obrigações legais/contratuais.

## Retenção sugerida

Valores finais dependem do jurídico/contrato.

- Logs de presença: 12 a 24 meses.
- Geolocalização detalhada: menor prazo possível, sugestão 90 a 180 dias.
- Evidências fotográficas: conforme contrato e severidade, sugestão 12 a 24 meses.
- Logs de auditoria: 24 meses ou mais, conforme obrigação legal.
- Ocorrências críticas/SOS: manter por prazo contratual/legal maior.

## Acesso

Acesso deve ser limitado por perfil:

- operador: próprios registros;
- líder: posto vinculado;
- supervisor: postos atribuídos;
- gerente/diretor: empresa;
- cliente: apenas dados liberados no portal;
- admin: acesso interno controlado.

## Exclusão e anonimização

Quando o prazo expirar:

- excluir evidências quando permitido;
- anonimizar dados de localização;
- preservar auditoria mínima quando exigida por lei/contrato.

## Produção

Antes de produção:

- revisar RLS;
- revisar Storage privado;
- criar política de privacidade;
- registrar consentimentos/termos internos;
- definir DPO/responsável LGPD;
- documentar subprocessadores: Supabase, Vercel, FCM, SMS/e-mail.
