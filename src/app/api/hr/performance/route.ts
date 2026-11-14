import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveHrContext, logHrAudit, canUseSubFilter } from '@/lib/hrRouteHelper';

export async function GET(req: Request) {
  try {
    const ctx = await resolveHrContext(req);
    if ('error' in ctx) return ctx.error;
    const { orgWhere, allowedSubIds, useSubFilter } = ctx;

    const [kpis, cycles, evaluations, pips, staffOptions] = await Promise.all([
      prisma.kpiDefinition.findMany({
        where: orgWhere,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { id: true, legalName: true } },
          organization: { select: { id: true, legalName: true, code: true } },
        },
      }),
      prisma.performanceReviewCycle.findMany({
        where: orgWhere,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.performanceEvaluation.findMany({
        where: useSubFilter ? { cycle: { organizationId: { in: allowedSubIds } } } : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          cycle: { select: { id: true, title: true } },
          employee: { select: { id: true, employeeNumber: true, legalName: true } },
          reviewer: { select: { id: true, legalName: true } },
        },
      }),
      prisma.performanceImprovementPlan.findMany({
        where: orgWhere,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { id: true, employeeNumber: true, legalName: true } },
          supervisor: { select: { id: true, legalName: true } },
        },
      }),
      prisma.employee.findMany({
        where: {
          role: 'STAFF',
          status: 'ACTIVE',
          ...(useSubFilter
            ? { assignments: { some: { subsidiaryId: { in: allowedSubIds }, status: 'ACTIVE' } } }
            : {}),
        },
        orderBy: { legalName: 'asc' },
        select: {
          id: true,
          employeeNumber: true,
          legalName: true,
          jobTitle: true,
          resumptionDate: true,
          isAttendanceExempt: true,
          assignments: {
            where: { status: 'ACTIVE' },
            select: {
              subsidiaryId: true,
              subsidiary: { select: { legalName: true } },
              department: { select: { name: true } },
            },
            take: 1,
          },
          attendanceRecords: {
            select: { status: true },
            orderBy: { workDate: 'desc' },
            take: 30,
          },
          trainingAssignments: {
            select: { status: true },
          },
          disciplinaryCases: {
            where: { step: { not: 'CLOSED' } },
            select: { id: true },
          },
        },
      }),
    ]);

    const nowMs = Date.now();
    const staffScorecards = staffOptions.map((s) => {
      const totalPunches = s.attendanceRecords.length;
      const presentCount = s.attendanceRecords.filter((a) => a.status === 'PRESENT' || a.status === 'EXCUSED').length;
      const lateCount = s.attendanceRecords.filter((a) => a.status === 'LATE').length;
      const punctualityPct = s.isAttendanceExempt
        ? 100
        : totalPunches > 0
          ? Math.round((presentCount / totalPunches) * 100)
          : 100;

      const totalTrainings = s.trainingAssignments.length;
      const completedTrainings = s.trainingAssignments.filter((t) => t.status === 'COMPLETED').length;
      const trainingPct = totalTrainings > 0 ? Math.round((completedTrainings / totalTrainings) * 100) : 100;

      const openDisciplinary = s.disciplinaryCases.length;
      const compliancePct = openDisciplinary === 0 ? 100 : Math.max(40, 100 - openDisciplinary * 25);

      const compositeScore = Math.round(punctualityPct * 0.45 + trainingPct * 0.25 + compliancePct * 0.30);

      let probationStatus: 'CONFIRMED' | 'PROBATION' | 'DUE_CONFIRMATION' = 'CONFIRMED';
      let daysSinceResumption = 0;
      let probationDaysLeft = 0;
      if (s.resumptionDate) {
        daysSinceResumption = Math.max(0, Math.floor((nowMs - new Date(s.resumptionDate).getTime()) / (1000 * 60 * 60 * 24)));
        if (daysSinceResumption < 90) {
          probationDaysLeft = 90 - daysSinceResumption;
          probationStatus = probationDaysLeft <= 14 ? 'DUE_CONFIRMATION' : 'PROBATION';
        }
      }

      return {
        id: s.id,
        employeeNumber: s.employeeNumber,
        legalName: s.legalName,
        jobTitle: s.jobTitle || 'Staff',
        subsidiary: s.assignments[0]?.subsidiary?.legalName || 'BEMS Group',
        department: s.assignments[0]?.department?.name || 'General',
        resumptionDate: s.resumptionDate,
        totalPunches,
        lateCount,
        punctualityPct,
        totalTrainings,
        completedTrainings,
        trainingPct,
        openDisciplinary,
        compositeScore,
        probationStatus,
        daysSinceResumption,
        probationDaysLeft,
      };
    });

    return NextResponse.json({
      success: true,
      kpis,
      cycles,
      evaluations,
      pips,
      staffOptions,
      staffScorecards,
    });
  } catch (error) {
    console.error('HR Performance GET error:', error);
    return NextResponse.json({ error: 'Failed to load performance data' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveHrContext(req);
    if ('error' in ctx) return ctx.error;
    const { actor, hrScope, defaultOrgId } = ctx;

    const body = await req.json();
    const action = String(body.action || '');

    if (action === 'CREATE_KPI') {
      const title = String(body.title || '').trim();
      const targetMetric = String(body.targetMetric || '').trim();
      const weightPercent = Math.min(100, Math.max(1, Number(body.weightPercent || 25)));
      const reviewPeriod = String(body.reviewPeriod || 'QUARTERLY');
      const employeeId = body.employeeId ? String(body.employeeId) : null;
      const organizationId = String(body.organizationId || defaultOrgId);

      if (!title || !targetMetric) {
        return NextResponse.json({ error: 'KPI title and target metric are required.' }, { status: 400 });
      }
      if (!canUseSubFilter(hrScope, organizationId)) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
      }

      const kpi = await prisma.kpiDefinition.create({
        data: { organizationId, employeeId, title, targetMetric, weightPercent, reviewPeriod },
      });
      return NextResponse.json({ success: true, kpi });
    }

    if (action === 'CREATE_CYCLE') {
      const title = String(body.title || '').trim();
      const cycleType = String(body.cycleType || 'QUARTERLY');
      const startDate = String(body.startDate || '');
      const endDate = String(body.endDate || '');
      const organizationId = String(body.organizationId || defaultOrgId);

      if (!title || !startDate || !endDate) {
        return NextResponse.json({ error: 'Cycle title, start date, and end date are required.' }, { status: 400 });
      }
      if (!canUseSubFilter(hrScope, organizationId)) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
      }

      const cycle = await prisma.performanceReviewCycle.create({
        data: { organizationId, title, cycleType, startDate, endDate, status: 'ACTIVE' },
      });
      return NextResponse.json({ success: true, cycle });
    }

    if (action === 'SUBMIT_EVALUATION') {
      const cycleId = String(body.cycleId || '');
      const employeeId = String(body.employeeId || '');
      const overallScore = Math.min(100, Math.max(0, Number(body.overallScore || 0)));
      const reviewerSummary = String(body.reviewerSummary || '').trim();
      const pipRequired = Boolean(body.pipRequired);

      if (!cycleId || !employeeId) {
        return NextResponse.json({ error: 'Review cycle and employee are required.' }, { status: 400 });
      }

      const evaluation = await prisma.performanceEvaluation.create({
        data: {
          cycleId,
          employeeId,
          reviewerId: actor.id,
          overallScore,
          kpiScoresJson: JSON.stringify(body.kpiScores || []),
          reviewerSummary,
          pipRequired,
          status: 'SUBMITTED',
        },
      });

      await logHrAudit({
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: defaultOrgId,
        targetType: 'PERFORMANCE',
        targetId: evaluation.id,
        action: 'CREATED',
        metadata: { overallScore, pipRequired },
      });

      return NextResponse.json({ success: true, evaluation });
    }

    if (action === 'CREATE_PIP') {
      const employeeId = String(body.employeeId || '');
      const startDate = String(body.startDate || '');
      const endDate = String(body.endDate || '');
      const goalsSummary = String(body.goalsSummary || '').trim();
      const organizationId = String(body.organizationId || defaultOrgId);

      if (!employeeId || !startDate || !endDate || !goalsSummary) {
        return NextResponse.json({ error: 'All PIP fields are required.' }, { status: 400 });
      }
      const pip = await prisma.performanceImprovementPlan.create({
        data: {
          organizationId,
          employeeId,
          supervisorId: actor.id,
          startDate,
          endDate,
          goalsSummary,
          status: 'ACTIVE',
        },
      });
      return NextResponse.json({ success: true, pip });
    }

    if (action === 'SEED_STANDARD_KPIS') {
      const organizationId = String(body.organizationId || defaultOrgId);
      const defaults = [
        { title: 'Attendance & Punctuality', targetMetric: '≥ 95% On-Time Check-ins', weightPercent: 25, reviewPeriod: 'MONTHLY' },
        { title: 'Operational Delivery & SLA', targetMetric: '≥ 90% Tasks Delivered on Schedule', weightPercent: 35, reviewPeriod: 'QUARTERLY' },
        { title: 'Policy & Governance Compliance', targetMetric: 'Zero Open Disciplinary Queries', weightPercent: 20, reviewPeriod: 'QUARTERLY' },
        { title: 'Learning & Skill Development', targetMetric: '100% Mandatory Trainings Completed', weightPercent: 20, reviewPeriod: 'QUARTERLY' },
      ];
      await prisma.kpiDefinition.createMany({
        data: defaults.map((d) => ({ ...d, organizationId })),
      });
      await logHrAudit({
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: defaultOrgId || organizationId,
        subsidiaryId: organizationId,
        targetType: 'KPI_DEFINITION',
        targetId: organizationId,
        action: 'KPI_STANDARDS_SEEDED',
        metadata: { count: defaults.length },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported performance action.' }, { status: 400 });
  } catch (error) {
    console.error('HR Performance POST error:', error);
    return NextResponse.json({ error: 'Failed to process performance action' }, { status: 500 });
  }
}

