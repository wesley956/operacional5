const { execSync } = require('child_process');

const allowed = [
  'src/lib/mockData.ts',
  'src/lib/data/adapters/demo-adapter.ts',
  'src/lib/data/data-provider.ts',
  'src/lib/env.ts',
  'src/context/AuthContext.tsx',
  'src/vite-env.d.ts',
];

let output = '';

try {
  output = execSync(
    `grep -R "from '@/lib/mockData'\\|from '../../mockData'\\|mockData\\|DEMO_" -n src --exclude-dir=node_modules || true`,
    { encoding: 'utf8' }
  );
} catch (error) {
  output = error.stdout || '';
}

const violations = output
  .split('\n')
  .filter(Boolean)
  .filter(line => !allowed.some(file => line.startsWith(file + ':')));

if (violations.length > 0) {
  console.error('\n❌ MockData vazou para fora da camada permitida:\n');
  console.error(violations.join('\n'));
  console.error('\nUse hooks/services/DataProvider em vez de importar mockData direto.\n');
  process.exit(1);
}

console.log('✅ MockData isolado corretamente.');
