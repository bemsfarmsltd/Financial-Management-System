import { executeDashboardCommand } from '@/lib/staged-actions';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { toSystemRequestId } from '@/lib/request-id';
import { buildDatedRequestPrefix, createWithUniqueRequestNumber } from '@/lib/request-number';
import { nairaToKoboBigInt } from '@/lib/domain-states';

export const dynamic = 'force-dynamic';

function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(amount);
}

export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to view emergency records.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Executive access is required.' }, { status: 403 });
    const emergencyRequests = await prisma.expenditureRequest.findMany({
      where: {
        requestType: 'EMERGENCY'
      },
      include: {
        subsidiary: { select: { id: true, legalName: true, code: true } },
        requester: { select: { id: true, legalName: true, role: true } },
        accountabilityCase: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const incidents = emergencyRequests.map(r => {
      const amountNaira = Number(r.amountMinor) / 100;
      const hoursSince = (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60);
      const hoursRemaining = Math.max(0, Math.round(24 - hoursSince));

      return {
        id: r.id,
        systemId: toSystemRequestId(r.id),
        incidentCode: r.requestNumber,
        title: r.title,
        subsidiary: r.subsidiary.legalName,
        declaredBy: r.requester.legalName,
        role: r.requester.role,
        amount: amountNaira,
        amountFormatted: formatNaira(amountNaira),
        justification: r.justification,
        declaredAt: r.createdAt,
        reconciliationDeadline: new Date(new Date(r.createdAt).getTime() + 24 * 60 * 60 * 1000).toISOString(),
        hoursRemaining,
        status: r.accountabilityCase?.status === 'CLOSED' ? 'RECONCILED' : hoursRemaining === 0 ? 'OVERDUE' : 'ACTIVE_RECONCILIATION',
        alertChannelBridge: 'SMS + WhatsApp Dispatched to GMD',
        auditStatus: 'Post-Facto Ratification Pending'
      };
    });

    return NextResponse.json({
      capAmount: 1000000,
      capAmountFormatted: '₦1,000,000',
      activeExemptionsCount: incidents.filter(i => i.status === 'ACTIVE_RECONCILIATION').length,
      protocol: {
        slaHours: 24,
        notificationBridge: 'WhatsApp & SMS Instant Push',
        ratificationAuthority: 'Group Managing Director (GMD)',
        allowedRoles: ['GMD', 'SUPER_ADMIN']
      },
      incidents
    });
  } catch (error: any) {
    console.error('Error fetching emergency data:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch emergency overrides' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to declare an emergency.' }, { status: 401 });
    const body = await req.json();
    const mode = String(body.mode || (body.requestId ? 'OVERRIDE_EXISTING_REQUEST' : 'DECLARE_NEW_EMERGENCY')).toUpperCase();
    const result = await executeDashboardCommand(actor, 'emergency_override', { mode, request_id: body.requestId, subsidiary_id: body.subsidiaryId, title: body.title, justification: body.justification, amount: body.amount });
    return NextResponse.json({ success: true, mode, id: result.id, requestNumber: result.requestNumber, systemId: result.id ? toSystemRequestId(result.id) : undefined, message: 'Emergency authorization recorded. External transfer recording still requires a real bank receipt.' });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
