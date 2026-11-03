import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }

    const pendingRequest = await prisma.staffProfileUpdateRequest.findFirst({
      where: {
        employeeId: actor.id,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: {
          select: { legalName: true, role: true },
        },
      },
    });

    if (!pendingRequest) {
      return NextResponse.json({ hasPendingUpdate: false, request: null });
    }

    // Fetch current employee data to prefill the fields
    const currentEmp = await prisma.employee.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        legalName: true,
        avatarUrl: true,
        phone: true,
        nin: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
        nextOfKinName: true,
        nextOfKinPhone: true,
        nextOfKinRelationship: true,
        nextOfKinAddress: true,
        residentialAddress: true,
        cityState: true,
        maritalStatus: true,
        highestEducation: true,
        stateOfOrigin: true,
        lga: true,
        bvn: true,
        dateOfBirth: true,
        gender: true,
        salaryBankName: true,
        salaryAccountNumber: true,
        salaryAccountName: true,
        securityPinHash: true,
      },
    });

    let requestedFields: string[] = [];
    try {
      requestedFields = JSON.parse(pendingRequest.requestedFields);
    } catch {
      requestedFields = [];
    }

    return NextResponse.json({
      hasPendingUpdate: true,
      request: {
        id: pendingRequest.id,
        instructions: pendingRequest.instructions,
        requestedFields,
        requestedBy: pendingRequest.requestedBy.legalName,
        createdAt: pendingRequest.createdAt,
      },
      currentData: currentEmp
        ? {
            ...currentEmp,
            hasPinSet: Boolean(currentEmp.securityPinHash),
            securityPinHash: undefined, // Never expose hash
          }
        : null,
    });
  } catch (error: any) {
    console.error('[pending-update] Error checking pending update:', error);
    return NextResponse.json({ error: 'Failed to check pending updates.' }, { status: 500 });
  }
}
