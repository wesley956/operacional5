const fs = require('fs');

const file = 'supabase/migrations/001_schema_rls.sql';

if (!fs.existsSync(file)) {
  console.error(`Arquivo não encontrado: ${file}`);
  process.exit(1);
}

const sql = fs.readFileSync(file, 'utf8');

function uniq(items) {
  return [...new Set(items)].sort();
}

function matchAll(regex) {
  return [...sql.matchAll(regex)].map(match => match[1]);
}

const createdTables = uniq(matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z0-9_]+)/gi));
const rlsTables = uniq(matchAll(/ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi));
const policyTables = uniq(matchAll(/CREATE\s+POLICY\s+["']?[^"'\n]+["']?\s+ON\s+([a-zA-Z0-9_]+)/gi));

const missingRls = createdTables.filter(table => !rlsTables.includes(table));
const missingPolicy = createdTables.filter(table => !policyTables.includes(table));

const evidenceMentions = (sql.match(/evidence/gi) || []).length;
const serviceRoleMentions = (sql.match(/service_role/gi) || []).length;

const helperFunctions = uniq(matchAll(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+([a-zA-Z0-9_]+)/gi));

console.log('---- SUPABASE SQL AUDIT ----');
console.log(`Arquivo: ${file}`);
console.log('');

console.log('Tabelas criadas:', createdTables.length);
console.log(createdTables.join('\n') || '(nenhuma)');
console.log('');

console.log('Tabelas com RLS:', rlsTables.length);
console.log(rlsTables.join('\n') || '(nenhuma)');
console.log('');

console.log('Tabelas com policies:', policyTables.length);
console.log(policyTables.join('\n') || '(nenhuma)');
console.log('');

console.log('Tabelas sem RLS:', missingRls.length);
console.log(missingRls.join('\n') || 'OK — nenhuma');
console.log('');

console.log('Tabelas sem policy detectada:', missingPolicy.length);
console.log(missingPolicy.join('\n') || 'OK — nenhuma');
console.log('');

console.log('Funções auxiliares:');
console.log(helperFunctions.join('\n') || '(nenhuma)');
console.log('');

console.log('Menções ao bucket evidence:', evidenceMentions);
console.log('Menções a service_role:', serviceRoleMentions);
console.log('');

if (missingRls.length > 0 || missingPolicy.length > 0 || evidenceMentions === 0) {
  console.log('RESULTADO: ATENÇÃO — precisa revisar RLS/policies/storage.');
} else {
  console.log('RESULTADO: OK inicial — ainda assim revisar manualmente antes da produção.');
}
