import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import {
  LifecycleAuthorizationError,
  recordEmployeeAuditEvent,
  verifyTargetEmployeeAccess,
} from '@/lib/employee-lifecycle';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params;
    const actor = await getAuthenticatedEmployee(request);

    if (!actor) {
      return NextResponse.json({ error: 'Sign in to update profile contact details.' }, { status: 401 });
    }

    const isOwner = actor.id === employeeId;
    const isExecutive = hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN']);

    if (!isOwner && !isExecutive) {
      // Allow scoped HR only for STAFF targets in their subsidiary
      await verifyTargetEmployeeAccess(actor, employeeId, { allowExecutiveTarget: false });
    }

    const body = await request.json();

    const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
    const avatarUrl = typeof body.avatarUrl === 'string' ? body.avatarUrl.trim() : null;

    if (!phone && !avatarUrl) {
      return NextResponse.json({ error: 'Provide a valid telephone number or passport photograph URL.' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
    }

    const updateData: any = {};
    if (phone && phone.length >= 8) updateData.phone = phone;
    if (avatarUrl && avatarUrl.length > 5) updateData.avatarUrl = avatarUrl;

    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: updateData,
    });

    await recordEmployeeAuditEvent({
      actor,
      targetId: employeeId,
      action: 'CONTACT_UPDATED',
      metadata: { updatedPhone: Boolean(updateData.phone), updatedAvatar: Boolean(updateData.avatarUrl) },
    });

    return NextResponse.json({
      success: true,
      phone: updated.phone,
      avatarUrl: updated.avatarUrl,
      message: 'Staff profile updated successfully.',
    });
  } catch (error) {
    if (error instanceof LifecycleAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Failed to update phone number:', error);
    return NextResponse.json({ error: 'Could not update contact phone number.' }, { status: 500 });
  }
}
