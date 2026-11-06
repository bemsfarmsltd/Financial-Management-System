import { NextRequest, NextResponse } from 'next/server';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;

  return NextResponse.json({
    ok: true,
    service: 'BEMS Enterprise AI Agent Tooling Gateway',
    version: '1.2.0',
    authenticatedActor: {
      name: actor?.legalName,
      role: actor?.role,
      isExecutive: actor?.isExecutive,
    },
    availableTools: [
      {
        name: 'budgets',
        endpoint: '/api/ai/tools/budgets',
        methods: ['GET', 'POST'],
        description: 'List, create, edit, reallocate lines, and remove corporate fiscal budgets across subsidiaries.',
      },
      {
        name: 'subsidiary',
        endpoint: '/api/ai/tools/subsidiary',
        methods: ['GET', 'POST'],
        description: 'List or create corporate subsidiaries, entities, and SPVs.',
      },
      {
        name: 'approvals',
        endpoint: '/api/ai/tools/approvals',
        methods: ['GET', 'POST'],
        description: 'Approve/reject fund requests and retrieve beneficiary account details + bank app deep links.',
      },
      {
        name: 'bank_accounts',
        endpoint: '/api/ai/tools/bank-accounts',
        methods: ['POST'],
        description: 'Register or update bank account details for staff, subsidiary, or vendor.',
      },
      {
        name: 'admin_onboarding',
        endpoint: '/api/ai/tools/admin-onboarding',
        methods: ['POST'],
        description: 'Onboard and provision executive admin roles (SUPER_ADMIN or GMD).',
      },
      {
        name: 'payroll',
        endpoint: '/api/ai/tools/payroll',
        methods: ['GET', 'POST'],
        description: 'Prepare monthly payroll batches, list payslips, sign off, and record payouts.',
      },
      {
        name: 'attendance',
        endpoint: '/api/ai/tools/attendance',
        methods: ['GET', 'POST'],
        description: 'Inspect live daily attendance, excuse penalties, clock in/out staff, and configure policy.',
      },
      {
        name: 'vendors',
        endpoint: '/api/ai/tools/vendors',
        methods: ['GET', 'POST'],
        description: 'Vendor & supplier master registry, NUBAN bank check, and automated 3-way matching engine (PO vs GRN vs Invoice).',
      },
      {
        name: 'intercompany',
        endpoint: '/api/ai/tools/intercompany',
        methods: ['GET', 'POST'],
        description: 'Automated intercompany debit/credit note generation, cross-entity recharge matrix, and GMD netting settlement.',
      },
    ],
  });
}

