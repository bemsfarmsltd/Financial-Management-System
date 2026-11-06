import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveOrganizationScope } from '@/lib/organizations';

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Executive access is required to generate exports.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const rawType = String(body.report_type || body.reportType || 'audit').toLowerCase().trim();
    const reportType = ['audit', 'requests', 'fund_requests', 'disbursements', 'budgets'].includes(rawType)
      ? rawType
      : 'audit';
    const format = String(body.format || 'csv').toLowerCase() === 'json' ? 'json' : 'csv';
    const subsidiary = String(body.subsidiary || body.organization_id || body.subsidiaryId || 'ALL').trim();

    let scopeIds: string[] | null = null;
    if (subsidiary && subsidiary !== 'ALL') {
      const scope = await resolveOrganizationScope(subsidiary);
      if (!scope.isGroup) scopeIds = scope.organizationIds;
    }

    const rowCount =
      reportType === 'requests' || reportType === 'fund_requests'
        ? await prisma.expenditureRequest.count({ where: scopeIds ? { subsidiaryId: { in: scopeIds } } : {} })
        : reportType === 'disbursements'
        ? await prisma.disbursement.count({ where: scopeIds ? { payerOrgId: { in: scopeIds } } : {} })
        : reportType === 'budgets'
        ? await prisma.budget.count({ where: scopeIds ? { organizationId: { in: scopeIds } } : {} })
        : await prisma.auditEvent.count({ where: scopeIds ? { subsidiaryId: { in: scopeIds } } : {} });

    const reportId = `rep_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const params = new URLSearchParams({
      export: 'true',
      report_type: reportType,
      format,
      ...(subsidiary && subsidiary !== 'ALL' ? { subsidiary } : {}),
    });

    await prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: 'BEMS-GROUP',
        subsidiaryId: scopeIds?.[0] || null,
        targetType: 'REPORT_EXPORT',
        targetId: reportId,
        action: 'EXPORT_GENERATED',
        correlationId: `EXPORT-${reportId}`,
        metadata: JSON.stringify({ reportType, format, subsidiary, rowCount }),
      },
    });

    return NextResponse.json({
      ok: true,
      report_id: reportId,
      report_type: reportType,
      subsidiary_scope: subsidiary,
      row_count: rowCount,
      title: body.title || `${reportType.toUpperCase()} Scoped Export`,
      format,
      download_url: `/api/audit?${params.toString()}`,
      expires_at: expiresAt,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
