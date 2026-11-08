const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (url.pathname !== '/bems_corrections_test') throw new Error('Use only the isolated bems_corrections_test database.');
  const schema = 'wallet_regression_' + randomUUID().replace(/-/g, '');
  const admin = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    url.searchParams.set('schema', schema);
    const env = { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString() };
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js','migrate','deploy'], { env, stdio: 'inherit' });
    execFileSync(process.execPath, ['scripts/run-typescript.cjs','scripts/regression-wallet.ts'], { env, stdio: 'inherit' });
    execFileSync(process.execPath, ['scripts/run-typescript.cjs','scripts/regression-wallet-provider.ts'], { env, stdio: 'inherit' });
  } finally {
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
