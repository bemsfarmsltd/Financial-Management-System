import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createEmployeeSession, hashPassword, publicEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendAdminVerificationOtpEmail } from '@/lib/email';

function getBootstrapSecret(): string | null {
  const secret = process.env.BEMS_BOOTSTRAP_SECRET;
  return secret && secret.trim().length >= 16 ? secret.trim() : null;
}

export async function POST(request: Request) {
  const bootstrapSecret = getBootstrapSecret();
  if (!bootstrapSecret) {
    return NextResponse.json(
      { error: 'Bootstrap configuration error: Master setup secret is not defined in server environment.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const provided = typeof body.bootstrapSecret === 'string' ? body.bootstrapSecret.trim() : '';
    const provBuf = Buffer.from(provided);
    const secBuf = Buffer.from(bootstrapSecret);

    if (provBuf.length !== secBuf.length || !crypto.timingSafeEqual(provBuf, secBuf)) {
      return NextResponse.json({ error: 'Setup key is invalid. Enter the master bootstrap secret.' }, { status: 401 });
    }

    // Check across all executive/admin roles (SYSTEM_ADMIN, SUPER_ADMIN, GMD)
    const adminExists = await prisma.employee.findFirst({
      where: { role: { in: ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'] } },
      select: { id: true },
    });

    if (adminExists) {
      return NextResponse.json({ error: 'Initial Executive / Super Admin setup has already been completed.' }, { status: 409 });
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

      if (process.env.NODE_ENV === 'development') {
        console.log(`[BOOTSTRAP OTP] Verification code sent to ${email} (expires in 10m)`);
      }

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

      // Valid OTP verified! Clean up token and atomically provision first Super Admin
      await prisma.emailVerificationToken.deleteMany({ where: { email } });

      const existingAdminNow = await prisma.employee.findFirst({
        where: { role: { in: ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'] } },
        select: { id: true },
      });
      if (existingAdminNow) {
        return NextResponse.json({ error: 'Initial Executive / Super Admin setup has already been completed.' }, { status: 409 });
      }

      if (await prisma.employee.findUnique({ where: { workEmail: email }, select: { id: true } })) {
        return NextResponse.json({ error: 'An account already exists for this email.' }, { status: 409 });
      }

      const passwordHash = await hashPassword(password);
      const employee = await prisma.$transaction(async (tx) => {
        const created = await tx.employee.create({
          data: {
            employeeNumber: `ADM-${Date.now().toString().slice(-4)}`,
            legalName: fullName,
            workEmail: email,
            role: 'SYSTEM_ADMIN',
            status: 'ACTIVE',
            approvalStatus: 'APPROVED',
            passwordHash,
          },
        });

        await tx.auditEvent.create({
          data: {
            actorId: created.id,
            actorName: created.legalName,
            actorRole: created.role,
            groupId: 'bems-group-hq',
            targetType: 'EMPLOYEE',
            targetId: created.id,
            action: 'BOOTSTRAP_ADMIN_PROVISIONED',
            metadata: JSON.stringify({ workEmail: created.workEmail }),
            correlationId: crypto.randomUUID(),
          },
        });

        return created;
      });

      await createEmployeeSession(employee.id);
      return NextResponse.json({ user: publicEmployee(employee), message: 'System Admin account created and verified.' }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid bootstrap action.' }, { status: 400 });
  } catch (error) {
    console.error('Bootstrap error:', error);
    return NextResponse.json({ error: 'Could not complete bootstrap setup.' }, { status: 500 });
  }
}
