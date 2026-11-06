import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticateAiToolRequest } from '@/lib/ai-tools-auth';
import { getLagosTime } from '@/lib/attendance/token';
import { stageAction } from '@/lib/staged-actions';
import { checkAiScopeOrResponse } from '@/lib/ai-access-control';

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
  const targetScope =
    action === 'UPDATE_POLICY' || action === 'UPDATE_ROSTER' || action === 'CALIBRATE_STATION'
      ? 'attendance_policy'
      : 'attendance_logs';
  const scopeBlocked = await checkAiScopeOrResponse(targetScope, 'write');
  if (scopeBlocked) return scopeBlocked;
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

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'attendance_override',
      summary: `Override attendance for ${employee.legalName} (${employee.employeeNumber}) on ${workDate} to ${targetStatus} (${deductionPercent}% penalty)`,
      materialPayload: {
        action_type: 'EXCUSE_OVERRIDE',
        employee_id: employee.id,
        work_date: workDate,
        override_status: targetStatus,
        deduction_percent: deductionPercent,
        reason,
      },
      preview: {
        action: 'EXCUSE_OVERRIDE',
        employee: employee.legalName,
        employeeNumber: employee.employeeNumber,
        workDate,
        status: targetStatus,
        deductionPercent,
        reason,
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      action: 'EXCUSE_OVERRIDE',
      message: `Attendance override for ${employee.legalName} on ${workDate} has been staged. Click the confirmation button to commit.`,
      staged_action_id: staged.staged_action_id,
      confirmation_hash: staged.confirmation_hash,
      confirmation_button: staged.confirmation_button,
      staged_action: staged.staged_action,
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

    const subAction = isClockOut ? 'CLOCK_OUT' : 'CLOCK_IN';
    const staged = await stageAction({
      userId: actor.id,
      actionType: 'attendance_override',
      summary: `Manual ${isClockOut ? 'Clock-Out' : 'Clock-In'} for ${employee.legalName} (${employee.employeeNumber}) on ${workDate}`,
      materialPayload: {
        action_type: subAction,
        employee_id: employee.id,
        work_date: workDate,
        station_name: stationName,
      },
      preview: {
        action: subAction,
        employee: employee.legalName,
        employeeNumber: employee.employeeNumber,
        workDate,
        stationName,
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      action: subAction,
      message: `Manual ${isClockOut ? 'clock-out' : 'clock-in'} for ${employee.legalName} has been staged. Click the confirmation button to commit.`,
      staged_action_id: staged.staged_action_id,
      confirmation_hash: staged.confirmation_hash,
      confirmation_button: staged.confirmation_button,
      staged_action: staged.staged_action,
    });
  }

  // -------------------------------------------------------------
  // ACTION 3: UPDATE ATTENDANCE POLICY & SECURITY LOCKS
  // -------------------------------------------------------------
  if (
    action === 'UPDATE_POLICY' ||
    action === 'TOGGLE_STARLINK_LOCK' ||
    action === 'TOGGLE_GEOFENCE_LOCK' ||
    action === 'TOGGLE_POWER_OUTAGE'
  ) {
    const updateData: any = {};
    if (body.latenessDeductionPercent !== undefined) updateData.latenessDeductionPercent = Number(body.latenessDeductionPercent);
    if (body.absenceDeductionPercent !== undefined) updateData.absenceDeductionPercent = Number(body.absenceDeductionPercent);
    if (body.gracePeriodMinutes !== undefined) updateData.gracePeriodMinutes = Number(body.gracePeriodMinutes);
    if (body.earliestCheckInTime) updateData.earliestCheckInTime = String(body.earliestCheckInTime);
    if (body.resumptionTime) updateData.resumptionTime = String(body.resumptionTime);
    if (body.closingTime) updateData.closingTime = String(body.closingTime);
    if (body.requireStarlinkIp !== undefined) updateData.requireStarlinkIp = Boolean(body.requireStarlinkIp);
    if (body.starlinkPowerOutageMode !== undefined) updateData.starlinkPowerOutageMode = Boolean(body.starlinkPowerOutageMode);
    if (body.requireGeofence !== undefined) updateData.requireGeofence = Boolean(body.requireGeofence);
    if (body.requireQrScan !== undefined) updateData.requireQrScan = Boolean(body.requireQrScan);
    if (body.radiusMeters !== undefined) updateData.radiusMeters = Number(body.radiusMeters);
    if (body.starlinkIpAddresses !== undefined) updateData.starlinkIpAddresses = String(body.starlinkIpAddresses);

    const summary =
      action === 'TOGGLE_STARLINK_LOCK'
        ? `Toggle Starlink Wi-Fi Network Lock (${updateData.requireStarlinkIp === false ? 'Bypass / Allow Any Network' : 'Enforce Strict Starlink Wi-Fi'})`
        : action === 'TOGGLE_GEOFENCE_LOCK'
        ? `Toggle GPS Geofence Lock (${updateData.requireGeofence === false ? 'Bypass / Allow Any Location' : 'Enforce Strict GPS Perimeter'})`
        : action === 'TOGGLE_POWER_OUTAGE'
        ? `Toggle Starlink Power Outage Mode`
        : `Update Conglomerate Attendance Policy (${Object.keys(updateData).join(', ') || 'policy parameters'})`;

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'attendance_override',
      summary,
      materialPayload: {
        action_type: action,
        ...updateData,
      },
      preview: {
        action,
        ...updateData,
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      action,
      message: `${summary} has been staged. Click the confirmation button to apply across entities.`,
      staged_action_id: staged.staged_action_id,
      confirmation_hash: staged.confirmation_hash,
      confirmation_button: staged.confirmation_button,
      staged_action: staged.staged_action,
    });
  }

  // -------------------------------------------------------------
  // ACTION 4: UPDATE STAFF WORK SCHEDULE / WEEKLY OFF-DAYS ROSTER
  // -------------------------------------------------------------
  if (action === 'UPDATE_ROSTER' || action === 'SET_SCHEDULE') {
    const employeeLookup = String(body.employeeId || body.employeeNumber || body.name || '').trim();
    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          { id: employeeLookup },
          { employeeNumber: { equals: employeeLookup, mode: 'insensitive' } },
          { legalName: { contains: employeeLookup, mode: 'insensitive' } },
        ],
      },
    });
    if (!employee) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Employee "${employeeLookup}" not found.` }, { status: 404 });
    }

    const weeklyOffDays = String(body.weeklyOffDays ?? '0,6');
    const customShiftIn = String(body.customShiftIn || '08:00');
    const customShiftOut = String(body.customShiftOut || '17:00');
    const isExempt = Boolean(body.isExempt ?? false);

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'attendance_override',
      summary: `Update Work Schedule Roster for ${employee.legalName} (${customShiftIn}–${customShiftOut}, Off-days: ${weeklyOffDays})`,
      materialPayload: {
        action_type: 'UPDATE_ROSTER',
        employeeId: employee.id,
        weeklyOffDays,
        customShiftIn,
        customShiftOut,
        isExempt,
        notes: body.notes || null,
      },
      preview: {
        action: 'UPDATE_ROSTER',
        employee: `${employee.legalName} (${employee.employeeNumber})`,
        shift_window: `${customShiftIn} – ${customShiftOut}`,
        weekly_off_days: weeklyOffDays,
        attendance_exempt: isExempt ? 'YES' : 'NO',
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      action: 'UPDATE_ROSTER',
      message: `Work schedule update for ${employee.legalName} has been staged. Click Confirm to apply.`,
      ...staged,
    });
  }

  // -------------------------------------------------------------
  // ACTION 5: CALIBRATE ATTENDANCE KIOSK STATION GPS & PERIMETER
  // -------------------------------------------------------------
  if (action === 'CALIBRATE_STATION' || action === 'UPDATE_STATION') {
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const radiusMeters = Number(body.radiusMeters ?? 100);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return NextResponse.json(
        { ok: false, error_code: 'INVALID_COORDINATES', message: 'Valid latitude and longitude are required to calibrate station.' },
        { status: 400 }
      );
    }

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'attendance_override',
      summary: `Calibrate Attendance Station GPS to [${latitude.toFixed(5)}, ${longitude.toFixed(5)}] (${radiusMeters}m radius)`,
      materialPayload: {
        action_type: 'CALIBRATE_STATION',
        name: body.name || 'BEMS Group Corporate Headquarters',
        latitude,
        longitude,
        radiusMeters,
      },
      preview: {
        action: 'CALIBRATE_STATION',
        station_name: body.name || 'BEMS Group Corporate Headquarters',
        coordinates: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        radius_meters: `${radiusMeters}m`,
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      action: 'CALIBRATE_STATION',
      message: `Station GPS calibration has been staged. Click Confirm to update office perimeter.`,
      ...staged,
    });
  }

  return NextResponse.json(
    { ok: false, error_code: 'INVALID_ACTION', message: 'Action must be EXCUSE_OVERRIDE, CLOCK_IN, or UPDATE_POLICY.' },
    { status: 400 }
  );
}

