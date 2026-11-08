import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) {
      return NextResponse.json({ error: 'Sign in to update staff records.' }, { status: 401 });
    }
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Executive authority is required to edit corporate staff details.' }, { status: 403 });
    }

    const { employeeId } = await params;
    const body = await request.json().catch(() => ({}));

    const positionName = typeof body.positionName === 'string' ? body.positionName.trim() : typeof body.jobTitle === 'string' ? body.jobTitle.trim() : undefined;
    const subsidiaryId = typeof body.subsidiaryId === 'string' && body.subsidiaryId.trim() ? body.subsidiaryId.trim() : undefined;
    const departmentId = body.departmentId === null || (typeof body.departmentId === 'string' && body.departmentId.trim()) ? (body.departmentId ? body.departmentId.trim() : null) : undefined;
    const employmentType = typeof body.employmentType === 'string' && body.employmentType.trim() ? body.employmentType.trim().toUpperCase() : undefined;
    const staffGrade = typeof body.staffGrade === 'string' ? body.staffGrade.trim() : undefined;
    const workLocation = typeof body.workLocation === 'string' ? body.workLocation.trim() : undefined;
    const resumptionDate = body.resumptionDate ? new Date(body.resumptionDate) : body.resumptionDate === null ? null : undefined;

    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.employee.findUnique({
        where: { id: employeeId },
        include: {
          assignments: {
            where: { status: 'ACTIVE' },
            orderBy: [{ isPrimary: 'desc' }, { startsOn: 'desc' }],
          },
          employmentAgreements: {
            where: { status: 'ACTIVE' },
            orderBy: { startDate: 'desc' },
            take: 1,
          },
        },
      });

      if (!target) {
        throw new Error('Staff member not found.');
      }

      // Validate subsidiary if provided
      if (subsidiaryId) {
        const org = await tx.organization.findUnique({ where: { id: subsidiaryId } });
        if (!org) throw new Error('Selected operating subsidiary does not exist.');
      }

      // Validate department if provided
      if (departmentId) {
        const dept = await tx.department.findUnique({ where: { id: departmentId } });
        if (!dept) throw new Error('Selected department does not exist.');
        if (subsidiaryId && dept.organizationId && dept.organizationId !== subsidiaryId) {
          throw new Error('Selected department does not belong to the chosen subsidiary.');
        }
      }

      // 1. Update Employee record
      const employeeUpdateData: any = {};
      if (positionName !== undefined) employeeUpdateData.jobTitle = positionName;
      if (employmentType !== undefined) employeeUpdateData.employmentType = employmentType;
      if (staffGrade !== undefined) employeeUpdateData.staffGrade = staffGrade || null;
      if (workLocation !== undefined) employeeUpdateData.workLocation = workLocation || null;
      if (resumptionDate !== undefined) employeeUpdateData.resumptionDate = resumptionDate;

      const updatedEmployee = await tx.employee.update({
        where: { id: employeeId },
        data: employeeUpdateData,
      });

      // 2. Update or Upsert single primary EmployeeAssignment (Enforce strict 1-to-1 subsidiary assignment)
      const primaryAssignment = target.assignments.find((a) => a.isPrimary) || target.assignments[0];
      let assignedSubsidiaryId = subsidiaryId || primaryAssignment?.subsidiaryId;

      if (!assignedSubsidiaryId) {
        const fallbackOrg = await tx.organization.findFirst({ orderBy: { type: 'asc' } });
        assignedSubsidiaryId = fallbackOrg?.id;
      }

      if (primaryAssignment) {
        await tx.employeeAssignment.update({
          where: { id: primaryAssignment.id },
          data: {
            ...(subsidiaryId ? { subsidiaryId } : {}),
            ...(departmentId !== undefined ? { departmentId } : {}),
            ...(positionName ? { positionName } : {}),
            status: 'ACTIVE',
            isPrimary: true,
          },
        });
        // Strictly eliminate any secondary assignments to guarantee 1-to-1 subsidiary mapping
        await tx.employeeAssignment.deleteMany({
          where: {
            employeeId,
            id: { not: primaryAssignment.id },
          },
        });
      } else if (assignedSubsidiaryId) {
        await tx.employeeAssignment.deleteMany({
          where: { employeeId },
        });
        await tx.employeeAssignment.create({
          data: {
            employeeId,
            subsidiaryId: assignedSubsidiaryId,
            departmentId: departmentId || null,
            positionName: positionName || updatedEmployee.jobTitle || 'Staff',
            isPrimary: true,
            status: 'ACTIVE',
          },
        });
      }

      // 3. Update EmploymentAgreement if entity changed
      const activeAgreement = target.employmentAgreements[0];
      if (activeAgreement && (subsidiaryId || employmentType)) {
        await tx.employmentAgreement.update({
          where: { id: activeAgreement.id },
          data: {
            ...(subsidiaryId ? { employerEntityId: subsidiaryId } : {}),
            ...(employmentType ? { agreementType: employmentType === 'CONTRACT' ? 'CONTRACT' : 'PERMANENT' } : {}),
          },
        });
      }

      // 4. Create Audit Log
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          actorName: actor.legalName,
          actorRole: actor.role,
          groupId: assignedSubsidiaryId || 'BEMS-GROUP',
          subsidiaryId: assignedSubsidiaryId,
          targetType: 'EMPLOYEE',
          targetId: employeeId,
          action: 'STAFF_CORPORATE_DETAILS_UPDATED',
          correlationId: `CORR-CORP-${randomUUID()}`,
          metadata: JSON.stringify({
            positionName,
            subsidiaryId,
            departmentId,
            employmentType,
            staffGrade,
            workLocation,
            resumptionDate: resumptionDate ? resumptionDate.toISOString() : resumptionDate,
            previous: {
              jobTitle: target.jobTitle,
              employmentType: target.employmentType,
              staffGrade: target.staffGrade,
              workLocation: target.workLocation,
              subsidiaryId: primaryAssignment?.subsidiaryId,
              departmentId: primaryAssignment?.departmentId,
            },
          }),
        },
      });

      return updatedEmployee;
    });

    return NextResponse.json({
      success: true,
      message: 'Staff company details updated successfully.',
      employee: result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update staff company details.' }, { status: 400 });
  }
}
