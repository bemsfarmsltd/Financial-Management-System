import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareMobileArtifact } from '../src/lib/services/mobile-release';
import { prisma } from '../src/lib/prisma';
if (!process.env.DATABASE_URL?.includes('/bems_corrections_test') || !process.env.BEMS_TEST_APK_PATH) throw new Error('Isolated database and explicit debug APK fixture required.');
async function main() {
  const bytes = await readFile(process.env.BEMS_TEST_APK_PATH!);
  await assert.rejects(prepareMobileArtifact({ appId: 'GMD_APP', version: '1.3.3+21', bytes, actorId: 'test' }), /Debug-signed APKs/);
  console.log('PASS actual apksigner verification rejects the existing debug-signed GMD download before storage or activation');
}
main().finally(() => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
