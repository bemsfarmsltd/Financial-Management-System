import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to view audit history.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Executive audit access is required.' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit')) || 250));
    const subsidiary = searchParams.get('subsidiary') || searchParams.get('organization_id');
    const isExport = searchParams.get('export') === 'true' || searchParams.get('export') === '1';
    const format = (searchParams.get('format') || 'json').toLowerCase();
    const reportType = (searchParams.get('report_type') || 'audit').toLowerCase();

    const scope = await resolveAuthorizedOrganizationScope(actor, subsidiary);
    const scopeIds = scope.organizationIds;

    if (isExport) {
      let rows: Record<string, any>[] = [];
      if (reportType === 'requests' || reportType === 'fund_requests') {
        const reqs = await prisma.expenditureRequest.findMany({
          where: scopeIds ? { subsidiaryId: { in: scopeIds } } : {},
          include: { subsidiary: { select: { code: true, legalName: true } }, requester: { select: { legalName: true, employeeNumber: true } } },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
        rows = reqs.map((r) => ({
          requestNumber: r.requestNumber,
          title: r.title,
          subsidiary: r.subsidiary.legalName,
          requester: r.requester.legalName,
          category: r.category,
          amountNaira: Number(r.amountMinor) / 100,
          currency: r.currency,
          approvalStatus: r.approvalStatus,
          paymentStatus: r.paymentStatus,
          createdAt: r.createdAt.toISOString(),
        }));
      } else if (reportType === 'disbursements') {
        const disbs = await prisma.disbursement.findMany({
          where: scopeIds ? { payerOrgId: { in: scopeIds } } : {},
          include: { request: { select: { requestNumber: true, title: true } } },
          orderBy: { paidAt: 'desc' },
          take: limit,
        });
        rows = disbs.map((d) => ({
          id: d.id,
          requestNumber: d.request?.requestNumber || 'PAYROLL',
          beneficiaryName: d.beneficiaryName,
          beneficiaryBank: d.beneficiaryBank,
          beneficiaryAccount: d.beneficiaryAccount,
          amountNaira: Number(d.amountMinor) / 100,
          currency: d.currency,
          externalReference: d.externalReference,
          status: d.status,
          paidAt: d.paidAt.toISOString(),
        }));
      } else if (reportType === 'budgets') {
        const budgets = await prisma.budget.findMany({
          where: scopeIds ? { organizationId: { in: scopeIds } } : {},
          include: { organization: { select: { legalName: true, code: true } } },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
        rows = budgets.map((b) => ({
          id: b.id,
          subsidiary: b.organization.legalName,
          periodName: b.periodName,
          totalAmount: b.totalAmount,
          committedAmount: b.committedAmount,
          spentAmount: b.spentAmount,
          status: b.status,
        }));
      } else {
        const logs = await prisma.auditEvent.findMany({
          where: scopeIds ? { subsidiaryId: { in: scopeIds } } : {},
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
        rows = logs.map((l) => ({
          id: l.id,
          createdAt: l.createdAt.toISOString(),
          actorName: l.actorName,
          actorRole: l.actorRole,
          subsidiaryId: l.subsidiaryId || 'GROUP',
          targetType: l.targetType,
          targetId: l.targetId,
          action: l.action,
          correlationId: l.correlationId,
        }));
      }

      if (format === 'csv') {
        const headers = rows.length > 0 ? Object.keys(rows[0]) : ['id', 'createdAt', 'action'];
        const escapeCsv = (val: unknown) => {
          let str = val === null || val === undefined ? '' : String(val);
          if (typeof val === 'string' && /^[=+@\t\r-]/.test(str)) str = "'" + str;
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        };
        const csvLines = [
          headers.join(','),
          ...rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(',')),
        ];
        return new NextResponse(csvLines.join('\n'), {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'X-Report-Row-Count': String(rows.length),
            'Content-Disposition': `attachment; filename="bems-${reportType}-export.csv"`,
            'Cache-Control': 'no-store',
          },
        });
      }

      return NextResponse.json({
        ok: true,
        report_type: reportType,
        count: rows.length,
        rows,
      });
    }

    const whereClause = scopeIds ? { subsidiaryId: { in: scopeIds } } : {};

    const auditLogs = await prisma.auditEvent.findMany({
      where: whereClause,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    const safeLogs = JSON.parse(
      JSON.stringify(auditLogs, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
    );

    return NextResponse.json(
      { logs: safeLogs },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
