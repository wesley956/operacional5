# OPERACIONAL5 — Testes

## Rodar tudo

npm run verify

## Testes atuais

Arquivo: tests/critical-rules.test.ts

Cobertura:

- Haversine
- geofence
- mock location
- checkGeofence
- ciclo 12x36
- turno cruzando meia-noite
- conflitos de escala
- status operacional
- permissões por cargo


## Coverage

Rodar cobertura:

npm run test:coverage

Threshold inicial configurado como baseline do estado atual:

- lines: 60%
- functions: 48%
- branches: 60%
- statements: 59%

Meta futura: subir gradualmente para 70%+ criando testes para hooks, adapters e utils.
