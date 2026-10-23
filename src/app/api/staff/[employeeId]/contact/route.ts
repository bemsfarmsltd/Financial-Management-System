import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params;
    const body = await request.json();

    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    if (!phone || phone.length < 8) {
      return NextResponse.json({ error: 'Please enter a valid telephone number.' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
    }

    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: { phone },
    });

    return NextResponse.json({
      success: true,
      phone: updated.phone,
      message: 'Contact phone number updated successfully.',
    });
  } catch (error) {
    console.error('Failed to update phone number:', error);
    return NextResponse.json({ error: 'Could not update contact phone number.' }, { status: 500 });
  }
}
