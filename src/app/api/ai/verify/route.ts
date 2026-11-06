import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    }

    const isExecutive = hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']);
    if (!isExecutive) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Not permitted.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const recordType = searchParams.get('record_type');
    const recordId = searchParams.get('record_id');
    const stagedActionId = searchParams.get('staged_action_id');

    const authorizedScope = await resolveAuthorizedOrganizationScope(actor, 'ALL');
    const allowedOrgIds = new Set(authorizedScope.organizationIds);

    let exists = false;
    let record: any = null;
    let notificationDeliveryStatus: 'DELIVERED' | 'PENDING' | 'NOT_APPLICABLE' = 'PENDING';

    if (stagedActionId) {
      const action = await prisma.stagedAction.findUnique({ where: { id: stagedActionId } });
      if (!action) {
        return NextResponse.json({ ok: true, exists: false, record: null, notification_delivery_status: 'PENDING' });
      }

      // Enforce owner or Super Admin access on stagedAction inspection
      const isActorSuperAdmin = hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN']);
      if (action.userId !== actor.id && !isActorSuperAdmin) {
        return NextResponse.json(
          { ok: false, error_code: 'FORBIDDEN', message: 'You can only verify staged actions initiated by your account.' },
          { status: 403 }
        );
      }

      let payloadSubId: string | null = null;
      try {
        const parsedPayload = JSON.parse(action.payload || '{}');
        payloadSubId = parsedPayload?.subsidiaryId || parsedPayload?.organization_id || null;
      } catch {
        payloadSubId = null;
      }

      if (payloadSubId && !allowedOrgIds.has(payloadSubId)) {
        return NextResponse.json(
          { ok: false, error_code: 'FORBIDDEN', message: 'Target subsidiary is outside your authorized scope.' },
          { status: 403 }
        );
      }

      if (action.status === 'EXECUTED') {
        exists = true;
        record = action.resultJson ? JSON.parse(action.resultJson) : { id: action.id, status: action.status };

        const notificationIntent: string[] = Array.isArray(record?.notification_intent)
          ? record.notification_intent
          : [];
        const notificationsSent: string[] = Array.isArray(record?.notifications_sent)
          ? record.notifications_sent
          : [];

        if (notificationIntent.length === 0 && notificationsSent.length === 0) {
          notificationDeliveryStatus = 'NOT_APPLICABLE';
        } else {
          const verifiedNotifCount = await prisma.systemNotification.count({
            where: {
              employeeId: { in: notificationIntent.length > 0 ? notificationIntent : notificationsSent },
              createdAt: { gte: new Date((action.executedAt || action.createdAt).getTime() - 5000) },
            },
          });
          notificationDeliveryStatus = verifiedNotifCount > 0 ? 'DELIVERED' : 'PENDING';
        }

        return NextResponse.json({
          ok: true,
          exists: true,
          status: action.status,
          record,
          notification_intent: notificationIntent,
          notifications_sent: notificationsSent,
          notification_delivery_status: notificationDeliveryStatus,
        });
      }

      return NextResponse.json({
        ok: true,
        exists: false,
        status: action.status,
        record: null,
        notification_intent: [],
        notifications_sent: [],
        notification_delivery_status: 'NOT_APPLICABLE',
      });
    } else if (recordType === 'fund_request' && recordId) {
      const item = await prisma.expenditureRequest.findFirst({
        where: { OR: [{ id: recordId }, { requestNumber: recordId }] },
      });
      if (item) {
        if (!allowedOrgIds.has(item.subsidiaryId)) {
          return NextResponse.json({ ok: false, error_code: 'FORBIDDEN', message: 'Request subsidiary outside scope.' }, { status: 403 });
        }
        exists = true;
        record = JSON.parse(JSON.stringify(item, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));
        const notif = await prisma.systemNotification.findFirst({
          where: {
            OR: [
              { linkUrl: { contains: item.id } },
              { body: { contains: item.requestNumber } },
            ],
          },
          select: { id: true },
        });
        notificationDeliveryStatus = notif ? 'DELIVERED' : 'PENDING';
      }
    } else if (recordType === 'budget' && recordId) {
      const item = await prisma.budget.findUnique({ where: { id: recordId }, include: { lines: true } });
      if (item) {
        if (!allowedOrgIds.has(item.organizationId)) {
          return NextResponse.json({ ok: false, error_code: 'FORBIDDEN', message: 'Budget organization outside scope.' }, { status: 403 });
        }
        exists = true;
        record = JSON.parse(JSON.stringify(item, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));
        notificationDeliveryStatus = 'NOT_APPLICABLE';
      }
    } else if (recordType === 'disbursement' && recordId) {
      const item = await prisma.disbursement.findUnique({ where: { id: recordId } });
      if (item) {
        if (!allowedOrgIds.has(item.payerOrgId)) {
          return NextResponse.json({ ok: false, error_code: 'FORBIDDEN', message: 'Disbursement organization outside scope.' }, { status: 403 });
        }
        exists = true;
        record = JSON.parse(JSON.stringify(item, (_, v) => (typeof v === 'bigint' ? Number(v) : v)));
        const notif = item.requestId
          ? await prisma.systemNotification.findFirst({
              where: { linkUrl: { contains: item.requestId } },
              select: { id: true },
            })
          : null;
        notificationDeliveryStatus = notif ? 'DELIVERED' : 'PENDING';
      }
    }

    return NextResponse.json({
      ok: true,
      exists,
      record,
      notification_delivery_status: notificationDeliveryStatus,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
