import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, isHrAuthorizedEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await isHrAuthorizedEmployee(actor))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const whereClause: any = {};
    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    const leaves = await prisma.leaveRequest.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            legalName: true,
            workEmail: true,
            avatarUrl: true,
            jobTitle: true,
            assignments: {
              where: { status: 'ACTIVE' },
              include: {
                subsidiary: { select: { id: true, legalName: true, code: true } },
                department: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const serializedLeaves = leaves.map((l) => ({
      id: l.id,
      employeeId: l.employeeId,
      employeeName: l.employee.legalName,
      employeeNumber: l.employee.employeeNumber,
      avatarUrl: l.employee.avatarUrl,
      jobTitle: l.employee.jobTitle,
      subsidiary: l.employee.assignments[0]?.subsidiary?.legalName || 'BEMS Group',
      department: l.employee.assignments[0]?.department?.name || 'General',
      leaveType: l.leaveType,
      startDate: l.startDate,
      endDate: l.endDate,
      reason: l.reason,
      handoverNotes: l.handoverNotes,
      status: l.status,
      reviewedById: l.reviewedById,
      reviewedByName: l.reviewedByName,
      reviewNote: l.reviewNote,
      reviewedAt: l.reviewedAt,
      createdAt: l.createdAt,
    }));

    return NextResponse.json({
      success: true,
      leaves: serializedLeaves,
    });
  } catch (error) {
    console.error('HR Leave API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch leave requests' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await isHrAuthorizedEmployee(actor))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { action, leaveId, employeeId, leaveType, startDate, endDate, reason, handoverNotes, reviewNote } = body;

    if (action === 'CREATE') {
      const targetEmpId = employeeId || actor.id;
      if (!leaveType || !startDate || !endDate || !reason) {
        return NextResponse.json({ error: 'Missing required leave fields' }, { status: 400 });
      }

      const newLeave = await prisma.leaveRequest.create({
        data: {
          employeeId: targetEmpId,
          leaveType,
          startDate,
          endDate,
          reason,
          handoverNotes: handoverNotes || null,
          status: 'PENDING',
        },
      });

      return NextResponse.json({ success: true, leave: newLeave });
    }

    if (action === 'APPROVE') {
      if (!leaveId) {
        return NextResponse.json({ error: 'Missing leaveId' }, { status: 400 });
      }

      const updated = await prisma.leaveRequest.update({
        where: { id: leaveId },
        data: {
          status: 'APPROVED',
          reviewedById: actor.id,
          reviewedByName: actor.legalName,
          reviewNote: reviewNote || 'Approved by HR',
          reviewedAt: new Date(),
        },
        include: {
          employee: { select: { id: true, legalName: true } },
        },
      });

      // Update employee status to ON_LEAVE
      await prisma.employee.update({
        where: { id: updated.employeeId },
        data: { status: 'ON_LEAVE' },
      });

      // Notify employee
      await prisma.systemNotification.create({
        data: {
          employeeId: updated.employeeId,
          kind: 'ALERT',
          title: 'Leave Request Approved',
          body: `Your leave request for ${updated.startDate} to ${updated.endDate} has been approved by HR.`,
          linkUrl: '/dashboard',
        },
      });

      return NextResponse.json({ success: true, leave: updated });
    }

    if (action === 'REJECT') {
      if (!leaveId) {
        return NextResponse.json({ error: 'Missing leaveId' }, { status: 400 });
      }

      const updated = await prisma.leaveRequest.update({
        where: { id: leaveId },
        data: {
          status: 'REJECTED',
          reviewedById: actor.id,
          reviewedByName: actor.legalName,
          reviewNote: reviewNote || 'Not approved at this time',
          reviewedAt: new Date(),
        },
      });

      await prisma.systemNotification.create({
        data: {
          employeeId: updated.employeeId,
          kind: 'ALERT',
          title: 'Leave Request Status',
          body: `Your leave request was not approved: ${reviewNote || 'Please contact HR for details.'}`,
          linkUrl: '/dashboard',
        },
      });

      return NextResponse.json({ success: true, leave: updated });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('HR Leave Action Error:', error);
    return NextResponse.json({ error: 'Failed to process leave action' }, { status: 500 });
  }
}
