import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function formatNaira(minor: bigint | number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(minor) / 100);
}

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor || !hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD', 'HR_ADMIN'])) {
      return NextResponse.json({ error: 'HR Admin, Super Admin, or GMD authorization required.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const legalName = typeof body.legalName === 'string' ? body.legalName.trim() : '';
    const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null;
    const gender = typeof body.gender === 'string' && body.gender.trim() ? body.gender.trim() : 'MALE';
    const subsidiaryId = typeof body.subsidiaryId === 'string' && body.subsidiaryId.trim() ? body.subsidiaryId.trim() : '';
    const departmentId = typeof body.departmentId === 'string' && body.departmentId.trim() ? body.departmentId.trim() : null;
    const jobTitle = typeof body.jobTitle === 'string' && body.jobTitle.trim() ? body.jobTitle.trim() : 'Field Staff';
    const employmentType = typeof body.employmentType === 'string' && body.employmentType.trim() ? body.employmentType.trim() : 'FULL_TIME';
    const staffGrade = typeof body.staffGrade === 'string' && body.staffGrade.trim() ? body.staffGrade.trim() : null;
    const residentialAddress = typeof body.residentialAddress === 'string' && body.residentialAddress.trim() ? body.residentialAddress.trim() : null;
    const cityState = typeof body.cityState === 'string' && body.cityState.trim() ? body.cityState.trim() : null;
    const nextOfKinName = typeof body.nextOfKinName === 'string' && body.nextOfKinName.trim() ? body.nextOfKinName.trim() : null;
    const nextOfKinPhone = typeof body.nextOfKinPhone === 'string' && body.nextOfKinPhone.trim() ? body.nextOfKinPhone.trim() : null;
    const nextOfKinRelationship = typeof body.nextOfKinRelationship === 'string' && body.nextOfKinRelationship.trim() ? body.nextOfKinRelationship.trim() : null;
    const bankName = typeof body.bankName === 'string' && body.bankName.trim() ? body.bankName.trim() : null;
    const accountNumber = typeof body.accountNumber === 'string' && body.accountNumber.trim() ? body.accountNumber.trim() : null;
    const accountName = typeof body.accountName === 'string' && body.accountName.trim() ? body.accountName.trim() : legalName;
    const avatarUrl = typeof body.avatarUrl === 'string' && body.avatarUrl.trim() ? body.avatarUrl.trim() : null;
    const proposedSalaryNaira = Number(body.proposedSalary || 0);
    const customKioskPin = typeof body.kioskPin === 'string' && /^\d{4}$/.test(body.kioskPin.trim()) ? body.kioskPin.trim() : null;

    if (!legalName || legalName.length < 2) {
      return NextResponse.json({ error: 'Please enter the staff member\'s full legal name.' }, { status: 400 });
    }

    const org = subsidiaryId
      ? await prisma.organization.findUnique({ where: { id: subsidiaryId } })
      : await prisma.organization.findFirst({ orderBy: { type: 'asc' } });

    if (!org) {
      return NextResponse.json({ error: 'Please select a valid subsidiary.' }, { status: 400 });
    }

    const orgCode = (org.code || 'GRO').replace(/^BEMS-?/i, '').slice(0, 3).toUpperCase() || 'GRO';
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const employeeNumber = `BEMS-${orgCode}-${year}-${randomSuffix}`;
    const kioskPin = customKioskPin || String(Math.floor(1000 + Math.random() * 9000));
    const placeholderEmail = `offline.${employeeNumber.toLowerCase()}@bems.internal`;
    const isDirectApprover = hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']);
    const now = new Date();

    const created = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          employeeNumber,
          legalName,
          workEmail: placeholderEmail,
          phone,
          role: 'STAFF',
          status: 'ACTIVE',
          approvalStatus: 'APPROVED',
          isOfflineStaff: true,
          kioskPin,
          onboardedById: actor.id,
          gender,
          jobTitle,
          employmentType,
          staffGrade,
          residentialAddress,
          cityState,
          nextOfKinName,
          nextOfKinPhone,
          nextOfKinRelationship,
          bankName,
          accountNumber,
          accountName,
          salaryBankName: bankName,
          salaryAccountNumber: accountNumber,
          salaryAccountName: accountName,
          avatarUrl,
        }
      });

      await tx.employeeAssignment.create({
        data: {
          employeeId: emp.id,
          subsidiaryId: org.id,
          departmentId: departmentId || null,
          positionName: jobTitle,
          isPrimary: true,
          status: 'ACTIVE',
        }
      });

      const agreement = await tx.employmentAgreement.create({
        data: {
          employeeId: emp.id,
          employerEntityId: org.id,
          agreementType: 'PERMANENT',
          paymentModel: 'GROUP_PAID',
          status: 'ACTIVE',
          startDate: now,
        }
      });

      let salaryPendingApproval = false;
      if (proposedSalaryNaira > 0) {
        const grossMinor = BigInt(Math.round(proposedSalaryNaira * 100));
        if (isDirectApprover) {
          const comp = await tx.compensationAgreement.create({
            data: {
              employmentAgreementId: agreement.id,
              grossMinor,
              currency: 'NGN',
              recurrence: 'MONTHLY',
              effectiveFrom: now,
              version: 1,
              approvedBy: actor.id,
              changeType: 'INITIAL_SALARY',
              changeReason: `Initial offline enrollment by ${actor.legalName}`,
            }
          });
          await tx.costAllocation.create({
            data: {
              compensationAgreementId: comp.id,
              subsidiaryId: org.id,
              percentage: 100,
              effectiveFrom: now,
            }
          });
        } else {
          salaryPendingApproval = true;
          await tx.salaryChangeProposal.create({
            data: {
              employeeId: emp.id,
              previousGrossMinor: BigInt(0),
              proposedGrossMinor: grossMinor,
              changeType: 'INITIAL_SALARY',
              reason: `Initial salary on offline enrollment by ${actor.legalName}`,
              status: 'PENDING_APPROVAL',
              proposedById: actor.id,
              proposedByName: actor.legalName,
            }
          });

          const executives = await tx.employee.findMany({
            where: { role: { in: ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' },
            select: { id: true }
          });

          for (const exec of executives) {
            await tx.systemNotification.create({
              data: {
                employeeId: exec.id,
                kind: 'SALARY_PROPOSAL_PENDING',
                title: `New Offline Staff & Salary Proposal: ${emp.legalName}`,
                body: `${actor.legalName} (HR) enrolled offline worker ${emp.legalName} (${emp.employeeNumber}) with proposed monthly gross salary ${formatNaira(grossMinor)}. Awaiting your approval.`,
                linkUrl: '/finance?tab=Staff+profiles'
              }
            });
          }
        }
      }

      return { emp, salaryPendingApproval };
    });

    return NextResponse.json({
      success: true,
      employee: created.emp,
      kioskPin: created.emp.kioskPin,
      salaryPendingApproval: created.salaryPendingApproval,
      message: created.salaryPendingApproval
        ? `${created.emp.legalName} (${created.emp.employeeNumber}) enrolled as Offline Staff (Kiosk PIN: ${created.emp.kioskPin}). Initial salary sent to GMD / Super Admin for approval.`
        : `${created.emp.legalName} (${created.emp.employeeNumber}) enrolled as Offline Staff (Kiosk PIN: ${created.emp.kioskPin}).`,
    });
  } catch (error: any) {
    console.error('Error in POST /api/staff/offline:', error);
    return NextResponse.json({ error: error.message || 'Could not register offline staff member.' }, { status: 500 });
  }
}

