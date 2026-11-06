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
  if (
    action === 'EXCUSE_OVERRIDE' ||
    action === 'EXCUSE' ||
    action === 'OVERRIDE' ||
    action === 'WAIVE_DEDUCTION' ||
    action === 'APPLY_LATENESS_DEDUCTION' ||
    action === 'APPLY_ABSENCE_DEDUCTION' ||
    action === 'MARK_PRESENT'
  ) {
    const employeeIdentifier = (body.employeeId || body.employeeNumber || body.name || body.email || '').trim();
    const workDate = (body.workDate || body.date || todayStr).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
      return NextResponse.json(
        { ok: false, error_code: 'INVALID_WORK_DATE', message: 'workDate must be in YYYY-MM-DD format (Africa/Lagos).' },
        { status: 400 }
      );
    }

    if (!employeeIdentifier) {
      return NextResponse.json(
        { ok: false, error_code: 'VALIDATION_FAILED', message: 'Exact employee identifier is required.' },
        { status: 400 }
      );
    }

    const matches = await prisma.employee.findMany({
      where: {
        OR: [
          { id: employeeIdentifier },
          { employeeNumber: { equals: employeeIdentifier, mode: 'insensitive' } },
          { workEmail: { equals: employeeIdentifier, mode: 'insensitive' } },
          { legalName: { contains: employeeIdentifier, mode: 'insensitive' } },
        ],
      },
      include: {
        assignments: {
          where: { status: 'ACTIVE' },
          include: { subsidiary: true },
          orderBy: [{ isPrimary: 'desc' }, { startsOn: 'desc' }],
        },
        employmentAgreements: {
          where: { status: 'ACTIVE' },
          include: {
            compensations: {
              where: { effectiveTo: null },
              orderBy: { effectiveFrom: 'desc' },
              take: 1,
            },
          },
          orderBy: { startDate: 'desc' },
          take: 1,
        },
      },
      take: 5,
    });

    const exact = matches.find(
      (m) =>
        m.id === employeeIdentifier ||
        m.employeeNumber.toLowerCase() === employeeIdentifier.toLowerCase() ||
        m.workEmail?.toLowerCase() === employeeIdentifier.toLowerCase() ||
        m.legalName.toLowerCase() === employeeIdentifier.toLowerCase()
    );
    if (!exact && matches.length > 1) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'AMBIGUOUS_EMPLOYEE',
          message: `Multiple employees matched "${employeeIdentifier}": ${matches.map((m) => `${m.legalName} (${m.employeeNumber})`).join(', ')}.`,
        },
        { status: 409 }
      );
    }
    const employee = exact || matches[0];
    if (!employee) {
      return NextResponse.json(
        { ok: false, error_code: 'NOT_FOUND', message: `Employee "${employeeIdentifier}" not found.` },
        { status: 404 }
      );
    }

    const subsidiaryId = employee.assignments[0]?.subsidiaryId || employee.employmentAgreements[0]?.employerEntityId || null;
    const policy =
      (subsidiaryId
        ? await prisma.attendancePolicy.findUnique({ where: { organizationId: subsidiaryId } })
        : null) ||
      (await prisma.attendancePolicy.findFirst({ where: { organization: { type: 'GROUP' } } })) ||
      (await prisma.attendancePolicy.findFirst());

    let canonicalAction: string = action;
    let targetStatus = String(body.status || '').toUpperCase().trim();
    if (!targetStatus) {
      if (action === 'APPLY_LATENESS_DEDUCTION') targetStatus = 'LATE';
      else if (action === 'APPLY_ABSENCE_DEDUCTION') targetStatus = 'ABSENT';
      else if (action === 'EXCUSE' || action === 'WAIVE_DEDUCTION') targetStatus = 'EXCUSED';
      else targetStatus = 'PRESENT';
    }
    if (!['PRESENT', 'LATE', 'HALF_DAY', 'EXCUSED', 'ABSENT', 'ON_LEAVE'].includes(targetStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'INVALID_ATTENDANCE_STATUS',
          message: `Invalid attendance status "${targetStatus}". Must be PRESENT, LATE, HALF_DAY, EXCUSED, ABSENT, or ON_LEAVE.`,
        },
        { status: 400 }
      );
    }

    let deductionPercent: number;
    if (body.deductionPercent !== undefined && body.deductionPercent !== null && body.deductionPercent !== '') {
      deductionPercent = Number(body.deductionPercent);
    } else if (targetStatus === 'PRESENT' || targetStatus === 'EXCUSED' || targetStatus === 'ON_LEAVE' || action === 'WAIVE_DEDUCTION') {
      deductionPercent = 0.0;
    } else if (targetStatus === 'LATE' || action === 'APPLY_LATENESS_DEDUCTION') {
      deductionPercent = Number(policy?.latenessDeductionPercent ?? 5.0);
    } else if (targetStatus === 'HALF_DAY') {
      deductionPercent = 50.0;
    } else if (targetStatus === 'ABSENT' || action === 'APPLY_ABSENCE_DEDUCTION') {
      deductionPercent = Number(policy?.absenceDeductionPercent ?? 100.0);
    } else {
      deductionPercent = 0.0;
    }

    const activeComp = employee.employmentAgreements[0]?.compensations[0];
    const monthlyGrossMinor = Number(activeComp?.grossMinor ?? 0);
    const dailyWageMinor = monthlyGrossMinor > 0 ? Math.round(monthlyGrossMinor / 22) : 0;
    const deductionMinor = Math.round(dailyWageMinor * (deductionPercent / 100));
    const reason = (body.reason || body.note || '').trim();
    if (reason.length < 5) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'REASON_REQUIRED',
          message: 'A clear audit reason (at least 5 characters) is required for an attendance override.',
        },
        { status: 400 }
      );
    }

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'attendance_override',
      targetEmployeeId: employee.id,
      targetSubsidiaryId: subsidiaryId || undefined,
      summary: `Override attendance for ${employee.legalName} (${employee.employeeNumber}) on ${workDate} to ${targetStatus} (${deductionPercent}% penalty — ₦${(deductionMinor / 100).toLocaleString()} payroll impact)`,
      materialPayload: {
        action_type: canonicalAction === 'OVERRIDE' || canonicalAction === 'EXCUSE' ? 'EXCUSE_OVERRIDE' : canonicalAction,
        employee_id: employee.id,
        subsidiary_id: subsidiaryId,
        work_date: workDate,
        override_status: targetStatus,
        deduction_percent: deductionPercent,
        deduction_minor: deductionMinor,
        reason,
      },
      preview: {
        action: canonicalAction === 'OVERRIDE' || canonicalAction === 'EXCUSE' ? 'EXCUSE_OVERRIDE' : canonicalAction,
        employee: employee.legalName,
        employeeNumber: employee.employeeNumber,
        subsidiary: employee.assignments[0]?.subsidiary?.legalName || 'BEMS Group',
        workDate,
        status: targetStatus,
        deductionPercent,
        deductionMinor,
        payrollImpactFormatted: `₦${(deductionMinor / 100).toLocaleString()} (${deductionPercent}% of daily gross ₦${(dailyWageMinor / 100).toLocaleString()})`,
        reason,
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      action: 'EXCUSE_OVERRIDE',
      message: `Attendance override for ${employee.legalName} on ${workDate} has been staged (Payroll impact: ₦${(deductionMinor / 100).toLocaleString()}). Click the confirmation button to commit.`,
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
    const orgIdentifier = String(
      body.organizationId || body.subsidiaryId || body.organization || body.subsidiary || ''
    ).trim();
    const rawScope = String(body.scope || (orgIdentifier ? 'SUBSIDIARY' : 'GROUP')).toUpperCase().trim();

    let resolvedOrg: { id: string; legalName: string; code: string; type: string } | null = null;
    if (orgIdentifier && orgIdentifier.toUpperCase() !== 'ALL' && orgIdentifier.toUpperCase() !== 'GROUP') {
      const orgMatches = await prisma.organization.findMany({
        where: {
          OR: [
            { id: orgIdentifier },
            { code: { equals: orgIdentifier, mode: 'insensitive' } },
            { legalName: { contains: orgIdentifier, mode: 'insensitive' } },
          ],
        },
        select: { id: true, legalName: true, code: true, type: true },
      });
      const exactOrg = orgMatches.find(
        (o) =>
          o.id === orgIdentifier ||
          o.code.toLowerCase() === orgIdentifier.toLowerCase() ||
          o.legalName.toLowerCase() === orgIdentifier.toLowerCase()
      );
      if (!exactOrg && orgMatches.length !== 1) {
        return NextResponse.json(
          {
            ok: false,
            error_code: orgMatches.length > 1 ? 'AMBIGUOUS_ORGANIZATION' : 'ORGANIZATION_NOT_FOUND',
            message:
              orgMatches.length > 1
                ? `Multiple organizations matched "${orgIdentifier}". Specify the exact subsidiary.`
                : `Organization "${orgIdentifier}" not found.`,
          },
          { status: orgMatches.length > 1 ? 409 : 404 }
        );
      }
      resolvedOrg = exactOrg || orgMatches[0];
    }

    const effectiveScope = resolvedOrg && rawScope !== 'GROUP' ? 'SUBSIDIARY' : 'GROUP';

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

    const targetLabel = resolvedOrg ? resolvedOrg.legalName : 'Conglomerate (Group-Wide)';
    const summary =
      action === 'TOGGLE_STARLINK_LOCK'
        ? `Toggle Starlink Wi-Fi Network Lock for ${targetLabel} (${updateData.requireStarlinkIp === false ? 'Bypass / Allow Any Network' : 'Enforce Strict Starlink Wi-Fi'})`
        : action === 'TOGGLE_GEOFENCE_LOCK'
        ? `Toggle GPS Geofence Lock for ${targetLabel} (${updateData.requireGeofence === false ? 'Bypass / Allow Any Location' : 'Enforce Strict GPS Perimeter'})`
        : action === 'TOGGLE_POWER_OUTAGE'
        ? `Toggle Starlink Power Outage Mode for ${targetLabel}`
        : `Update Attendance Policy for ${targetLabel} (${Object.keys(updateData).join(', ') || 'policy parameters'})`;

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'attendance_override',
      targetSubsidiaryId: resolvedOrg?.id,
      summary,
      materialPayload: {
        action_type: action,
        scope: effectiveScope,
        organizationId: resolvedOrg?.id || null,
        ...updateData,
      },
      preview: {
        action,
        scope: effectiveScope,
        organization: targetLabel,
        ...updateData,
      },
    });

    return NextResponse.json({
      ok: true,
      status: 'AWAITING_CONFIRMATION',
      requires_gmd_action: true,
      action,
      message: `${summary} has been staged. Click the confirmation button to apply.`,
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

