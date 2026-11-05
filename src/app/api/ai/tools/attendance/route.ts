import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { getLagosTime } from '@/lib/attendance/token';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;

  if (!actor?.isExecutive) {
    return NextResponse.json(
      { ok: false, error_code: 'FORBIDDEN', message: 'Executive access required to query attendance roster.' },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const { workDate: todayStr } = getLagosTime();
  const dateParam = url.searchParams.get('date') || todayStr;
  const subsidiaryId = url.searchParams.get('subsidiaryId');

  // Forward to daily roster logic or fetch directly
  const rosterUrl = new URL(`/api/attendance/admin/daily-roster?date=${dateParam}${subsidiaryId ? `&subsidiaryId=${subsidiaryId}` : ''}`, req.url);
  const rosterRes = await fetch(rosterUrl.toString(), {
    headers: {
      Authorization: req.headers.get('authorization') || '',
      'x-api-key': req.headers.get('x-api-key') || '',
      cookie: req.headers.get('cookie') || '',
    },
  });

  const data = await rosterRes.json();
  return NextResponse.json({
    ok: rosterRes.ok,
    date: dateParam,
    ...data,
  }, { status: rosterRes.status });
}

export async function POST(req: NextRequest) {
  const { actor, errorResponse } = await authenticateAiToolRequest(req);
  if (errorResponse) return errorResponse;

  if (!actor?.isExecutive) {
    return NextResponse.json(
      { ok: false, error_code: 'FORBIDDEN', message: 'Executive authority required to execute attendance actions.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const action = (body.action || 'EXCUSE_OVERRIDE').toUpperCase().trim();
  const { workDate: todayStr } = getLagosTime();

  // -------------------------------------------------------------
  // ACTION 1: EXCUSE / OVERRIDE ATTENDANCE PENALTY
  // -------------------------------------------------------------
  if (action === 'EXCUSE_OVERRIDE' || action === 'EXCUSE' || action === 'OVERRIDE') {
    const employeeIdentifier = (body.employeeId || body.employeeNumber || body.name || body.email || '').trim();
    const workDate = (body.workDate || body.date || todayStr).trim();
    const targetStatus = (body.status || 'PRESENT').toUpperCase().trim(); // PRESENT | EXCUSED
    const reason = (body.reason || body.note || 'Excused via AI Copilot Automation').trim();
    const deductionPercent = Number(body.deductionPercent ?? 0.0);

    if (!employeeIdentifier) {
      return NextResponse.json(
        { ok: false, error_code: 'VALIDATION_FAILED', message: 'Employee identifier is required.' },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { id: employeeIdentifier },
          { employeeNumber: employeeIdentifier },
          { workEmail: { equals: employeeIdentifier, mode: 'insensitive' } },
          { legalName: { contains: employeeIdentifier, mode: 'insensitive' } },
        ],
      },
    });

    if (!employee) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_FOUND', message: `Employee "${employeeIdentifier}" not found.` },
        { status: 404 }
      );
    }

    const record = await prisma.attendanceRecord.upsert({
      where: {
        employeeId_workDate: {
          employeeId: employee.id,
          workDate,
        },
      },
      update: {
        status: targetStatus,
        isManualOverride: true,
        overrideReason: reason,
        overrideById: actor.id,
        isDeductionApplied: deductionPercent > 0,
        deductionPercent,
        excuseStatus: 'APPROVED',
      },
      create: {
        employeeId: employee.id,
        workDate,
        status: targetStatus,
        checkInTime: new Date(),
        isManualOverride: true,
        overrideReason: reason,
        overrideById: actor.id,
        isDeductionApplied: deductionPercent > 0,
        deductionPercent,
        excuseStatus: 'APPROVED',
      },
    });

    return NextResponse.json({
      ok: true,
      action: 'EXCUSE_OVERRIDE',
      message: `Attendance for ${employee.legalName} on ${workDate} overridden to ${targetStatus} with ${deductionPercent}% penalty.`,
      record: {
        id: record.id,
        employee: employee.legalName,
        employeeNumber: employee.employeeNumber,
        workDate: record.workDate,
        status: record.status,
        deductionPercent: record.deductionPercent,
        reason: record.overrideReason,
        overrideBy: actor.legalName,
      },
    });
  }

  // -------------------------------------------------------------
  // ACTION 2: CLOCK IN / OUT STAFF MANUALLY
  // -------------------------------------------------------------
  if (action === 'CLOCK_IN' || action === 'CHECK_IN' || action === 'CLOCK_OUT' || action === 'CHECK_OUT') {
    const isClockOut = action === 'CLOCK_OUT' || action === 'CHECK_OUT';
    const employeeIdentifier = (body.employeeId || body.employeeNumber || body.name || '').trim();
    const workDate = (body.workDate || todayStr).trim();
    const stationName = (body.stationName || 'HQ Kiosk / AI Station').trim();

    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { id: employeeIdentifier },
          { employeeNumber: employeeIdentifier },
          { legalName: { contains: employeeIdentifier, mode: 'insensitive' } },
        ],
      },
    });

    if (!employee) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_FOUND', message: `Employee "${employeeIdentifier}" not found.` },
        { status: 404 }
      );
    }

    const now = new Date();
    let record;

    if (isClockOut) {
      record = await prisma.attendanceRecord.upsert({
        where: { employeeId_workDate: { employeeId: employee.id, workDate } },
        update: { checkOutTime: now },
        create: {
          employeeId: employee.id,
          workDate,
          status: 'PRESENT',
          checkInTime: now,
          checkOutTime: now,
        },
      });
    } else {
      record = await prisma.attendanceRecord.upsert({
        where: { employeeId_workDate: { employeeId: employee.id, workDate } },
        update: { checkInTime: now, status: 'PRESENT' },
        create: {
          employeeId: employee.id,
          workDate,
          status: 'PRESENT',
          checkInTime: now,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      action: isClockOut ? 'CLOCK_OUT' : 'CLOCK_IN',
      message: `${isClockOut ? 'Clock-out' : 'Clock-in'} recorded for ${employee.legalName} at ${now.toLocaleTimeString()}.`,
      record: {
        employee: employee.legalName,
        workDate,
        checkInTime: record.checkInTime,
        checkOutTime: record.checkOutTime,
      },
    });
  }

  // -------------------------------------------------------------
  // ACTION 3: UPDATE ATTENDANCE POLICY (Shift & Deductions)
  // -------------------------------------------------------------
  if (action === 'UPDATE_POLICY') {
    const latenessPercent = body.latenessDeductionPercent !== undefined ? Number(body.latenessDeductionPercent) : undefined;
    const graceMinutes = body.gracePeriodMinutes !== undefined ? Number(body.gracePeriodMinutes) : undefined;
    const resumption = body.resumptionTime ? String(body.resumptionTime) : undefined;
    const closing = body.closingTime ? String(body.closingTime) : undefined;

    const policies = await prisma.attendancePolicy.findMany();
    const updateData: any = { updatedAt: new Date() };
    if (latenessPercent !== undefined) updateData.latenessDeductionPercent = latenessPercent;
    if (graceMinutes !== undefined) updateData.gracePeriodMinutes = graceMinutes;
    if (resumption) updateData.resumptionTime = resumption;
    if (closing) updateData.closingTime = closing;

    await prisma.attendancePolicy.updateMany({
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      action: 'UPDATE_POLICY',
      message: 'Attendance policy updated across all conglomerate entities.',
      updatedSettings: updateData,
    });
  }

  return NextResponse.json(
    { ok: false, error_code: 'INVALID_ACTION', message: 'Action must be EXCUSE_OVERRIDE, CLOCK_IN, or UPDATE_POLICY.' },
    { status: 400 }
  );
}
