import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, invalidateSessionCache } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Please provide a valid work email address.' }, { status: 400 });
    }

    const rateKey = `reset-pwd:${clientIp}:${email}`;
    const rateCheck = checkRateLimit(rateKey, {
      windowMs: 15 * 60 * 1000,
      maxAttempts: 5,
      blockDurationMs: 15 * 60 * 1000,
    });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many password reset attempts. Please wait 15 minutes before trying again.' },
        { status: 429 }
      );
    }

    if (!code || code.length < 6) {
      return NextResponse.json({ error: 'Please enter the 6-digit verification code sent to your email.' }, { status: 400 });
    }

    if (!newPassword || newPassword.length < 10) {
      return NextResponse.json({ error: 'New password must be at least 10 characters long.' }, { status: 400 });
    }

    const [employee, tokenRecord] = await Promise.all([
      prisma.employee.findUnique({ where: { workEmail: email } }),
      prisma.emailVerificationToken.findFirst({
        where: { email },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (
      !employee ||
      employee.approvalStatus !== 'APPROVED' ||
      employee.status !== 'ACTIVE' ||
      !tokenRecord ||
      tokenRecord.expiresAt < new Date() ||
      tokenRecord.attempts >= 5
    ) {
      return NextResponse.json(
        { error: 'Verification code is invalid or has expired. Please request a fresh reset code.' },
        { status: 400 }
      );
    }

    const submittedHash = crypto.createHash('sha256').update(code).digest('hex');
    const submittedBuf = Buffer.from(submittedHash, 'utf8');
    const storedBuf = Buffer.from(tokenRecord.codeHash, 'utf8');
    const isCodeValid =
      submittedBuf.length === storedBuf.length &&
      crypto.timingSafeEqual(submittedBuf, storedBuf);

    if (!isCodeValid) {
      await prisma.emailVerificationToken.update({
        where: { id: tokenRecord.id },
        data: { attempts: { increment: 1 } },
      });
      return NextResponse.json(
        { error: 'Verification code is invalid or has expired. Please request a fresh reset code.' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);

    // Consume single-use token, update password, and revoke all existing sessions atomically
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.emailVerificationToken.deleteMany({
        where: { id: tokenRecord.id, email },
      });
      if (consumed.count === 0) {
        throw new Error('Verification code has already been consumed.');
      }

      await tx.emailVerificationToken.deleteMany({ where: { email } });

      await tx.employee.update({
        where: { id: employee.id },
        data: { passwordHash },
      });

      await tx.authSession.deleteMany({
        where: { employeeId: employee.id },
      });
    });

    invalidateSessionCache();

    return NextResponse.json({
      success: true,
      message: 'Your password has been successfully reset and prior sessions have been revoked. You may now sign in.',
    });
  } catch (error: any) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'Failed to reset password. Please try again.' }, { status: 400 });
  }
}
