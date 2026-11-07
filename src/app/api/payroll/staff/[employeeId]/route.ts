import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function formatNaira(minor: bigint | number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(minor) / 100);
}

export async function GET(request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  const actor = await getAuthenticatedEmployee(request);
  if (!actor) return NextResponse.json({ error: 'Sign in to view staff payroll details.' }, { status: 401 });
  if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
    return NextResponse.json({ error: 'Executive or Super admin access is required to view staff payroll details.' }, { status: 403 });
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
        include: { compensations: { orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }] } }
      },
      salaryChangeProposals: {
        orderBy: { createdAt: 'desc' },
        take: 5,
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
      },
      expenditureRequests: {
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          subsidiary: { select: { legalName: true } },
          disbursements: { select: { id: true, amountMinor: true, status: true, paidAt: true } }
        }
      }
    }
  });

  if (!employee || employee.role !== 'STAFF') {
    return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
  }

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

  const requestHistory = (employee.expenditureRequests || []).map((req) => {
    const isPaid = req.disbursements.some((d) => d.status === 'COMPLETED' || d.status === 'PAID');
    return {
      id: req.id,
      requestNumber: req.requestNumber,
      title: req.title,
      amountFormatted: formatNaira(req.amountMinor),
      amountMinor: Number(req.amountMinor),
      currency: req.currency,
      status: req.paymentStatus,
      subsidiaryName: req.subsidiary?.legalName || 'BEMS Conglomerate',
      createdAt: req.createdAt,
      isPaid,
    };
  });

  const now = new Date();
  const agreement = employee.employmentAgreements[0];
  const allCompensations = agreement?.compensations || [];

  // Active current salary (effectiveFrom <= now)
  const currentCompensation = allCompensations.find(
    (c) => new Date(c.effectiveFrom) <= now && (!c.effectiveTo || new Date(c.effectiveTo) >= now)
  ) || allCompensations[allCompensations.length - 1] || null;

  // Upcoming scheduled salary (effectiveFrom > now)
  const upcomingCompensation = allCompensations.find(
    (c) => new Date(c.effectiveFrom) > now
  ) || null;

  // Full Version History
  const salaryHistory = allCompensations.map((c) => {
    const isFuture = new Date(c.effectiveFrom) > now;
    const isCurrent = currentCompensation?.id === c.id;
    return {
      id: c.id,
      version: c.version,
      grossMinor: Number(c.grossMinor),
      grossFormatted: formatNaira(c.grossMinor),
      currency: c.currency,
      effectiveFrom: c.effectiveFrom,
      effectiveTo: c.effectiveTo,
      changeType: c.changeType,
      changeReason: c.changeReason,
      isCurrent,
      isFuture,
      status: isCurrent ? 'ACTIVE_NOW' : isFuture ? 'SCHEDULED_FUTURE' : 'SUPERSEDED',
    };
  });

  return NextResponse.json({
    employee: {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      legalName: employee.legalName,
      role: employee.role,
      status: employee.status,
      avatarUrl: employee.avatarUrl,
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
      isOfflineStaff: employee.isOfflineStaff,
      isAttendanceExempt: employee.isAttendanceExempt,
      kioskPin: employee.kioskPin,
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
        grossFormatted: Number(currentCompensation.grossMinor) === 0 ? 'Not on Payroll (₦0)' : formatNaira(currentCompensation.grossMinor),
        grossMinor: Number(currentCompensation.grossMinor),
        currency: currentCompensation.currency,
        recurrence: currentCompensation.recurrence,
        effectiveFrom: currentCompensation.effectiveFrom,
        version: currentCompensation.version,
        changeType: currentCompensation.changeType,
        changeReason: currentCompensation.changeReason
      } : null,
      upcomingSalary: upcomingCompensation ? {
        grossFormatted: Number(upcomingCompensation.grossMinor) === 0 ? 'Not on Payroll (₦0)' : formatNaira(upcomingCompensation.grossMinor),
        grossMinor: Number(upcomingCompensation.grossMinor),
        currency: upcomingCompensation.currency,
        effectiveFrom: upcomingCompensation.effectiveFrom,
        version: upcomingCompensation.version,
        changeReason: upcomingCompensation.changeReason,
      } : null,
      salaryHistory,
      pendingSalaryProposal: employee.salaryChangeProposals?.find(p => p.status === 'PENDING_APPROVAL') ? {
        id: employee.salaryChangeProposals.find(p => p.status === 'PENDING_APPROVAL')!.id,
        previousGrossFormatted: formatNaira(employee.salaryChangeProposals.find(p => p.status === 'PENDING_APPROVAL')!.previousGrossMinor),
        proposedGrossFormatted: formatNaira(employee.salaryChangeProposals.find(p => p.status === 'PENDING_APPROVAL')!.proposedGrossMinor),
        proposedGrossMinor: Number(employee.salaryChangeProposals.find(p => p.status === 'PENDING_APPROVAL')!.proposedGrossMinor),
        changeType: employee.salaryChangeProposals.find(p => p.status === 'PENDING_APPROVAL')!.changeType,
        reason: employee.salaryChangeProposals.find(p => p.status === 'PENDING_APPROVAL')!.reason,
        proposedByName: employee.salaryChangeProposals.find(p => p.status === 'PENDING_APPROVAL')!.proposedByName,
        createdAt: employee.salaryChangeProposals.find(p => p.status === 'PENDING_APPROVAL')!.createdAt,
      } : null,
    },
    payrollHistory,
    requestHistory,
    permissions: {
      canEditSalary: hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']),
      canApproveSalary: hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']),
    }
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  const actor = await getAuthenticatedEmployee(request);
  if (!actor) return NextResponse.json({ error: 'Sign in to update profile.' }, { status: 401 });
  if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
    return NextResponse.json({ error: 'Executive or Super admin access is required.' }, { status: 403 });
  }

  const { employeeId } = await params;
  const body = await request.json().catch(() => ({}));
  const { avatarUrl, jobTitle, phone, residentialAddress, cityState, isAttendanceExempt } = body;

  const updated = await prisma.employee.update({
    where: { id: employeeId },
    data: {
      ...(typeof avatarUrl === 'string' ? { avatarUrl } : {}),
      ...(typeof jobTitle === 'string' ? { jobTitle } : {}),
      ...(typeof phone === 'string' ? { phone } : {}),
      ...(typeof residentialAddress === 'string' ? { residentialAddress } : {}),
      ...(typeof cityState === 'string' ? { cityState } : {}),
      ...(typeof isAttendanceExempt === 'boolean' ? { isAttendanceExempt } : {}),
    }
  });

  if (typeof isAttendanceExempt === 'boolean') {
    await prisma.staffWorkSchedule.upsert({
      where: { employeeId },
      update: { isExempt: isAttendanceExempt },
      create: {
        employeeId,
        weeklyOffDays: '0,6',
        isExempt: isAttendanceExempt,
      },
    }).catch(() => {});
  }

  return NextResponse.json({ message: 'Profile updated successfully.', employee: updated });
}
