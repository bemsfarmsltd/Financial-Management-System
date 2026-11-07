import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const actor = await getAuthenticatedEmployee(req);
  if (!actor) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { businessId } = await params;
  const scope = await resolveAuthorizedOrganizationScope(actor, businessId);
  if (scope.organizationIds.length === 0) {
    return NextResponse.json({ error: 'Forbidden: Outside authorized subsidiary scope.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').toLowerCase().trim();

  if (!q) return NextResponse.json([]);

  const isExecutive = hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']);

  const defaultResults = [
    { type: 'Desk', label: 'Fund Requests Register', sublabel: 'View submitted requisitions', navigate: 'Fund requests' },
    ...(isExecutive
      ? [
          { type: 'Finance', label: 'Treasury Accounts', sublabel: 'Operating & disbursement balances', navigate: 'Treasury accounts' },
          { type: 'Payroll', label: 'Hybrid Payroll', sublabel: 'Monthly staff salary batches', navigate: 'Hybrid payroll' },
          { type: 'HR', label: 'Staff Profiles', sublabel: 'Registered employee directory', navigate: 'Staff profiles' },
          { type: 'HR', label: 'Admin Onboarding', sublabel: 'Executive invitations & staff approvals', navigate: 'Admin onboarding' },
          { type: 'Governance', label: 'Audit Logs', sublabel: 'Append-only regulatory event trail', navigate: 'Audit logs' },
        ]
      : []),
  ];

  const matchedNav = defaultResults.filter(
    (r) =>
      r.label.toLowerCase().includes(q) ||
      r.sublabel.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q)
  );

  const scopedRequests = await prisma.expenditureRequest.findMany({
    where: {
      subsidiaryId: { in: scope.organizationIds },
      ...(!isExecutive ? { requestedById: actor.id } : {}),
      OR: [
        { requestNumber: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      requestNumber: true,
      title: true,
      approvalStatus: true,
    },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });

  const liveMatches = scopedRequests.map((r) => ({
    type: 'Request',
    label: `${r.requestNumber} · ${r.title}`,
    sublabel: `Status: ${r.approvalStatus}`,
    navigate: 'Fund requests',
  }));

  return NextResponse.json([...liveMatches, ...matchedNav]);
}
