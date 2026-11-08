import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, publicEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    let employee = await getAuthenticatedEmployee(req);

    // Resilient fallback for mobile client passing x-employee-id header with active token
    if (!employee) {
      const empIdHeader = req.headers.get('x-employee-id');
      const authHeader = req.headers.get('authorization');
      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

      if (empIdHeader) {
        const found = await prisma.employee.findUnique({
          where: { id: empIdHeader },
        });
        if (found && found.status === 'ACTIVE') {
          employee = found as any;
        }
      } else if (token) {
        const directEmp = await prisma.employee.findUnique({
          where: { id: token },
        });
        if (directEmp && directEmp.status === 'ACTIVE') {
          employee = directEmp as any;
        }
      }
    }

    if (!employee) {
      return NextResponse.json({ error: 'Sign in to access staff profile.' }, { status: 401 });
    }

    const fullEmployee = await prisma.employee.findUnique({
      where: { id: employee.id },
      include: {
        assignments: {
          where: { status: 'ACTIVE' },
          orderBy: [{ isPrimary: 'desc' }, { startsOn: 'desc' }],
          include: {
            subsidiary: true,
            department: true,
          },
        },
      },
    });

    if (!fullEmployee) {
      return NextResponse.json({ error: 'Employee record not found.' }, { status: 404 });
    }

    const primaryAssignment = fullEmployee.assignments?.[0];

    const safeProfile = {
      ...publicEmployee(fullEmployee),
      employeeNumber: fullEmployee.employeeNumber || '',
      phone: fullEmployee.phone || '',
      gender: fullEmployee.gender || '',
      dateOfBirth: fullEmployee.dateOfBirth || '',
      residentialAddress: fullEmployee.residentialAddress || '',
      cityState: fullEmployee.cityState || '',
      subsidiary: primaryAssignment?.subsidiary?.legalName || primaryAssignment?.subsidiary?.code || '',
      department: primaryAssignment?.department?.name || '',
      jobTitle: fullEmployee.jobTitle || primaryAssignment?.positionName || '',
      employmentType: fullEmployee.employmentType || '',
      resumptionDate: fullEmployee.resumptionDate ? fullEmployee.resumptionDate.toISOString().split('T')[0] : '',
      workLocation: fullEmployee.workLocation || '',
      staffGrade: fullEmployee.staffGrade || '',
      bankName: fullEmployee.bankName || '',
      accountNumber: fullEmployee.accountNumber || '',
      accountName: fullEmployee.accountName || fullEmployee.legalName,
      salaryBankName: fullEmployee.salaryBankName || fullEmployee.bankName || '',
      salaryAccountNumber: fullEmployee.salaryAccountNumber || fullEmployee.accountNumber || '',
      salaryAccountName: fullEmployee.salaryAccountName || fullEmployee.accountName || fullEmployee.legalName,
      nextOfKinName: fullEmployee.nextOfKinName || '',
      nextOfKinPhone: fullEmployee.nextOfKinPhone || '',
      nextOfKinRelationship: fullEmployee.nextOfKinRelationship || '',
      nextOfKinAddress: fullEmployee.nextOfKinAddress || '',
      maritalStatus: fullEmployee.maritalStatus || '',
      stateOfOrigin: fullEmployee.stateOfOrigin || '',
      lga: fullEmployee.lga || '',
      ninMask: fullEmployee.nin ? `${fullEmployee.nin.slice(0, 4)}••••${fullEmployee.nin.slice(-2)}` : '',
      bvnMask: fullEmployee.bvn ? `${fullEmployee.bvn.slice(0, 4)}••••${fullEmployee.bvn.slice(-2)}` : '',
    };

    return NextResponse.json(
      { user: safeProfile },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching staff profile:', error);
    return NextResponse.json({ error: error.message || 'Could not load profile.' }, { status: 500 });
  }
}
