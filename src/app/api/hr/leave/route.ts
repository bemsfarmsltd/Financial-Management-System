import { executeDashboardCommand } from '@/lib/staged-actions';
import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, getHrAuthorizationScope } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  LifecycleAuthorizationError,
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
    const status = searchParams.get('status');

    const whereClause: any = {
      employee: {
        role: 'STAFF',
        ...(hrScope.isGlobal
          ? {}
          : {
              assignments: {
                some: {
                  subsidiaryId: { in: hrScope.subsidiaryIds },
                  status: 'ACTIVE',
                },
              },
            }),
      },
    };
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
    if (!actor) return NextResponse.json({ error: 'Sign in to manage leave.' }, { status: 401 });
    const body = await req.json();
    const actions: Record<string, string> = { CREATE: 'CREATE_LEAVE', APPROVE: 'APPROVE_LEAVE', REJECT: 'REJECT_LEAVE' };
    const sub_action = actions[String(body.action || '').toUpperCase()];
    if (!sub_action) return NextResponse.json({ error: 'Unknown leave action.' }, { status: 400 });
    const leave = await executeDashboardCommand(actor, 'leave_action', { ...body, sub_action, rejectionReason: body.reviewNote });
    return NextResponse.json({ success: true, leave });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
