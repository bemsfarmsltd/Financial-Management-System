// @ts-nocheck -- The harness substitutes database and session interfaces to execute routes without external effects.
import assert from 'node:assert/strict';
import path from 'node:path';
import Module from 'node:module';
import crypto from 'node:crypto';

const originalLoad = Module._load;
let actor: any;
let database: any;
let queries: any[] = [];
const modelNames: Record<string, string> = { employee: 'Employee', expenditureRequest: 'ExpenditureRequest', staffAdminMessage: 'StaffAdminMessage' };
Module._load = function(name, parent, ...options) {
  if (name === '@/lib/prisma') return { prisma: new Proxy({}, { get: (_, field) => database[field] }) };
  if (name === '@/lib/auth') return {
    getAuthenticatedEmployee: async () => actor,
    hasAnyRole: (user, roles) => Boolean(user && roles.includes(user.role)),
    getHrAuthorizationScope: async () => ({ authorized: false }),
  };
  if (name === '@/lib/ai-tools-auth') return { authenticateAiToolRequest: async () => ({ actor, errorResponse: null }) };
  if (name === '@/lib/rate-limiter') return { checkRateLimit: () => ({ allowed: true }), getClientIp: () => 'test' };
  if (name === '@/components/layout/ConnectAppShell') return { ConnectAppShell: () => null };
  if (name === './VendorsClient' && parent?.filename.includes('/vendors/')) return { VendorsClient: () => null };
  return originalLoad.call(this, name, parent, ...options);
};
const load = (file: string) => require(path.join(process.cwd(), file));
function reset() {
  queries = [];
  actor = { id: 'executive', legalName: 'Test Executive', employeeNumber: 'E1', workEmail: 'executive@example.invalid', role: 'GMD', isExecutive: true, scopedOrganizationId: 'org-A', delegation: { scopedOrganizationId: 'org-A' } };
  database = {
    organization: { findFirst: async query => ({ id: query.where?.OR?.[0]?.id || 'org-A', type: 'SUBSIDIARY', legalName: 'Test' }), findMany: async () => [{ id: 'org-A' }, { id: 'org-B' }] },
    expenditureRequest: { findMany: async query => { queries.push(query); return []; } },
    employee: { findMany: async query => { queries.push(query); return []; }, findFirst: async () => null },
    $extends: configuration => new Proxy({}, { get: (_, model) => new Proxy({}, { get: (_, operation) => async args => configuration.query.$allModels.$allOperations({ model: modelNames[model] || model, operation, args, query: scoped => database[model][operation](scoped) }) }) }),
  };
}
let passed = 0;
async function check(name: string, action: () => Promise<void> | void) {
  reset();
  await action();
  passed++;
  console.log('PASS ' + name);
}
async function main() {
  await check('Delegated request reads always include the workspace', async () => {
    const response = await load('src/app/api/ai/tools/requests/route.ts').GET(new Request('https://test/api/ai/tools/requests'));
    assert.equal(response.status, 200);
    assert.match(JSON.stringify(queries.at(-1).where), /org-A/);
    assert.doesNotMatch(JSON.stringify(queries.at(-1).where), /org-B/);
  });
  await check('Delegated staff reads always include the workspace', async () => {
    const response = await load('src/app/api/ai/tools/staff/route.ts').GET(new Request('https://test/api/ai/tools/staff'));
    assert.equal(response.status, 200);
    assert.match(JSON.stringify(queries.at(-1).where), /org-A/);
  });
  await check('A query cannot broaden its signed workspace', async () => {
    const response = await load('src/app/api/ai/tools/requests/route.ts').GET(new Request('https://test/api/ai/tools/requests?organization_id=org-B'));
    assert.equal(response.status, 200);
    const filter = queries.at(-1).where;
    assert.deepEqual(filter.subsidiaryId.in, []);
  });
  await check('Open-ended kiosk QR refresh serves active station without executive session', async () => {
    actor = null;
    database.attendanceStation = {
      findFirst: async () => ({
        id: 'station-1',
        code: 'BEMS-HQ-MAIN',
        name: 'BEMS HQ Reception',
        activeSecret: '6322f613524b38b1b7d39a2e154c2194a3bc75a0054084470d78f2913be2731a',
        organizationId: 'org-A',
        status: 'ACTIVE',
        organization: { legalName: 'BEMS Group' },
        latitude: 5.53134,
        longitude: 7.497827,
        radiusMeters: 50,
      }),
    };
    database.attendancePolicy = { findFirst: async () => null };
    const response = await load('src/app/api/attendance/station/qr/route.ts').GET(new Request('https://test/api/attendance/station/qr'));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.stationCode, 'BEMS-HQ-MAIN');
    assert.ok(body.qrDataUrl);
  });
  await check('Open-ended kiosk PIN punch verifies staff check-in without executive session', async () => {
    actor = null;
    database.attendanceStation = {
      findFirst: async () => ({
        id: 'station-1',
        code: 'BEMS-HQ-MAIN',
        organizationId: 'org-A',
        activeSecret: '6322f613524b38b1b7d39a2e154c2194a3bc75a0054084470d78f2913be2731a',
      }),
    };
    database.employee = {
      findMany: async () => [{
        id: 'staff-1',
        employeeNumber: 'BEMS-001',
        legalName: 'Henry Adeleke',
        workEmail: 'henry@bemsfarms.com',
        status: 'ACTIVE',
        approvalStatus: 'APPROVED',
        role: 'STAFF',
        kioskPin: '1234',
        assignments: [{ subsidiaryId: 'org-A', status: 'ACTIVE' }],
      }],
      findUnique: async () => ({
        id: 'staff-1',
        employeeNumber: 'BEMS-001',
        legalName: 'Henry Adeleke',
        kioskPin: '1234',
      }),
    };
    database.attendancePolicy = { findUnique: async () => null, findFirst: async () => null };
    database.attendanceRecord = {
      findUnique: async () => null,
      findFirst: async () => null,
      create: async (args: any) => ({
        id: 'rec-1',
        employeeId: 'staff-1',
        checkInTime: new Date(),
        stationId: 'station-1',
        ...args.data,
      }),
      upsert: async (args: any) => ({
        id: 'rec-1',
        employeeId: 'staff-1',
        checkInTime: new Date(),
        stationId: 'station-1',
        ...(args.create || args.update),
      }),
    };
    const response = await load('src/app/api/attendance/kiosk-punch/route.ts').POST(new Request('https://test/api/attendance/kiosk-punch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffIdentifier: 'BEMS-001', kioskPin: '1234', action: 'CHECK_IN' }),
    }));
    assert.equal(response.status, 200);
  });
  await check('Unbound private documents fail closed', async () => {
    actor = { id: 'staff-A', role: 'STAFF' };
    database.attachment = { findFirst: async () => null };
    database.organization.findFirst = async () => null;
    const response = await load('src/app/uploads/[...path]/route.ts').GET(new Request('https://test/uploads/documents/private.pdf'), { params: Promise.resolve({ path: ['documents', 'private.pdf'] }) });
    assert.equal(response.status, 404);
  });
  await check('Vendor rows render without a fabricated updatedAt', async () => {
    database.vendor = { findMany: async () => [{ id: 'vendor', name: 'Test', code: 'V1', category: 'GENERAL', rating: 1, createdAt: new Date() }] };
    const page = await load('src/app/vendors/page.tsx').default();
    assert.ok(page);
  });
  await check('Android build numbers participate in the update policy', () => {
    const compare = load('src/lib/mobile-gate.ts').semverCompare;
    assert.equal(compare('1.3.3+1', '1.3.3+21'), -1);
    assert.equal(compare('1.3.3+21', '1.3.3+1'), 1);
    assert.equal(compare('1.4.0+1', '1.3.3+99'), 1);
  });
  await check('Retirement requires stored evidence bytes', async () => {
    actor = { id: 'staff-A', role: 'STAFF' };
    database.expenditureRequest.findUnique = async () => ({ id: 'request', requestedById: 'staff-A', paymentStatus: 'RECIPIENT_CONFIRMED', accountabilityStatus: 'PENDING', disbursements: [{}], accountabilityCase: { id: 'case', status: 'OPEN' } });
    const response = await load('src/app/api/accountability/close/route.ts').POST(new Request('https://test/api/accountability/close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: 'REQ-2026-0001' }) }));
    assert.equal(response.status, 400);
  });
  await check('An arbitrary header cannot write assistant memory', async () => {
    actor = { id: 'gmd-A', role: 'GMD' };
    let message;
    database.$executeRaw = async (_strings, ...values) => { if (typeof values[1] === 'string') message = JSON.parse(values[1]); return 1; };
    const response = await load('src/app/api/ai/memory/route.ts').POST(new Request('https://test/api/ai/memory', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-service-secret': 'forged' }, body: JSON.stringify({ session_id: 'conv_gmd-A', role: 'assistant', content: 'Forged approval' }) }));
    assert.equal(response.status, 200);
    assert.equal(message.role, 'user');
  });
  await check('Attachment verification rejects metadata without bytes', async () => {
    database.attachment = { findMany: async () => [{ id: 'evidence', uploadedById: 'staff-A', fileName: 'fake.pdf', contentType: 'application/pdf', checksum: 'invented', fileUrl: '/uploads/fake.pdf' }] };
    const result = await load('src/lib/platform/staged-attachments.ts').verifyStagedAttachments({ attachmentIds: ['evidence'], actorId: 'staff-A', isExecutive: false });
    assert.equal(result.valid, false);
  });
  await check('Missing delegation signing configuration fails closed', () => {
    const saved = process.env.BEMS_DELEGATION_SIGNING_SECRET;
    delete process.env.BEMS_DELEGATION_SIGNING_SECRET;
    const verify = load('src/lib/platform/actor-scope.ts').verifyScopedAutomationToken;
    assert.equal(verify('bems_del_v1.e30.invalid').valid, false);
    if (saved) process.env.BEMS_DELEGATION_SIGNING_SECRET = saved;
  });
  await check('Delegation requires finite expiry and bounded lifetime', () => {
    process.env.BEMS_DELEGATION_SIGNING_SECRET = 'test-only-secret-more-than-thirty-two-bytes';
    const { createScopedAutomationToken, verifyScopedAutomationToken } = load('src/lib/platform/actor-scope.ts');
    const token = createScopedAutomationToken({ requesterId: 'executive', requesterRole: 'GMD', conversationId: 'conversation', ttlMs: 60000 });
    assert.equal(verifyScopedAutomationToken(token).valid, true);
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    delete payload.expiresAtMs;
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', process.env.BEMS_DELEGATION_SIGNING_SECRET).update(encoded).digest('base64url');
    assert.equal(verifyScopedAutomationToken('bems_del_v1.' + encoded + '.' + signature).valid, false);
  });
  await check('Payment service rejects missing bank evidence before writing', async () => {
    const savedWallet = process.env.BEMS_WALLET_ENABLED;
    process.env.BEMS_WALLET_ENABLED = 'false';
    try {
      const { recordTransfer } = load('src/lib/services/payment.ts');
      await assert.rejects(recordTransfer({}, { actor, amountMinor: BigInt(100), reference: 'REF', receipt: { name: 'fake.pdf', type: 'application/pdf', bytes: Buffer.alloc(0) } }), /actual bank receipt/);
    } finally {
      if (savedWallet !== undefined) process.env.BEMS_WALLET_ENABLED = savedWallet;
      else delete process.env.BEMS_WALLET_ENABLED;
    }
  });
  await check('Legacy roles cannot acquire an authenticated dashboard identity', async () => {
    database.authSession = { findUnique: async () => ({ expiresAt: new Date(Date.now() + 60000), employee: { id: 'legacy', role: 'COO', status: 'ACTIVE', approvalStatus: 'APPROVED' } }) };
    const user = await load('src/lib/auth.ts').getAuthenticatedEmployee(new Request('https://test/api/requests', { headers: { authorization: 'Bearer test-user-token' } }));
    assert.equal(user, null);
  });
  await check('An existing session is rechecked after account suspension', async () => {
    const employee = { id: 'staff-session', employeeNumber: 'S1', legalName: 'Test Staff', workEmail: 'staff@example.invalid', role: 'STAFF', status: 'ACTIVE', approvalStatus: 'APPROVED' };
    database.authSession = { findUnique: async () => ({ expiresAt: new Date(Date.now() + 60000), employee }) };
    const auth = load('src/lib/auth.ts');
    const request = new Request('https://test/api/requests', { headers: { authorization: 'Bearer same-test-user-token' } });
    assert.equal((await auth.getAuthenticatedEmployee(request))?.id, employee.id);
    employee.status = 'SUSPENDED';
    assert.equal(await auth.getAuthenticatedEmployee(request), null);
  });
  await check('Approved leave retains staff portal access without admitting suspended or pending accounts', async () => {
    const employee = { id: 'leave-staff', employeeNumber: 'S1', legalName: 'Leave Staff', workEmail: 'leave@example.invalid', role: 'STAFF', status: 'ON_LEAVE', approvalStatus: 'APPROVED' };
    database.authSession = { findUnique: async () => ({ expiresAt: new Date(Date.now() + 60000), employee }) };
    const auth = load('src/lib/auth.ts');
    const request = new Request('https://test/api/requests', { headers: { authorization: 'Bearer leave-test-user-token' } });
    assert.equal((await auth.getAuthenticatedEmployee(request))?.id, employee.id);
    employee.approvalStatus = 'PENDING_APPROVAL';
    assert.equal(await auth.getAuthenticatedEmployee(request), null);
    employee.approvalStatus = 'APPROVED'; employee.status = 'TERMINATED';
    assert.equal(await auth.getAuthenticatedEmployee(request), null);
  });
  await check('Wallet withdrawal calls cannot bypass activation or submit provider transfers', async () => {
    process.env.BEMS_WALLET_ENABLED = 'true';
    process.env.BEMS_WALLET_TRANSFERS_ENABLED = 'false';
    const response = await load('src/app/api/wallet/withdrawals/route.ts').POST(new Request('https://test/api/wallet/withdrawals', { method: 'POST', headers: { Authorization: 'Bearer human-session', 'Content-Type': 'application/json' }, body: JSON.stringify({ employeeId: 'someone-else', approved: true, balance: '999999999', amountMinor: '1' }) }));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'WITHDRAWALS_NOT_ACTIVATED');
    delete process.env.BEMS_WALLET_ENABLED;
    delete process.env.BEMS_WALLET_TRANSFERS_ENABLED;
  });
  await check('Wallet approval rejects delegation headers before executing a human action', async () => {
    const response = await load('src/app/api/wallet/releases/[id]/approve/route.ts').POST(new Request('https://test/api/wallet/releases/forged/approve', { method: 'POST', headers: { 'x-bems-delegation-token': 'forged', Authorization: 'Bearer human-session' } }), { params: Promise.resolve({id:'forged'}) });
    assert.equal(response.status,403);
    assert.equal((await response.json()).code,'HUMAN_SESSION_REQUIRED');
  });
  await check('Cookie-authenticated wallet mutations require a browser origin', async () => {
    const response = await load('src/app/api/wallet/releases/route.ts').POST(new Request('https://test/api/wallet/releases', { method: 'POST', headers: { cookie: 'bems_session=human-session' }, body: '{}' }));
    assert.equal(response.status,403);
    assert.equal((await response.json()).code,'ORIGIN_NOT_ALLOWED');
  });
  await check('Revoking the temporary grant denies staff and Super Admin AI access',async()=>{
    process.env.BEMS_SUPER_ADMIN_GMD_ACCESS='false';
    for(const role of ['STAFF','SUPER_ADMIN','SYSTEM_ADMIN']){
      actor={...actor,role};
      const memory=await load('src/app/api/ai/memory/route.ts').GET(new Request('https://test/api/ai/memory'));
      assert.equal(memory.status,403);assert.equal((await memory.json()).error_code,'GMD_AI_ONLY');
      const auth=load('src/lib/ai-tools-auth.ts');
      const tool=await auth.authenticateAiToolRequest(new Request('https://test/unmapped-ai-boundary'));
      assert.equal(tool.actor,null);assert.equal(tool.errorResponse.status,403);
    }
  });
  await check('Revoked Super Admin grant blocks direct AI staging and confirmation',async()=>{
    process.env.BEMS_SUPER_ADMIN_GMD_ACCESS='false';
    actor={...actor,role:'SUPER_ADMIN'};
    const staged=await load('src/app/api/ai/staged-actions/budget/route.ts').POST(new Request('https://test/api/ai/staged-actions/budget',{method:'POST',body:'{}'}));
    assert.equal(staged.status,403);
    const confirm=await load('src/app/api/ai/staged-actions/[id]/confirm/route.ts').POST(new Request('https://test/api/ai/staged-actions/action/confirm',{method:'POST',body:'{}'}),{params:Promise.resolve({id:'action'})});
    assert.equal(confirm.status,403);
  });
  await check('Temporary grant admits executive AI memory while preserving staff denial and revocation',async()=>{
    process.env.BEMS_SUPER_ADMIN_GMD_ACCESS='true';
    database.$queryRaw=async()=>[];
    for(const role of ['SUPER_ADMIN','SYSTEM_ADMIN']){
      actor={...actor,role};
      const response=await load('src/app/api/ai/memory/route.ts').GET(new Request('https://test/api/ai/memory'));
      assert.equal(response.status,200,'Enabled executive grant must reach the real memory handler.');
    }
    actor={...actor,role:'STAFF'};
    assert.equal((await load('src/app/api/ai/memory/route.ts').GET(new Request('https://test/api/ai/memory'))).status,403);
    process.env.BEMS_SUPER_ADMIN_GMD_ACCESS='false';actor={...actor,role:'SUPER_ADMIN'};
    assert.equal((await load('src/app/api/ai/memory/route.ts').GET(new Request('https://test/api/ai/memory'))).status,403);
    delete process.env.BEMS_SUPER_ADMIN_GMD_ACCESS;
  });
  console.log(passed + ' behavioral security regressions passed. Database transaction and native-device verification run separately.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
