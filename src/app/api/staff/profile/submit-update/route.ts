import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }

    const body = await request.json();
    const { requestId, updates } = body;

    if (!requestId || !updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'Invalid update payload.' }, { status: 400 });
    }

    // Verify pending request belongs to this employee
    const pendingRequest = await prisma.staffProfileUpdateRequest.findFirst({
      where: {
        id: requestId,
        employeeId: actor.id,
        status: 'PENDING',
      },
    });

    if (!pendingRequest) {
      return NextResponse.json(
        { error: 'No active pending update request found matching this ID.' },
        { status: 404 }
      );
    }

    const requestedFields: string[] = JSON.parse(pendingRequest.requestedFields || '[]');
    const employeeUpdateData: any = {};

    // 1. Passport Photograph
    if ((requestedFields.includes('avatarUrl')) && updates.avatarUrl) {
      const cleanAvatar = String(updates.avatarUrl).trim();
      if (cleanAvatar.length > 5) {
        employeeUpdateData.avatarUrl = cleanAvatar;
      }
    }

    // 2. National Identity Number (NIN)
    if ((requestedFields.includes('nin')) && updates.nin) {
      const cleanNin = String(updates.nin).replace(/\D/g, '');
      if (cleanNin.length !== 11) {
        return NextResponse.json({ error: 'National Identity Number (NIN) must be exactly 11 digits.' }, { status: 400 });
      }
      employeeUpdateData.nin = cleanNin;
    }

    // 3. Bank Verification Number (BVN)
    if ((requestedFields.includes('bvn')) && updates.bvn) {
      const cleanBvn = String(updates.bvn).replace(/\D/g, '');
      if (cleanBvn.length !== 11) {
        return NextResponse.json({ error: 'Bank Verification Number (BVN) must be exactly 11 digits.' }, { status: 400 });
      }
      employeeUpdateData.bvn = cleanBvn;
    }

    // 4. Disbursement Bank Name
    if ((requestedFields.includes('bankName') || requestedFields.includes('bankDetails')) && updates.bankName) {
      employeeUpdateData.bankName = String(updates.bankName).trim();
    }

    // 5. Disbursement Account Number
    if ((requestedFields.includes('accountNumber') || requestedFields.includes('bankDetails')) && updates.accountNumber) {
      const cleanAcc = String(updates.accountNumber).replace(/\D/g, '');
      if (cleanAcc.length !== 10) {
        return NextResponse.json({ error: 'Disbursement account number must be exactly 10 digits.' }, { status: 400 });
      }
      employeeUpdateData.accountNumber = cleanAcc;
    }

    // 6. Disbursement Account Name
    if ((requestedFields.includes('accountName') || requestedFields.includes('bankDetails')) && updates.accountName) {
      employeeUpdateData.accountName = String(updates.accountName).trim();
    }

    // 7. Salary Bank Details
    if ((requestedFields.includes('salaryBankName')) && updates.salaryBankName) {
      employeeUpdateData.salaryBankName = String(updates.salaryBankName).trim();
    }
    if ((requestedFields.includes('salaryAccountNumber')) && updates.salaryAccountNumber) {
      const cleanAcc = String(updates.salaryAccountNumber).replace(/\D/g, '');
      if (cleanAcc.length !== 10) {
        return NextResponse.json({ error: 'Salary account number must be exactly 10 digits.' }, { status: 400 });
      }
      employeeUpdateData.salaryAccountNumber = cleanAcc;
    }
    if ((requestedFields.includes('salaryAccountName')) && updates.salaryAccountName) {
      employeeUpdateData.salaryAccountName = String(updates.salaryAccountName).trim();
    }

    // 8. Next of Kin Name
    if ((requestedFields.includes('nextOfKinName') || requestedFields.includes('nextOfKin')) && updates.nextOfKinName) {
      employeeUpdateData.nextOfKinName = String(updates.nextOfKinName).trim();
    }

    // 9. Next of Kin Phone
    if ((requestedFields.includes('nextOfKinPhone') || requestedFields.includes('nextOfKin')) && updates.nextOfKinPhone) {
      employeeUpdateData.nextOfKinPhone = String(updates.nextOfKinPhone).trim();
    }

    // 10. Next of Kin Relationship
    if ((requestedFields.includes('nextOfKinRelationship') || requestedFields.includes('nextOfKin')) && updates.nextOfKinRelationship) {
      employeeUpdateData.nextOfKinRelationship = String(updates.nextOfKinRelationship).trim();
    }

    // 11. Next of Kin Address
    if ((requestedFields.includes('nextOfKinAddress') || requestedFields.includes('nextOfKin')) && updates.nextOfKinAddress) {
      employeeUpdateData.nextOfKinAddress = String(updates.nextOfKinAddress).trim();
    }

    // 12. Personal Phone Number
    if ((requestedFields.includes('phone')) && updates.phone) {
      employeeUpdateData.phone = String(updates.phone).trim();
    }

    // 13. Residential Address
    if ((requestedFields.includes('residentialAddress')) && updates.residentialAddress) {
      employeeUpdateData.residentialAddress = String(updates.residentialAddress).trim();
    }

    // 14. City & State of Residence
    if ((requestedFields.includes('cityState') || requestedFields.includes('residentialAddress')) && updates.cityState) {
      employeeUpdateData.cityState = String(updates.cityState).trim();
    }

    // 15. State of Origin
    if ((requestedFields.includes('stateOfOrigin') || requestedFields.includes('demographics')) && updates.stateOfOrigin) {
      employeeUpdateData.stateOfOrigin = String(updates.stateOfOrigin).trim();
    }

    // 16. LGA of Origin
    if ((requestedFields.includes('lga') || requestedFields.includes('demographics')) && updates.lga) {
      employeeUpdateData.lga = String(updates.lga).trim();
    }

    // 17. Marital Status
    if ((requestedFields.includes('maritalStatus') || requestedFields.includes('demographics')) && updates.maritalStatus) {
      employeeUpdateData.maritalStatus = String(updates.maritalStatus).trim().toUpperCase();
    }

    // 18. Highest Education
    if ((requestedFields.includes('highestEducation') || requestedFields.includes('demographics')) && updates.highestEducation) {
      employeeUpdateData.highestEducation = String(updates.highestEducation).trim().toUpperCase();
    }

    // 19. Date of Birth
    if ((requestedFields.includes('dateOfBirth')) && updates.dateOfBirth) {
      employeeUpdateData.dateOfBirth = String(updates.dateOfBirth).trim();
    }

    // 20. Gender
    if ((requestedFields.includes('gender')) && updates.gender) {
      employeeUpdateData.gender = String(updates.gender).trim().toUpperCase();
    }

    // 21. Security Quick-Unlock PIN
    if ((requestedFields.includes('securityPin')) && updates.securityPin) {
      const cleanPin = String(updates.securityPin).trim();
      if (!/^\d{4}$/.test(cleanPin)) {
        return NextResponse.json({ error: 'Security PIN must be exactly 4 digits (0-9).' }, { status: 400 });
      }
      employeeUpdateData.securityPinHash = await hashPassword(cleanPin);
    }

    // Atomically update Employee and complete the update request
    const [updatedEmp] = await prisma.$transaction([
      prisma.employee.update({
        where: { id: actor.id },
        data: employeeUpdateData,
        select: {
          id: true,
          legalName: true,
          avatarUrl: true,
          nin: true,
          bankName: true,
          accountNumber: true,
          accountName: true,
        },
      }),
      prisma.staffProfileUpdateRequest.update({
        where: { id: pendingRequest.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      }),
      prisma.systemNotification.create({
        data: {
          employeeId: actor.id,
          title: 'Profile Update Completed',
          body: 'Thank you. Your updated profile information has been saved and confirmed by the system.',
          kind: 'INFO',
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Profile information updated successfully! You may now proceed to your dashboard.',
      employee: updatedEmp,
    });
  } catch (error: any) {
    console.error('[submit-update] Error submitting profile update:', error);
    return NextResponse.json({ error: error.message || 'Failed to update profile records.' }, { status: 500 });
  }
}
