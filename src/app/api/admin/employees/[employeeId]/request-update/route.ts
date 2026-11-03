import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }

    if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'SYSTEM_ADMIN' && actor.role !== 'GMD') {
      return NextResponse.json(
        { error: 'Forbidden: Only Super admin or The Group Managing Director can request staff profile updates.' },
        { status: 403 }
      );
    }

    const { employeeId } = await params;
    const body = await request.json();
    const { requestedFields, instructions } = body;

    if (!Array.isArray(requestedFields) || requestedFields.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one information field for the staff member to update.' },
        { status: 400 }
      );
    }

    const targetEmployee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, legalName: true, workEmail: true },
    });

    if (!targetEmployee) {
      return NextResponse.json({ error: 'Target staff member not found.' }, { status: 404 });
    }

    // Cancel any previous pending request for this employee
    await prisma.staffProfileUpdateRequest.updateMany({
      where: { employeeId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });

    // Create the new active profile update request
    const updateRequest = await prisma.staffProfileUpdateRequest.create({
      data: {
        employeeId,
        requestedById: actor.id,
        requestedFields: JSON.stringify(requestedFields),
        instructions: typeof instructions === 'string' && instructions.trim() ? instructions.trim() : null,
        status: 'PENDING',
      },
    });

    // Send in-app system notification
    await prisma.systemNotification.create({
      data: {
        employeeId,
        title: 'Action Required: Profile Update Requested',
        body: instructions || 'An administrator has requested that you verify and update specific records in your profile.',
        kind: 'ACTION_REQUIRED',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Profile update request triggered successfully for ${targetEmployee.legalName}.`,
      updateRequest,
    });
  } catch (error: any) {
    console.error('[request-update] Error creating profile update request:', error);
    return NextResponse.json({ error: error.message || 'Failed to create request.' }, { status: 500 });
  }
}
