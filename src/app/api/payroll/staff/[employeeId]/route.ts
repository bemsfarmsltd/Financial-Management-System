import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function formatNaira(minor: bigint | number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(minor) / 100);
}

export async function GET(_request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  const actor = await getAuthenticatedEmployee();
  if (!actor) return NextResponse.json({ error: 'Sign in to view staff payroll details.' }, { status: 401 });
  if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'COO', 'HEAD_OF_ADMIN', 'HR', 'DIRECTOR', 'FINANCE'])) {
    return NextResponse.json({ error: 'HR or executive access is required to view staff payroll details.' }, { status: 403 });
  }

  const { employeeId } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      assignments: {
        where: { status: 'ACTIVE' },
        include: {
          subsidiary: { select: { legalName: true } },
          department: { select: { name: true } }
        },
        orderBy: [{ isPrimary: 'desc' }, { startsOn: 'desc' }]
      },
      employmentAgreements: {
        where: { status: 'ACTIVE' },
        orderBy: { startDate: 'desc' },
        take: 1,
        include: { compensations: { where: { effectiveTo: null }, orderBy: [{ version: 'desc' }, { effectiveFrom: 'desc' }], take: 1 } }
      },
      payrollItems: {
        include: {
          batch: { include: { period: true } },
          allocations: true,
          disbursement: {
            include: {
              receipt: { select: { fileName: true, fileUrl: true } },
              recipientConfirmation: { select: { decision: true, note: true, confirmedAt: true } }
            }
          }
        }
      }
    }
  });

  if (!employee) return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });

  const subsidiaryIds = [...new Set(employee.payrollItems.flatMap(item => item.allocations.map(allocation => allocation.subsidiaryId)))];
  const subsidiaries = subsidiaryIds.length
    ? await prisma.organization.findMany({ where: { id: { in: subsidiaryIds } }, select: { id: true, legalName: true } })
    : [];
  const subsidiaryNames = new Map(subsidiaries.map(subsidiary => [subsidiary.id, subsidiary.legalName]));
  const payrollHistory = [...employee.payrollItems]
    .sort((a, b) => b.batch.period.year - a.batch.period.year || b.batch.period.month - a.batch.period.month || b.batch.version - a.batch.version)
    .map(item => {
      const period = item.batch.period;
      const disbursement = item.disbursement;
      return {
        id: item.id,
        periodName: `${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(period.year, period.month - 1, 1))} ${period.year}`,
        batchVersion: item.batch.version,
        batchStatus: item.batch.status,
        grossFormatted: formatNaira(item.grossMinor),
        deductionsFormatted: formatNaira(item.employeeDeductionsMinor),
        netFormatted: formatNaira(item.netMinor),
        paymentStatus: disbursement?.status || 'UNPAID',
        paidAt: disbursement?.paidAt || null,
        bankName: disbursement?.bankName || null,
        reference: disbursement?.externalReference || null,
        receipt: disbursement?.receipt || null,
        confirmation: disbursement?.recipientConfirmation || null,
        allocations: item.allocations.map(allocation => ({
          subsidiaryName: subsidiaryNames.get(allocation.subsidiaryId) || 'Unknown subsidiary',
          amountFormatted: formatNaira(allocation.allocableCostMinor)
        }))
      };
    });

  const agreement = employee.employmentAgreements[0];
  const currentCompensation = agreement?.compensations[0] || null;
  return NextResponse.json({
    employee: {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      legalName: employee.legalName,
      role: employee.role,
      status: employee.status,
      workEmail: employee.workEmail,
      phone: employee.phone,
      createdAt: employee.createdAt,
      // Registration & Personal Details
      gender: employee.gender,
      dateOfBirth: employee.dateOfBirth,
      maritalStatus: employee.maritalStatus,
      stateOfOrigin: employee.stateOfOrigin,
      lga: employee.lga,
      residentialAddress: employee.residentialAddress,
      cityState: employee.cityState,
      highestEducation: employee.highestEducation,
      // Official & Workplace
      jobTitle: employee.jobTitle,
      employmentType: employee.employmentType,
      resumptionDate: employee.resumptionDate,
      workLocation: employee.workLocation,
      staffGrade: employee.staffGrade,
      // Banking
      bankName: employee.bankName,
      accountNumber: employee.accountNumber,
      accountName: employee.accountName,
      salaryBankName: employee.salaryBankName,
      salaryAccountNumber: employee.salaryAccountNumber,
      salaryAccountName: employee.salaryAccountName,
      // Identity
      nin: employee.nin,
      bvn: employee.bvn,
      // Next of Kin
      nextOfKinName: employee.nextOfKinName,
      nextOfKinPhone: employee.nextOfKinPhone,
      nextOfKinRelationship: employee.nextOfKinRelationship,
      nextOfKinAddress: employee.nextOfKinAddress,
      assignment: employee.assignments[0] ? {
        positionName: employee.assignments[0].positionName,
        subsidiaryName: employee.assignments[0].subsidiary.legalName,
        departmentName: employee.assignments[0].department?.name || null,
        startsOn: employee.assignments[0].startsOn
      } : null,
      employment: agreement ? {
        agreementType: agreement.agreementType,
        paymentModel: agreement.paymentModel,
        status: agreement.status,
        startDate: agreement.startDate,
        endDate: agreement.endDate
      } : null,
      salary: currentCompensation ? {
        grossFormatted: formatNaira(currentCompensation.grossMinor),
        grossMinor: Number(currentCompensation.grossMinor),
        currency: currentCompensation.currency,
        recurrence: currentCompensation.recurrence,
        effectiveFrom: currentCompensation.effectiveFrom,
        version: currentCompensation.version,
        changeType: currentCompensation.changeType,
        changeReason: currentCompensation.changeReason
      } : null
    },
    payrollHistory,
    permissions: { canEditSalary: hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD']) }
  });
}
