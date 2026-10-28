import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createEmployeeSession, hashPassword, publicEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendAdminVerificationOtpEmail } from '@/lib/email';

const DEFAULT_FALLBACK_SECRET = 'bemsgroup11223355!';

function getBootstrapSecret(): string {
  return process.env.BEMS_BOOTSTRAP_SECRET || DEFAULT_FALLBACK_SECRET;
}

export async function POST(request: Request) {
  const bootstrapSecret = getBootstrapSecret();
  try {
    const body = await request.json();
    if (typeof body.bootstrapSecret !== 'string' || body.bootstrapSecret.trim() !== bootstrapSecret) {
      return NextResponse.json({ error: 'Setup key is invalid. Enter the master bootstrap secret.' }, { status: 401 });
    }

    const adminExists = await prisma.employee.findFirst({
      where: { role: 'SYSTEM_ADMIN' },
      select: { id: true },
    });

    if (adminExists) {
      return NextResponse.json({ error: 'Initial System Admin setup has already been completed.' }, { status: 409 });
    }

    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const action = body.action || (body.code ? 'verify' : 'send_code');

    if (fullName.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Provide a valid name and work email address.' }, { status: 400 });
    }

    // ACTION 1: SEND VERIFICATION CODE
    if (action === 'send_code') {
      const password = typeof body.password === 'string' ? body.password : '';
      if (password.length < 10) {
        return NextResponse.json({ error: 'Password must have at least 10 characters.' }, { status: 400 });
      }

      // Generate 6-digit numeric OTP
      const code = crypto.randomInt(100000, 999999).toString();
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Invalidate existing tokens for this email and save new token
      await prisma.emailVerificationToken.deleteMany({ where: { email } });
      await prisma.emailVerificationToken.create({
        data: {
          email,
          codeHash,
          expiresAt,
          attempts: 0,
        },
      });

      console.log(`[BOOTSTRAP OTP] Verification code for ${email}: ${code} (expires in 10m)`);

      // Send email via Resend
      const emailResult = await sendAdminVerificationOtpEmail({
        email,
        fullName,
        code,
      });

      if (!emailResult.success && !emailResult.simulated) {
        console.warn('[BOOTSTRAP OTP] Email delivery warning:', emailResult.error);
      }

      return NextResponse.json({
        ok: true,
        message: `A 6-digit verification code has been sent to ${email}.`,
      });
    }

    // ACTION 2: VERIFY CODE AND CREATE ADMIN
    if (action === 'verify') {
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';

      if (!code || code.length !== 6) {
        return NextResponse.json({ error: 'Enter the 6-digit verification code.' }, { status: 400 });
      }
      if (password.length < 10) {
        return NextResponse.json({ error: 'Password must have at least 10 characters.' }, { status: 400 });
      }

      const tokenRecord = await prisma.emailVerificationToken.findFirst({
        where: { email },
        orderBy: { createdAt: 'desc' },
      });

      if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
        return NextResponse.json({
          error: 'Verification code has expired or is invalid. Please click resend to receive a fresh code.',
        }, { status: 400 });
      }

      if (tokenRecord.attempts >= 5) {
        return NextResponse.json({
          error: 'Too many incorrect attempts. Please request a new verification code.',
        }, { status: 429 });
      }

      const submittedHash = crypto.createHash('sha256').update(code).digest('hex');
      if (submittedHash !== tokenRecord.codeHash) {
        await prisma.emailVerificationToken.update({
          where: { id: tokenRecord.id },
          data: { attempts: { increment: 1 } },
        });
        return NextResponse.json({ error: 'Incorrect verification code. Please check your email and try again.' }, { status: 400 });
      }

      // Valid OTP verified! Clean up token
      await prisma.emailVerificationToken.deleteMany({ where: { email } });

      if (await prisma.employee.findUnique({ where: { workEmail: email }, select: { id: true } })) {
        return NextResponse.json({ error: 'An account already exists for this email.' }, { status: 409 });
      }

      const employee = await prisma.employee.create({
        data: {
          employeeNumber: `ADM-${Date.now().toString().slice(-4)}`,
          legalName: fullName,
          workEmail: email,
          role: 'SYSTEM_ADMIN',
          status: 'ACTIVE',
          approvalStatus: 'APPROVED',
          passwordHash: await hashPassword(password),
        },
      });

      await createEmployeeSession(employee.id);
      return NextResponse.json({ user: publicEmployee(employee), message: 'System Admin account created and verified.' }, { status: 201 });
    }

    return NextResponse.json({ error: 'Unknown action specified.' }, { status: 400 });
  } catch (error) {
    console.error('Bootstrap error:', error);
    return NextResponse.json({ error: 'Could not complete the System Admin setup.' }, { status: 500 });
  }
}

export async function GET() {
  const exists = await prisma.employee.findFirst({
    where: { role: 'SYSTEM_ADMIN' },
    select: { id: true },
  });
  return NextResponse.json({
    available: !exists,
    configured: true,
    adminExists: Boolean(exists),
  });
}
