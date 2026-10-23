import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params;
    const body = await request.json();

    const bankName = typeof body.bankName === 'string' ? body.bankName.trim() : null;
    const accountNumber = typeof body.accountNumber === 'string' ? body.accountNumber.trim() : null;
    const accountName = typeof body.accountName === 'string' ? body.accountName.trim() : null;

    const salaryBankName = typeof body.salaryBankName === 'string' ? body.salaryBankName.trim() : bankName;
    const salaryAccountNumber = typeof body.salaryAccountNumber === 'string' ? body.salaryAccountNumber.trim() : accountNumber;
    const salaryAccountName = typeof body.salaryAccountName === 'string' ? body.salaryAccountName.trim() : accountName;

    if (!bankName || !accountNumber || accountNumber.length < 10) {
      return NextResponse.json({ error: 'Valid Advance Bank Name and 10-digit Account Number are required.' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Staff record not found.' }, { status: 404 });
    }

    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        bankName,
        accountNumber,
        accountName: accountName || employee.legalName,
        salaryBankName,
        salaryAccountNumber,
        salaryAccountName: salaryAccountName || accountName || employee.legalName,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Dual corporate banking accounts updated successfully.',
      employee: {
        id: updated.id,
        bankName: updated.bankName,
        accountNumber: updated.accountNumber,
        accountName: updated.accountName,
        salaryBankName: updated.salaryBankName,
        salaryAccountNumber: updated.salaryAccountNumber,
        salaryAccountName: updated.salaryAccountName,
      },
    });
  } catch (error) {
    console.error('Failed to update banking accounts:', error);
    return NextResponse.json({ error: 'Could not update banking accounts.' }, { status: 500 });
  }
}
