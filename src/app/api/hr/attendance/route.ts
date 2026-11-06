import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, getHrAuthorizationScope } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  LifecycleAuthorizationError,
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
    const dateParam = searchParams.get('date');
    const monthParam = searchParams.get('month'); // YYYY-MM
    const statusParam = searchParams.get('status');

    // Default to today in Africa/Lagos
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    const workDate = dateParam || (monthParam ? undefined : todayStr);

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

    if (workDate) {
      whereClause.workDate = workDate;
    } else if (monthParam) {
      whereClause.workDate = {
        startsWith: monthParam,
      };
    }

    if (statusParam && statusParam !== 'ALL') {
      whereClause.status = statusParam;
    }

    const records = await prisma.attendanceRecord.findMany({
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
                subsidiary: { select: { id: true, legalName: true, code: true, brandColor: true } },
                department: { select: { id: true, name: true } },
              },
            },
          },
        },
        station: {
          select: {
            id: true,
            name: true,
            radiusMeters: true,
          },
        },
      },
      orderBy: [{ workDate: 'desc' }, { checkInTime: 'desc' }],
      take: 300,
    });

    const serializedRecords = records.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employee.legalName,
      employeeNumber: r.employee.employeeNumber,
      avatarUrl: r.employee.avatarUrl,
      jobTitle: r.employee.jobTitle,
      subsidiary: r.employee.assignments[0]?.subsidiary || null,
      department: r.employee.assignments[0]?.department?.name || 'General',
      workDate: r.workDate,
      checkInTime: r.checkInTime,
      checkInLat: r.checkInLat,
      checkInLng: r.checkInLng,
      checkInDistanceM: r.checkInDistanceM,
      clientIp: r.clientIp,
      checkOutTime: r.checkOutTime,
      checkOutDistanceM: r.checkOutDistanceM,
      status: r.status,
      isManualOverride: r.isManualOverride,
      overrideReason: r.overrideReason,
      isDeductionApplied: r.isDeductionApplied,
      deductionPercent: r.deductionPercent,
      deductionMinor: r.deductionMinor.toString(),
      excuseStatus: r.excuseStatus,
      excuseRequestNote: r.excuseRequestNote,
      excuseRequestedByName: r.excuseRequestedByName,
      stationName: r.station?.name || 'HQ Primary',
    }));

    return NextResponse.json({
      success: true,
      selectedDate: workDate || monthParam,
      records: serializedRecords,
    });
  } catch (error) {
    console.error('HR Attendance API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch attendance records' }, { status: 500 });
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
    const { action, attendanceRecordId } = body;

    if (action === 'SUBMIT_EXCUSE_REQUEST') {
      const { excuseNote } = body;
      if (!attendanceRecordId || !excuseNote) {
        return NextResponse.json({ error: 'Missing record id or excuse note' }, { status: 400 });
      }

      const existingRecord = await prisma.attendanceRecord.findUnique({
        where: { id: attendanceRecordId },
        select: { id: true, employeeId: true },
      });
      if (!existingRecord) {
        return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
      }

      await verifyTargetEmployeeAccess(actor, existingRecord.employeeId, { allowExecutiveTarget: false });

      const updated = await prisma.attendanceRecord.update({
        where: { id: attendanceRecordId },
        data: {
          excuseStatus: 'PENDING_GMD_APPROVAL',
          excuseRequestNote: excuseNote,
          excuseRequestedByName: actor.legalName,
        },
        include: {
          employee: { select: { legalName: true } },
        },
      });

      // Notify GMD and Super Admins
      const gmdsAndAdmins = await prisma.employee.findMany({
        where: {
          role: { in: ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'] },
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      if (gmdsAndAdmins.length > 0) {
        await prisma.systemNotification.createMany({
          data: gmdsAndAdmins.map((adm) => ({
            employeeId: adm.id,
            kind: 'ALERT',
            title: `Lateness Excuse Request: ${updated.employee.legalName}`,
            body: `HR requested lateness penalty waiver for ${updated.workDate}: "${excuseNote}"`,
            linkUrl: '/gmd',
          })),
        });
      }

      return NextResponse.json({ success: true, record: updated });
    }

    if (action === 'MANUAL_OVERRIDE') {
      const { newStatus, reason, targetEmployeeId, targetDate } = body;
      const empId = attendanceRecordId ? undefined : targetEmployeeId;
      const dateStr = attendanceRecordId ? undefined : targetDate;

      if (!['PRESENT', 'LATE', 'HALF_DAY', 'EXCUSED', 'ABSENT'].includes(newStatus)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }

      let updatedRecord;

      if (attendanceRecordId) {
        const existingRecord = await prisma.attendanceRecord.findUnique({
          where: { id: attendanceRecordId },
          select: { id: true, employeeId: true },
        });
        if (!existingRecord) {
          return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
        }

        await verifyTargetEmployeeAccess(actor, existingRecord.employeeId, { allowExecutiveTarget: false });

        updatedRecord = await prisma.attendanceRecord.update({
          where: { id: attendanceRecordId },
          data: {
            status: newStatus,
            isManualOverride: true,
            overrideReason: reason || 'Manual HR correction',
            overrideById: actor.id,
          },
        });
      } else {
        if (!empId || !dateStr) {
          return NextResponse.json({ error: 'Missing employee or date for manual punch' }, { status: 400 });
        }

        await verifyTargetEmployeeAccess(actor, empId, { allowExecutiveTarget: false });

        updatedRecord = await prisma.attendanceRecord.upsert({
          where: {
            employeeId_workDate: {
              employeeId: empId,
              workDate: dateStr,
            },
          },
          update: {
            status: newStatus,
            isManualOverride: true,
            overrideReason: reason || 'Manual HR entry',
            overrideById: actor.id,
          },
          create: {
            employeeId: empId,
            workDate: dateStr,
            status: newStatus,
            checkInTime: new Date(),
            isManualOverride: true,
            overrideReason: reason || 'Manual HR entry',
            overrideById: actor.id,
          },
        });
      }

      return NextResponse.json({ success: true, record: updatedRecord });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    if (error instanceof LifecycleAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('HR Attendance Action Error:', error);
    return NextResponse.json({ error: 'Failed to record attendance action' }, { status: 500 });
  }
}
