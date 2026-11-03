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
    if (requestedFields.includes('avatarUrl') && updates.avatarUrl) {
      const cleanAvatar = String(updates.avatarUrl).trim();
      if (cleanAvatar.length > 5) {
        employeeUpdateData.avatarUrl = cleanAvatar;
      }
    }

    // 2. National Identity Number (NIN)
    if (requestedFields.includes('nin') && updates.nin) {
      const cleanNin = String(updates.nin).replace(/\D/g, '');
      if (cleanNin.length !== 11) {
        return NextResponse.json({ error: 'National Identity Number (NIN) must be exactly 11 digits.' }, { status: 400 });
      }
      employeeUpdateData.nin = cleanNin;
    }

    // 3. Disbursement Bank Details
    if (requestedFields.includes('bankDetails')) {
      if (updates.bankName && typeof updates.bankName === 'string') {
        employeeUpdateData.bankName = updates.bankName.trim();
      }
      if (updates.accountNumber) {
        const cleanAcc = String(updates.accountNumber).replace(/\D/g, '');
        if (cleanAcc.length !== 10) {
          return NextResponse.json({ error: 'Bank account number must be exactly 10 digits.' }, { status: 400 });
        }
        employeeUpdateData.accountNumber = cleanAcc;
      }
      if (updates.accountName && typeof updates.accountName === 'string') {
        employeeUpdateData.accountName = updates.accountName.trim();
      }
    }

    // 4. Next of Kin
    if (requestedFields.includes('nextOfKin')) {
      if (updates.nextOfKinName) employeeUpdateData.nextOfKinName = String(updates.nextOfKinName).trim();
      if (updates.nextOfKinPhone) employeeUpdateData.nextOfKinPhone = String(updates.nextOfKinPhone).trim();
      if (updates.nextOfKinRelationship) employeeUpdateData.nextOfKinRelationship = String(updates.nextOfKinRelationship).trim();
      if (updates.nextOfKinAddress) employeeUpdateData.nextOfKinAddress = String(updates.nextOfKinAddress).trim();
    }

    // 5. Residential Address
    if (requestedFields.includes('residentialAddress')) {
      if (updates.residentialAddress) employeeUpdateData.residentialAddress = String(updates.residentialAddress).trim();
      if (updates.cityState) employeeUpdateData.cityState = String(updates.cityState).trim();
    }

    // 6. Demographics
    if (requestedFields.includes('demographics')) {
      if (updates.maritalStatus) employeeUpdateData.maritalStatus = String(updates.maritalStatus).trim().toUpperCase();
      if (updates.highestEducation) employeeUpdateData.highestEducation = String(updates.highestEducation).trim().toUpperCase();
      if (updates.stateOfOrigin) employeeUpdateData.stateOfOrigin = String(updates.stateOfOrigin).trim();
      if (updates.lga) employeeUpdateData.lga = String(updates.lga).trim();
    }

    // 7. Security Quick-Unlock PIN
    if (requestedFields.includes('securityPin') && updates.securityPin) {
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
