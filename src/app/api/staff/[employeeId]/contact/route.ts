import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) {
      return NextResponse.json({ error: 'Sign in to update profile contact details.' }, { status: 401 });
    }

    const { employeeId } = await params;
    const isOwner = actor.id === employeeId;
    const isPrivileged = actor.role === 'GMD' || actor.role === 'SYSTEM_ADMIN';
    if (!isOwner && !isPrivileged) {
      return NextResponse.json({ error: 'Forbidden. You can only update your own profile details.' }, { status: 403 });
    }

    const body = await request.json();

    const phone = typeof body.phone === 'string' ? body.phone.trim() : null;
    const avatarUrl = typeof body.avatarUrl === 'string' ? body.avatarUrl.trim() : null;

    if (!phone && !avatarUrl) {
      return NextResponse.json({ error: 'Provide a valid telephone number or passport photograph URL.' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
    }

    const updateData: any = {};
    if (phone && phone.length >= 8) updateData.phone = phone;
    if (avatarUrl && avatarUrl.length > 5) updateData.avatarUrl = avatarUrl;

    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      phone: updated.phone,
      avatarUrl: updated.avatarUrl,
      message: 'Staff profile updated successfully.',
    });
  } catch (error) {
    console.error('Failed to update phone number:', error);
    return NextResponse.json({ error: 'Could not update contact phone number.' }, { status: 500 });
  }
}
