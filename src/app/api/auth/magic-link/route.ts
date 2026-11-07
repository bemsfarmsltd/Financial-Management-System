import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendAdminVerificationOtpEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

const GENERIC_RECOVERY_MESSAGE =
  'If an approved corporate account is registered for that email address, a verification code and sign-in instructions have been dispatched.';

export async function POST(request: Request) {
  try {
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Please provide a valid work email address.' }, { status: 400 });
    }

    const rateKey = `magic-link:${clientIp}:${email}`;
    const rateCheck = checkRateLimit(rateKey, {
      windowMs: 10 * 60 * 1000,
      maxAttempts: 4,
      blockDurationMs: 10 * 60 * 1000,
    });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a few minutes before requesting another code.' },
        { status: 429 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { workEmail: email },
    });

    // Only issue a single-use hashed OTP for active, approved accounts; always return a generic response to prevent account enumeration
    if (employee && employee.status === 'ACTIVE' && employee.approvalStatus === 'APPROVED') {
      const code = crypto.randomInt(100000, 999999).toString();
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await prisma.$transaction([
        prisma.emailVerificationToken.deleteMany({ where: { email } }),
        prisma.emailVerificationToken.create({
          data: {
            email,
            codeHash,
            expiresAt,
            attempts: 0,
          },
        }),
      ]);

      await sendAdminVerificationOtpEmail({
        email: employee.workEmail,
        fullName: employee.legalName,
        code,
      }).catch((err) => {
        console.warn('OTP email dispatch warning:', err);
      });
    }

    return NextResponse.json({
      success: true,
      message: GENERIC_RECOVERY_MESSAGE,
    });
  } catch (error) {
    console.error('Magic link dispatch error:', error);
    return NextResponse.json({ error: 'Could not process recovery request. Please try again.' }, { status: 500 });
  }
}
