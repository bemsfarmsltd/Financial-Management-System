import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { toSystemRequestId } from '@/lib/request-id';
import { createWithUniqueRequestNumber } from '@/lib/request-number';

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
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Executive access is required.' }, { status: 403 });
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
        allowedRoles: ['Duty Officer', 'Facility Lead', 'Operations VP']
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
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Only the System Admin or GMD can declare an emergency override.' }, { status: 403 });
    const body = await req.json();
    const { subsidiaryId, title, justification, amount } = body;

    const amountNum = Number(amount);
    if (!subsidiaryId || !title || !justification || isNaN(amountNum)) {
      return NextResponse.json({ error: 'Missing required incident declaration fields' }, { status: 400 });
    }

    if (amountNum > 1000000) {
      return NextResponse.json({ error: 'Emergency bypass cannot exceed the ₦1,000,000 cap' }, { status: 422 });
    }

    const org = await prisma.organization.findUnique({ where: { id: subsidiaryId } });
    if (!org) {
      return NextResponse.json({ error: 'Subsidiary not found' }, { status: 404 });
    }

    const declarer = actor;
    const amountMinor = BigInt(Math.round(amountNum * 100));

    // Emergency request is immediately pre-authorized for disbursement with 24h accountability
    const request = await createWithUniqueRequestNumber('EMG-2026', async (reqNum) => {
      return await prisma.expenditureRequest.create({
        data: {
          requestNumber: reqNum,
          groupId: org.parentGroupId || org.id,
          subsidiaryId: org.id,
          requestedById: declarer.id,
          requestType: 'EMERGENCY',
          category: 'FACILITY_EMERGENCY',
          amountMinor,
          currency: 'NGN',
          title,
          justification,
          deliverable: 'Emergency repair sign-off, purchase receipt, and incident photo deliverables',
          neededBy: new Date(),
          approvalStatus: 'APPROVED', // Bypasses sequential gates
          paymentStatus: 'UNPAID',    // Ready for immediate Treasury payout
          accountabilityStatus: 'PENDING'
        }
      });
    });

    // Create 24-hour accountability case
    await prisma.accountabilityCase.create({
      data: {
        requestId: request.id,
        ownerUserId: declarer.id,
        requiredDeliverables: 'Itemized vendor invoice, signed technician waybill, and photo evidence',
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'OPEN'
      }
    });

    // Simulate WhatsApp and SMS notification bridge dispatch
    const bridgeMessage = `🚨 [EMERGENCY OVERRIDE DECLARED] Ref: ${request.requestNumber} | Entity: ${org.legalName} | Amount: ${formatNaira(amountNum)} | Officer: ${declarer.legalName} (${declarer.role}) | Justification: ${justification}. Bypassed standard gates. 24h accountability clock started.`;

    // Record immutable audit event
    await prisma.auditEvent.create({
      data: {
        actorId: declarer.id,
        actorName: declarer.legalName,
        actorRole: declarer.role,
        groupId: org.parentGroupId || org.id,
        subsidiaryId: org.id,
        targetType: 'POLICY',
        targetId: request.id,
        action: 'CREATED',
        correlationId: `CORR-EMG-${request.id}`,
        metadata: JSON.stringify({
          channelBridge: 'WhatsApp + SMS',
          alertPayload: bridgeMessage,
          reconciliationDeadline: '24 Hours'
        })
      }
    });

    return NextResponse.json({
      success: true,
      id: request.id,
      systemId: toSystemRequestId(request.id),
      requestNumber: request.requestNumber,
      message: 'Emergency bypass registered. Alert dispatched to GMD WhatsApp bridge. Payout envelope cleared.',
      bridgeMessage
    });
  } catch (error: any) {
    console.error('Error declaring emergency override:', error);
    return NextResponse.json({ error: error.message || 'Failed to declare emergency override' }, { status: 500 });
  }
}
