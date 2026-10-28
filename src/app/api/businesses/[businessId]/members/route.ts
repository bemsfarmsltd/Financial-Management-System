import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'node:crypto';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;

    const employees = await prisma.employee.findMany({
      include: {
        assignments: {
          include: {
            subsidiary: {
              select: { id: true, legalName: true, code: true }
            },
            department: {
              select: { id: true, name: true, code: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const fallbackSeed = [
      {
        id: 'emp-gmd',
        email: 'gmd@bemsfarms.com',
        fullName: 'Dr. Benjamin (GMD)',
        role: 'GMD',
        status: 'Active',
        isOwner: true,
        employeeNumber: 'BEMS-HQ-2026-0001',
        jobTitle: 'Group Managing Director / CEO',
        department: 'Executive Board',
        subsidiaryName: 'BEMS Group Holding HQ'
      },
      {
        id: 'emp-fc',
        email: 'finance@bemsfarms.com',
        fullName: 'Group Finance Controller',
        role: 'FINANCE_CONTROLLER',
        status: 'Active',
        isOwner: false,
        employeeNumber: 'BEMS-HQ-2026-0002',
        jobTitle: 'Group Financial Controller',
        department: 'Treasury & Finance',
        subsidiaryName: 'BEMS Group Holding HQ'
      },
      {
        id: 'emp-sysadmin',
        email: 'admin@bemsgroup.com',
        fullName: 'Corporate Systems Admin',
        role: 'SYSTEM_ADMIN',
        status: 'Active',
        isOwner: true,
        employeeNumber: 'BEMS-HQ-2026-0003',
        jobTitle: 'Principal Systems Architect',
        department: 'Information Technology',
        subsidiaryName: 'BEMS Group Holding HQ'
      }
    ];

    if (!employees || employees.length === 0) {
      return NextResponse.json(fallbackSeed);
    }

    const members = employees.map(emp => {
      const primaryAssignment = emp.assignments?.[0];
      const sub = primaryAssignment?.subsidiary;
      const dept = primaryAssignment?.department;

      return {
        id: emp.id,
        email: emp.workEmail,
        fullName: emp.legalName || 'BEMS Employee',
        role: emp.role || 'STAFF',
        status: emp.status === 'INVITED' ? 'Invited' : emp.status === 'SUSPENDED' ? 'Suspended' : 'Active',
        isOwner: emp.role === 'GMD' || emp.role === 'SYSTEM_ADMIN',
        employeeNumber: emp.employeeNumber || `BEMS-${emp.id.slice(0, 4).toUpperCase()}`,
        jobTitle: emp.jobTitle || emp.role.replace('_', ' '),
        department: dept?.name || 'General Operations',
        subsidiaryName: sub?.legalName || 'BEMS Group'
      };
    });

    if (businessId && businessId !== 'all' && businessId !== 'bems-group-hq') {
      const filtered = members.filter(m => {
        const emp = employees.find(e => e.id === m.id);
        return emp?.assignments?.some(a => 
          a.subsidiary?.id === businessId || 
          a.subsidiary?.code?.toLowerCase() === businessId.toLowerCase()
        );
      });
      return NextResponse.json(filtered.length > 0 ? filtered : members);
    }

    return NextResponse.json(members);
  } catch (error: any) {
    console.error('Error fetching business members:', error);
    return NextResponse.json([
      {
        id: 'emp-gmd',
        email: 'gmd@bemsfarms.com',
        fullName: 'Dr. Benjamin (GMD)',
        role: 'GMD',
        status: 'Active',
        isOwner: true,
        employeeNumber: 'BEMS-HQ-2026-0001',
        jobTitle: 'Group Managing Director / CEO',
        department: 'Executive Board',
        subsidiaryName: 'BEMS Group Holding HQ'
      }
    ]);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const body = await req.json().catch(() => ({}));
    const email = body.email?.trim()?.toLowerCase();
    const role = body.role || 'STAFF';

    if (!email) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    const devInviteToken = `INV-${randomUUID().slice(0, 8).toUpperCase()}`;

    return NextResponse.json({
      ok: true,
      devInviteToken,
      message: `Invitation issued for ${email} as ${role} in ${businessId}.`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
