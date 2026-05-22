# OPERACIONAL5 — Setup Local

## Requisitos

- Node.js 20.19+ recomendado
- npm
- CodeSandbox, Codespaces ou ambiente local

## Instalação

npm install
npm run dev

## Validação

npm run verify

Esse comando executa build, lint, testes e verificação de isolamento do mockData.

## Modo demo

VITE_DEMO_MODE=true

Nesse modo, as páginas usam hooks e DataProvider, e os dados vêm do DemoAdapter.

## Estrutura de dados

Page -> Hook -> DataProvider -> Adapter

As páginas não devem importar src/lib/mockData.ts diretamente.
