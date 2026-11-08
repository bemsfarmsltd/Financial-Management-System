import { normalizeOrganizationIdentifier } from '@/lib/organization-identity';
import { executeDashboardCommand } from '@/lib/staged-actions';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'node:crypto';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

    const { businessId: requestedBusinessId } = await params;
    const businessId = normalizeOrganizationIdentifier(requestedBusinessId);

    const scopeCheck = await resolveAuthorizedOrganizationScope(actor, businessId);
    if (scopeCheck.organizationIds.length === 0) {
      return NextResponse.json({ error: 'Forbidden: Outside authorized subsidiary scope.' }, { status: 403 });
    }

    const employees = await prisma.employee.findMany({
      where: { assignments: { some: { subsidiaryId: { in: scopeCheck.organizationIds }, status: 'ACTIVE' } } },
      include: {
        assignments: {
          include: {
            subsidiary: {
              select: { id: true, legalName: true, code: true },
            },
            department: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const members = employees.map((emp) => {
      const primaryAssignment = emp.assignments?.[0];
      const sub = primaryAssignment?.subsidiary;
      const dept = primaryAssignment?.department;

      return {
        id: emp.id,
        email: emp.workEmail,
        fullName: emp.legalName || 'BEMS Employee',
        role: emp.role || 'STAFF',
        status: emp.status === 'INVITED' ? 'Invited' : emp.status === 'SUSPENDED' ? 'Suspended' : 'Active',
        isOwner: emp.role === 'GMD' || emp.role === 'SYSTEM_ADMIN' || emp.role === 'SUPER_ADMIN',
        employeeNumber: emp.employeeNumber || `BEMS-${emp.id.slice(0, 4).toUpperCase()}`,
        jobTitle: emp.jobTitle || emp.role.replace('_', ' '),
        department: dept?.name || 'General Operations',
        subsidiaryName: sub?.legalName || 'BEMS Group',
      };
    });

    if (!scopeCheck.isGroup) {
      const filtered = members.filter((m) => {
        const emp = employees.find((e) => e.id === m.id);
        return emp?.assignments?.some(
          (a) =>
            scopeCheck.organizationIds.includes(a.subsidiaryId)
        );
      });
      return NextResponse.json(filtered);
    }

    return NextResponse.json(members);
  } catch (error: any) {
    console.error('Error fetching business members:', error);
    return NextResponse.json({ error: 'Failed to fetch business members.' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Executive access is required to invite executive members.' }, { status: 403 });
    }

    const { businessId: requestedBusinessId } = await params;
    const businessId = normalizeOrganizationIdentifier(requestedBusinessId);
    const body = await req.json().catch(() => ({}));
    const email = body.email?.trim()?.toLowerCase();
    const rawRole = String(body.role || '').trim().toUpperCase();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    if (rawRole !== 'GMD' && rawRole !== 'SUPER_ADMIN' && rawRole !== 'SYSTEM_ADMIN') {
      return NextResponse.json(
        {
          error:
            'Strict Onboarding Channel Separation: Executive email invitations are strictly reserved for SUPER_ADMIN and GMD. Staff must register via self-service.',
        },
        { status: 400 }
      );
    }

    const canonicalRole = rawRole === 'GMD' ? 'GMD' : 'SYSTEM_ADMIN';
    if (canonicalRole === 'SYSTEM_ADMIN' && actor.role === 'GMD') {
      return NextResponse.json(
        { error: 'Only a Super Admin can invite another Super Admin.' },
        { status: 403 }
      );
    }

    const org =
      !businessId || businessId === 'all' || businessId === 'BEMS-GROUP'
        ? await prisma.organization.findFirst({ where: { code: 'BEMS-GROUP' } })
        : await prisma.organization.findFirst({
            where: { OR: [{ id: businessId }, { code: { equals: businessId, mode: 'insensitive' } }] },
          });
    if (!org) {
      return NextResponse.json({ error: `Business "${businessId}" not found.` }, { status: 404 });
    }

    const invitation = await executeDashboardCommand(actor, 'admin_onboarding', {
      sub_action: 'CREATE_INVITE', workEmail: email, role: canonicalRole, subsidiaryId: org.id,
    });

    return NextResponse.json({
      ok: true,
      invitationId: invitation.id,
      deliveryStatus: 'QUEUED',
      message: `Executive invitation issued for ${email} as ${canonicalRole} in ${org.legalName}.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
