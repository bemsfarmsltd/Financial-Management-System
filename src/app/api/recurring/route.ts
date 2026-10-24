import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { toSystemRequestId } from '@/lib/request-id';

export const dynamic = 'force-dynamic';

const annualMultipliers: Record<string, bigint> = { MONTHLY: BigInt(12), QUARTERLY: BigInt(4), ANNUAL: BigInt(1) };

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to view recurring commitments.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'HR', 'COO', 'FINANCE', 'DIRECTOR', 'HEAD_OF_ADMIN', 'AI_ANALYST', 'FINANCE_CONTROLLER'])) {
      return NextResponse.json({ error: 'You do not have access to group recurring commitments.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const subsidiary = searchParams.get('subsidiary') || searchParams.get('organization_id');

    let whereClause: any = { isRecurring: true, approvalStatus: { not: 'REJECTED' } };
    if (subsidiary && subsidiary !== 'ALL') {
      const { resolveOrganizationScope } = await import('@/lib/organizations');
      const scope = await resolveOrganizationScope(subsidiary);
      if (!scope.isGroup) {
        whereClause.subsidiaryId = { in: scope.organizationIds };
      }
    }

    const requests = await prisma.expenditureRequest.findMany({
      where: whereClause,
      select: {
        id: true,
        requestNumber: true,
        title: true,
        category: true,
        justification: true,
        deliverable: true,
        amountMinor: true,
        currency: true,
        recurringInterval: true,
        approvalStatus: true,
        paymentStatus: true,
        accountabilityStatus: true,
        neededBy: true,
        createdAt: true,
        subsidiary: { select: { id: true, legalName: true, code: true } },
        requester: { select: { id: true, legalName: true, role: true } },
        vendor: { select: { id: true, name: true } },
      },
      orderBy: [{ neededBy: 'asc' }, { createdAt: 'desc' }],
    });

    const approved = requests.filter((request) => request.approvalStatus === 'APPROVED');
    const nextDue = approved
      .filter((request) => request.neededBy && new Date(request.neededBy).getTime() >= Date.now())
      .sort((a, b) => new Date(a.neededBy).getTime() - new Date(b.neededBy).getTime())[0];
    const annualRunRateMinor = approved.reduce((total, request) => {
      const multiplier = request.recurringInterval ? annualMultipliers[request.recurringInterval] : undefined;
      return total + (multiplier ? request.amountMinor * multiplier : BigInt(0));
    }, BigInt(0));

    return NextResponse.json({
      requests: requests.map((request) => ({
        ...request,
        systemId: toSystemRequestId(request.id),
        amountMinor: request.amountMinor.toString(),
        createdAt: request.createdAt ? new Date(request.createdAt).toISOString() : new Date().toISOString(),
        neededBy: request.neededBy ? new Date(request.neededBy).toISOString() : new Date().toISOString(),
      })),
      summary: {
        approvedCount: approved.length,
        pendingCount: requests.filter((request) => ['SUBMITTED', 'IN_REVIEW', 'CLARIFICATION_REQUESTED'].includes(request.approvalStatus)).length,
        annualRunRateMinor: annualRunRateMinor.toString(),
        nextDueRequestId: nextDue?.id ?? null,
      },
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
    });
  } catch (error) {
    console.error('Recurring commitments fetch error:', error);
    return NextResponse.json({ error: 'Could not load recurring commitments.' }, { status: 500 });
  }
}
