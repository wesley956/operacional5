# OPERACIONAL5 — Fluxos de Produto

## Presença

GPS valida raio do posto. QR é fallback. QR exige foto. Tudo gera idempotency_key.

## Ocorrência

Operador registra tipo, severidade, foto, descrição e GPS. Ocorrência crítica gera alerta.

## SOS

Operador aciona. Sistema cria ocorrência crítica, alerta supervisor e gerente. Operador não encerra SOS.

## FT

Aberta por ausência, atraso, retenção ou ação manual. Supervisor acompanha aceite e resolução.

## Ronda

Pontos por posto com QR/NFC. Registro gera prova operacional.

## Passagem

Operador registra status do posto, pendências e substituto. Se substituto não chegou, inicia retenção.
