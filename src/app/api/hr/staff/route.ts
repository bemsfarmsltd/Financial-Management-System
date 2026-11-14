import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, getHrAuthorizationScope } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { projectSafeEmployeeDto } from '@/lib/platform/read-catalog';
import {
  approveEmployeeOnboarding,
  LifecycleAuthorizationError,
  rejectEmployeeOnboarding,
  transitionEmployeeStatus,
  verifyTargetEmployeeAccess,
} from '@/lib/employee-lifecycle';

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hrScope = await getHrAuthorizationScope(actor);
    if (!hrScope.authorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';
    const subsidiaryId = searchParams.get('subsidiaryId');
    const approvalStatus = searchParams.get('approvalStatus');
    const status = searchParams.get('status');

    // Intersect requested subsidiaryId with HR caller's authorized subsidiaryIds
    if (subsidiaryId && !hrScope.isGlobal && !hrScope.subsidiaryIds.includes(subsidiaryId)) {
      return NextResponse.json({ success: true, staff: [] });
    }

    const whereClause: any = {
      role: 'STAFF',
    };

    if (query) {
      whereClause.OR = [
        { legalName: { contains: query, mode: 'insensitive' } },
        { workEmail: { contains: query, mode: 'insensitive' } },
        { employeeNumber: { contains: query, mode: 'insensitive' } },
        { jobTitle: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (subsidiaryId) {
      whereClause.assignments = {
        some: {
          subsidiaryId,
          status: 'ACTIVE',
        },
      };
    } else if (!hrScope.isGlobal) {
      whereClause.assignments = {
        some: {
          subsidiaryId: { in: hrScope.subsidiaryIds },
          status: 'ACTIVE',
        },
      };
    }

    if (approvalStatus) {
      whereClause.approvalStatus = approvalStatus;
    }

    if (status) {
      whereClause.status = status;
    }

    const staffMembers = await prisma.employee.findMany({
      where: whereClause,
      select: {
        id: true,
        employeeNumber: true,
        legalName: true,
        workEmail: true,
        phone: true,
        status: true,
        approvalStatus: true,
        avatarUrl: true,
        jobTitle: true,
        employmentType: true,
        resumptionDate: true,
        workLocation: true,
        staffGrade: true,
        gender: true,
        dateOfBirth: true,
        residentialAddress: true,
        cityState: true,
        maritalStatus: true,
        stateOfOrigin: true,
        lga: true,
        nin: true,
        bvn: true,
        highestEducation: true,
        isOfflineStaff: true,
        isAttendanceExempt: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
        salaryBankName: true,
        salaryAccountNumber: true,
        salaryAccountName: true,
        nextOfKinName: true,
        nextOfKinPhone: true,
        nextOfKinRelationship: true,
        nextOfKinAddress: true,
        createdAt: true,
        assignments: {
          where: { status: 'ACTIVE' },
          include: {
            subsidiary: {
              select: { id: true, legalName: true, code: true, brandColor: true },
            },
            department: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        employmentAgreements: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: {
            compensations: {
              take: 1,
              orderBy: { version: 'desc' },
            },
          },
        },
        profileUpdateRequests: {
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
        _count: {
          select: {
            attendanceRecords: true,
            leaveRequests: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const serializedStaff = staffMembers.map((s) => {
      const activeAgreement = s.employmentAgreements[0];
      const activeComp = activeAgreement?.compensations[0];

      return projectSafeEmployeeDto({
        id: s.id,
        employeeNumber: s.employeeNumber,
        legalName: s.legalName,
        workEmail: s.workEmail,
        phone: s.phone,
        status: s.status,
        approvalStatus: s.approvalStatus,
        avatarUrl: s.avatarUrl,
        jobTitle: s.jobTitle,
        employmentType: s.employmentType,
        resumptionDate: s.resumptionDate,
        workLocation: s.workLocation,
        staffGrade: s.staffGrade,
        gender: s.gender,
        dateOfBirth: s.dateOfBirth,
        residentialAddress: s.residentialAddress,
        cityState: s.cityState,
        maritalStatus: s.maritalStatus,
        stateOfOrigin: s.stateOfOrigin,
        lga: s.lga,
        nin: s.nin,
        bvn: s.bvn,
        highestEducation: s.highestEducation,
        isOfflineStaff: s.isOfflineStaff,
        isAttendanceExempt: s.isAttendanceExempt,
        // Least-field projection: never expose kioskPin or passwordHash
        bankName: s.bankName,
        accountNumber: s.accountNumber,
        accountName: s.accountName,
        salaryBankName: s.salaryBankName,
        salaryAccountNumber: s.salaryAccountNumber,
        salaryAccountName: s.salaryAccountName,
        nextOfKinName: s.nextOfKinName,
        nextOfKinPhone: s.nextOfKinPhone,
        nextOfKinRelationship: s.nextOfKinRelationship,
        nextOfKinAddress: s.nextOfKinAddress,
        primaryAssignment: s.assignments.find((a) => a.isPrimary) || s.assignments[0] || null,
        assignments: s.assignments,
        currentGrossMinor: activeComp ? activeComp.grossMinor.toString() : '0',
        currency: activeComp?.currency || 'NGN',
        pendingProfileUpdates: s.profileUpdateRequests,
        totalAttendancePunches: s._count.attendanceRecords,
        totalLeaves: s._count.leaveRequests,
        createdAt: s.createdAt,
      }, actor.role);
    });

    return NextResponse.json({
      success: true,
      staff: serializedStaff,
    });
  } catch (error) {
    console.error('HR Staff API Error:', error);
    return NextResponse.json({ error: 'Failed to retrieve staff directory' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hrScope = await getHrAuthorizationScope(actor);
    if (!hrScope.authorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { action, employeeId } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'Missing employeeId' }, { status: 400 });
    }

    if (action === 'APPROVE_ONBOARDING') {
      const updated = await approveEmployeeOnboarding({
        actor,
        targetEmployeeId: employeeId,
        assignedRole: 'STAFF',
        requireStaffRoleOnly: true,
      });

      return NextResponse.json({ success: true, employee: projectSafeEmployeeDto(updated, actor.role) });
    }

    if (action === 'REJECT_ONBOARDING') {
      const { rejectionReason } = body;
      const updated = await rejectEmployeeOnboarding({
        actor,
        targetEmployeeId: employeeId,
        rejectionReason: rejectionReason || null,
        requireStaffRoleOnly: true,
      });

      return NextResponse.json({ success: true, employee: projectSafeEmployeeDto(updated, actor.role) });
    }

    if (action === 'UPDATE_STATUS') {
      const { newStatus, reason } = body;
      if (!['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'].includes(newStatus)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }

      const updated = await transitionEmployeeStatus({
        actor,
        targetEmployeeId: employeeId,
        nextStatus: newStatus,
        reason: reason || null,
        requireStaffRoleOnly: true,
      });

      return NextResponse.json({ success: true, employee: projectSafeEmployeeDto(updated, actor.role) });
    }

    if (action === 'REQUEST_PROFILE_UPDATE') {
      const { requestedFields, instructions } = body;
      if (!Array.isArray(requestedFields) || requestedFields.length === 0) {
        return NextResponse.json({ error: 'Please specify fields to update' }, { status: 400 });
      }

      await verifyTargetEmployeeAccess(actor, employeeId, { allowExecutiveTarget: false });

      const newRequest = await prisma.staffProfileUpdateRequest.create({
        data: {
          employeeId,
          requestedById: actor.id,
          requestedFields: JSON.stringify(requestedFields),
          instructions: instructions || 'Please complete these profile requirements per HR compliance policy.',
        },
      });

      await prisma.systemNotification.create({
        data: {
          employeeId,
          kind: 'ALERT',
          title: 'HR Compliance Request: Update Profile',
          body: `HR has requested that you update your profile fields: ${requestedFields.join(', ')}.`,
          linkUrl: '/profile',
        },
      });

      return NextResponse.json({ success: true, request: newRequest });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    if (error instanceof LifecycleAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('HR Staff Action Error:', error);
    return NextResponse.json({ error: 'Failed to execute staff action' }, { status: 500 });
  }
}
