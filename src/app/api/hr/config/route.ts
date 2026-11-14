import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveHrContext, logHrAudit } from '@/lib/hrRouteHelper';

const POLICY_KEY = 'HR_STATUTORY_POLICY';
const GRANTS_KEY = 'HR_CAPABILITY_GRANTS';

const DEFAULT_STATUTORY_POLICY = {
  employerPensionRatePct: 10,
  employeePensionRatePct: 8,
  graceMinutes: 15,
  workStartTime: '08:00',
  workEndTime: '17:00',
  annualLeaveDays: 20,
  sickLeaveDays: 10,
  probationMonths: 3,
  ndpaRetentionYears: 6,
};

export async function GET(req: Request) {
  try {
    const ctx = await resolveHrContext(req);
    if ('error' in ctx) return ctx.error;
    const { defaultOrgId } = ctx;

    const [policyRow, grantsRow, adminStaff] = await Promise.all([
      prisma.workspaceSetting.findFirst({
        where: { key: POLICY_KEY, ...(defaultOrgId ? { organizationId: defaultOrgId } : {}) },
      }),
      prisma.workspaceSetting.findFirst({
        where: { key: GRANTS_KEY },
      }),
      prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { legalName: 'asc' },
        select: { id: true, employeeNumber: true, legalName: true, role: true, jobTitle: true },
        take: 100,
      }),
    ]);

    const policy = policyRow?.value
      ? { ...DEFAULT_STATUTORY_POLICY, ...JSON.parse(policyRow.value) }
      : DEFAULT_STATUTORY_POLICY;
    const capabilityGrants = grantsRow?.value ? JSON.parse(grantsRow.value) : {};

    return NextResponse.json({
      success: true,
      policy,
      capabilityGrants,
      employees: adminStaff,
    });
  } catch (error) {
    console.error('HR Config GET error:', error);
    return NextResponse.json({ error: 'Failed to load HR configuration' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveHrContext(req);
    if ('error' in ctx) return ctx.error;
    const { actor, defaultOrgId } = ctx;

    const body = await req.json();
    const action = String(body.action || '');

    if (!defaultOrgId) {
      return NextResponse.json({ error: 'No active organization found.' }, { status: 400 });
    }

    if (action === 'SAVE_POLICY') {
      const nextPolicy = {
        employerPensionRatePct: Number(body.policy?.employerPensionRatePct ?? 10),
        employeePensionRatePct: Number(body.policy?.employeePensionRatePct ?? 8),
        graceMinutes: Number(body.policy?.graceMinutes ?? 15),
        workStartTime: String(body.policy?.workStartTime || '08:00'),
        workEndTime: String(body.policy?.workEndTime || '17:00'),
        annualLeaveDays: Number(body.policy?.annualLeaveDays ?? 20),
        sickLeaveDays: Number(body.policy?.sickLeaveDays ?? 10),
        probationMonths: Number(body.policy?.probationMonths ?? 3),
        ndpaRetentionYears: Number(body.policy?.ndpaRetentionYears ?? 6),
      };

      const existing = await prisma.workspaceSetting.findFirst({
        where: { organizationId: defaultOrgId, key: POLICY_KEY },
      });

      if (existing) {
        await prisma.workspaceSetting.update({
          where: { id: existing.id },
          data: { value: JSON.stringify(nextPolicy), updatedById: actor.id },
        });
      } else {
        await prisma.workspaceSetting.create({
          data: { organizationId: defaultOrgId, key: POLICY_KEY, value: JSON.stringify(nextPolicy), updatedById: actor.id },
        });
      }

      await logHrAudit({
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: defaultOrgId,
        subsidiaryId: defaultOrgId,
        targetType: 'POLICY',
        targetId: POLICY_KEY,
        action: 'UPDATED',
        metadata: nextPolicy,
      });

      return NextResponse.json({ success: true, policy: nextPolicy });
    }

    if (action === 'SAVE_CAPABILITY_GRANT') {
      if (actor.role !== 'GMD' && actor.role !== 'SYSTEM_ADMIN') {
        return NextResponse.json({ error: 'Only Super Admin or GMD can update capability grants.' }, { status: 403 });
      }
      const employeeId = String(body.employeeId || '');
      const grants = Array.isArray(body.grants) ? body.grants.map(String) : [];
      if (!employeeId) return NextResponse.json({ error: 'Employee ID is required.' }, { status: 400 });

      const existing = await prisma.workspaceSetting.findFirst({ where: { key: GRANTS_KEY } });
      const currentMap: Record<string, string[]> = existing?.value ? JSON.parse(existing.value) : {};
      currentMap[employeeId] = grants;

      if (existing) {
        await prisma.workspaceSetting.update({
          where: { id: existing.id },
          data: { value: JSON.stringify(currentMap), updatedById: actor.id },
        });
      } else {
        await prisma.workspaceSetting.create({
          data: { organizationId: defaultOrgId, key: GRANTS_KEY, value: JSON.stringify(currentMap), updatedById: actor.id },
        });
      }

      return NextResponse.json({ success: true, capabilityGrants: currentMap });
    }

    return NextResponse.json({ error: 'Unsupported configuration action.' }, { status: 400 });
  } catch (error) {
    console.error('HR Config POST error:', error);
    return NextResponse.json({ error: 'Failed to save HR configuration' }, { status: 500 });
  }
}

