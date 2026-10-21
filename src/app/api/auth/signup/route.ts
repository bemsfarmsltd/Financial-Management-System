import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function generateUniqueEmployeeNumber(subsidiaryId?: string | null): Promise<string> {
  const year = new Date().getFullYear();
  let prefix = 'STF';

  if (subsidiaryId) {
    const org = await prisma.organization.findUnique({
      where: { id: subsidiaryId },
      select: { code: true, legalName: true }
    });
    if (org?.code) {
      // E.g. BEMS-FARMS -> BF, BEMS-LOG -> BL, BEMS-SOFT -> BS, BEMS-HQ -> HQ
      const cleaned = org.code.replace(/BEMS-?/i, '').trim();
      prefix = cleaned.length >= 2 ? cleaned.slice(0, 3).toUpperCase() : org.code.slice(0, 3).toUpperCase();
    }
  }

  // Count existing employees matching this prefix and year
  const count = await prisma.employee.count({
    where: {
      employeeNumber: {
        startsWith: `BEMS-${prefix}-${year}-`
      }
    }
  });

  let seq = count + 1;
  let candidate = `BEMS-${prefix}-${year}-${seq.toString().padStart(4, '0')}`;

  // Collision safety
  let attempts = 0;
  while (await prisma.employee.findUnique({ where: { employeeNumber: candidate } })) {
    seq += 1;
    candidate = `BEMS-${prefix}-${year}-${seq.toString().padStart(4, '0')}`;
    attempts += 1;
    if (attempts > 50) {
      candidate = `BEMS-${prefix}-${year}-${seq.toString().padStart(4, '0')}-${randomUUID().slice(0, 4).toUpperCase()}`;
      break;
    }
  }

  return candidate;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Personal Identity
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const gender = typeof body.gender === 'string' ? body.gender.trim() : null;
    const dateOfBirth = typeof body.dateOfBirth === 'string' ? body.dateOfBirth.trim() : null;
    const residentialAddress = typeof body.residentialAddress === 'string' ? body.residentialAddress.trim() : null;
    const cityState = typeof body.cityState === 'string' ? body.cityState.trim() : null;

    // 2. Corporate Placement
    const subsidiaryId = typeof body.subsidiaryId === 'string' && body.subsidiaryId.trim() ? body.subsidiaryId.trim() : null;
    const departmentId = typeof body.departmentId === 'string' && body.departmentId.trim() ? body.departmentId.trim() : null;
    const jobTitle = typeof body.jobTitle === 'string' && body.jobTitle.trim() ? body.jobTitle.trim() : 'Staff Member';
    const employmentType = typeof body.employmentType === 'string' && body.employmentType.trim() ? body.employmentType.trim() : 'FULL_TIME';
    const resumptionDateStr = typeof body.resumptionDate === 'string' ? body.resumptionDate : null;
    const resumptionDate = resumptionDateStr ? new Date(resumptionDateStr) : new Date();

    // 3. Disbursement Bank Details
    const bankName = typeof body.bankName === 'string' ? body.bankName.trim() : null;
    const accountNumber = typeof body.accountNumber === 'string' ? body.accountNumber.trim() : null;
    const accountName = typeof body.accountName === 'string' ? body.accountName.trim() : null;

    // 4. Emergency / Next of Kin
    const nextOfKinName = typeof body.nextOfKinName === 'string' ? body.nextOfKinName.trim() : null;
    const nextOfKinPhone = typeof body.nextOfKinPhone === 'string' ? body.nextOfKinPhone.trim() : null;
    const nextOfKinRelationship = typeof body.nextOfKinRelationship === 'string' ? body.nextOfKinRelationship.trim() : null;
    const nextOfKinAddress = typeof body.nextOfKinAddress === 'string' ? body.nextOfKinAddress.trim() : null;

    // 5. Statutory & Corporate Profile
    const maritalStatus = typeof body.maritalStatus === 'string' ? body.maritalStatus.trim() : null;
    const stateOfOrigin = typeof body.stateOfOrigin === 'string' ? body.stateOfOrigin.trim() : null;
    const lga = typeof body.lga === 'string' ? body.lga.trim() : null;
    const nin = typeof body.nin === 'string' ? body.nin.trim() : null;
    const bvn = typeof body.bvn === 'string' ? body.bvn.trim() : null;
    const workLocation = typeof body.workLocation === 'string' ? body.workLocation.trim() : 'LAGOS_HQ';
    const staffGrade = typeof body.staffGrade === 'string' ? body.staffGrade.trim() : 'OFFICER';
    const highestEducation = typeof body.highestEducation === 'string' ? body.highestEducation.trim() : null;

    // Validation
    if (fullName.length < 2) {
      return NextResponse.json({ error: 'Please enter your full legal name.' }, { status: 400 });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid work or personal email address.' }, { status: 400 });
    }
    if (password.length < 10) {
      return NextResponse.json({ error: 'Password must be at least 10 characters long.' }, { status: 400 });
    }

    if (await prisma.employee.findUnique({ where: { workEmail: email }, select: { id: true } })) {
      return NextResponse.json({ error: 'An employee account already exists for this email address.' }, { status: 409 });
    }

    // Automatically generate persistent enterprise Unique Identity Number
    const uniqueEmployeeNumber = await generateUniqueEmployeeNumber(subsidiaryId);

    // Create Employee within transaction
    const employee = await prisma.$transaction(async (tx) => {
      const newEmp = await tx.employee.create({
        data: {
          employeeNumber: uniqueEmployeeNumber,
          legalName: fullName,
          workEmail: email,
          phone: phone || null,
          role: 'STAFF',
          status: 'ACTIVE',
          approvalStatus: 'PENDING_APPROVAL',
          passwordHash: await hashPassword(password),
          gender,
          dateOfBirth,
          residentialAddress,
          cityState,
          jobTitle,
          employmentType,
          resumptionDate,
          bankName,
          accountNumber,
          accountName,
          nextOfKinName,
          nextOfKinPhone,
          nextOfKinRelationship,
          nextOfKinAddress,
          maritalStatus,
          stateOfOrigin,
          lga,
          nin,
          bvn,
          workLocation,
          staffGrade,
          highestEducation,
        },
      });

      // If subsidiary chosen, create primary employee assignment
      if (subsidiaryId) {
        await tx.employeeAssignment.create({
          data: {
            employeeId: newEmp.id,
            subsidiaryId,
            departmentId: departmentId || null,
            positionName: jobTitle,
            isPrimary: true,
            status: 'PENDING',
          },
        });
      }

      return newEmp;
    });

    // Notify System Administrators of new registration
    const admins = await prisma.employee.findMany({
      where: { role: { in: ['SYSTEM_ADMIN', 'GMD'] }, status: 'ACTIVE', approvalStatus: 'APPROVED' },
      select: { id: true }
    });

    if (admins.length) {
      await prisma.systemNotification.createMany({
        data: admins.map(({ id }) => ({
          employeeId: id,
          kind: 'SIGNUP_APPROVAL',
          title: `New Staff Registration: ${fullName} (${uniqueEmployeeNumber})`,
          body: `${fullName} has registered as ${jobTitle} (${employmentType}). Unique Staff ID: ${uniqueEmployeeNumber}. Pending verification.`,
          linkUrl: '/staff',
        })),
      });
    }

    return NextResponse.json({
      pendingApproval: true,
      employeeNumber: uniqueEmployeeNumber,
      message: `Staff registration successful. Your unique Employee ID is ${uniqueEmployeeNumber}. Account is awaiting final administrator approval.`,
    }, { status: 201 });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Could not complete staff registration. Please check your inputs.' }, { status: 500 });
  }
}
