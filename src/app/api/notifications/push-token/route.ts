import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const actor = await getAuthenticatedEmployee(request);
  if (!actor) {
    return NextResponse.json({ error: 'Sign in to register device push token.' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const platform = typeof body.platform === 'string' ? body.platform.toUpperCase() : 'ANDROID';
    const deviceModel = typeof body.deviceModel === 'string' ? body.deviceModel.trim().slice(0, 100) : null;

    if (!token || token.length < 10) {
      return NextResponse.json({ error: 'Valid device push token is required.' }, { status: 400 });
    }

    const deviceToken = await prisma.devicePushToken.upsert({
      where: { token },
      update: {
        employeeId: actor.id,
        platform: ['ANDROID', 'IOS', 'WEB'].includes(platform) ? platform : 'ANDROID',
        deviceModel,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        employeeId: actor.id,
        token,
        platform: ['ANDROID', 'IOS', 'WEB'].includes(platform) ? platform : 'ANDROID',
        deviceModel,
        isActive: true,
      },
    });

    return NextResponse.json({
      ok: true,
      deviceTokenId: deviceToken.id,
      registeredAt: deviceToken.updatedAt,
    });
  } catch (error: any) {
    console.error('[DevicePushToken Error]:', error);
    return NextResponse.json({ error: 'Could not register push token.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const actor = await getAuthenticatedEmployee(request);
  if (!actor) {
    return NextResponse.json({ error: 'Sign in to unregister device push token.' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';

    if (token) {
      await prisma.devicePushToken.deleteMany({
        where: { token, employeeId: actor.id },
      });
    } else {
      await prisma.devicePushToken.deleteMany({
        where: { employeeId: actor.id },
      });
    }

    return NextResponse.json({ ok: true, unregistered: true });
  } catch (error: any) {
    console.error('[DevicePushToken Delete Error]:', error);
    return NextResponse.json({ error: 'Could not unregister push token.' }, { status: 500 });
  }
}

