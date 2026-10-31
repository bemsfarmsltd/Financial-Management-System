import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor || !hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN'])) {
      return NextResponse.json({ error: 'Executive authorization (GMD or SYSTEM_ADMIN) required to delete accounts.' }, { status: 403 });
    }

    const { employeeId } = await params;
    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required.' }, { status: 400 });
    }

    const targetEmployee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        expenditureRequests: { take: 1, select: { id: true } },
        disbursementAssignments: { take: 1, select: { id: true } },
        approvalSteps: { take: 1, select: { id: true } },
        disbursementsRecorded: { take: 1, select: { id: true } },
      },
    });

    if (!targetEmployee) {
      return NextResponse.json({ error: 'Account not found or already deleted.' }, { status: 404 });
    }

    // Safety Safeguard: Cannot delete yourself
    if (actor.id === targetEmployee.id || actor.workEmail.toLowerCase() === targetEmployee.workEmail.toLowerCase()) {
      return NextResponse.json(
        { error: 'Action denied: You cannot delete your own active administrator account.' },
        { status: 400 }
      );
    }

    const hasFinancialAuditHistory =
      targetEmployee.expenditureRequests.length > 0 ||
      targetEmployee.disbursementAssignments.length > 0 ||
      targetEmployee.approvalSteps.length > 0 ||
      targetEmployee.disbursementsRecorded.length > 0;

    if (hasFinancialAuditHistory) {
      // Perform strict soft-delete to preserve statutory financial audit integrity
      await prisma.employee.update({
        where: { id: employeeId },
        data: {
          status: 'TERMINATED',
          approvalStatus: 'REJECTED',
          passwordHash: null,
          workEmail: `deleted_${Date.now()}_${targetEmployee.workEmail}`,
        },
      });

      // Purge sessions and assignments
      await prisma.authSession.deleteMany({ where: { employeeId } });
      await prisma.employeeAssignment.deleteMany({ where: { employeeId } });
      await prisma.staffWorkSchedule.deleteMany({ where: { employeeId } });
      await prisma.systemNotification.deleteMany({ where: { employeeId } });

      return NextResponse.json({
        success: true,
        message: `Account for ${targetEmployee.legalName} has historical financial entries and was safely deactivated and removed from active corporate directories.`,
      });
    }

    // Otherwise, perform clean relational deletion
    await prisma.$transaction(async (tx) => {
      // 1. Delete associated child records
      await tx.authSession.deleteMany({ where: { employeeId } });
      await tx.systemNotification.deleteMany({ where: { employeeId } });
      await tx.employeeAssignment.deleteMany({ where: { employeeId } });
      await tx.staffWorkSchedule.deleteMany({ where: { employeeId } });
      await tx.attendanceRecord.deleteMany({ where: { employeeId } });
      await tx.staffAdminMessage.deleteMany({ where: { employeeId } });
      await tx.recipientPaymentConfirmation.deleteMany({ where: { employeeId } });
      await tx.followupTask.deleteMany({ where: { assigneeId: employeeId } });

      // Clean compensation & agreements
      const agreements = await tx.employmentAgreement.findMany({
        where: { employeeId },
        select: { id: true },
      });
      const agreementIds = agreements.map((ag) => ag.id);
      const compensations = await tx.compensationAgreement.findMany({
        where: { employmentAgreementId: { in: agreementIds } },
        select: { id: true },
      });
      await tx.costAllocation.deleteMany({ where: { compensationAgreementId: { in: compensations.map((compensation) => compensation.id) } } });
      await tx.compensationAgreement.deleteMany({ where: { employmentAgreementId: { in: agreementIds } } });
      await tx.employmentAgreement.deleteMany({ where: { employeeId } });

      // Clean invitation if any
      await tx.adminInvitation.deleteMany({
        where: { workEmail: targetEmployee.workEmail.toLowerCase() },
      });

      // 2. Finally delete the employee record
      await tx.employee.delete({
        where: { id: employeeId },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Account for ${targetEmployee.legalName} (${targetEmployee.workEmail}) has been completely deleted.`,
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/employees/[employeeId]:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete account.' }, { status: 500 });
  }
}
