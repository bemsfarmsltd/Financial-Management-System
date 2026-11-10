import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { verifyPassword } from '@/lib/auth';
import { canApproveWalletRelease } from '@/lib/gmd-access';
import { prisma } from '@/lib/prisma';
import { accountabilityDeadline } from '@/lib/services/accountability-deadline';
import { sendApprovalDecisionEmail } from '@/lib/email';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request, { disallowServiceToken: true });
    if (!actor) {
      return NextResponse.json({ error: 'Sign in to authorize wallet fund release.' }, { status: 401 });
    }

    if (!canApproveWalletRelease(actor)) {
      return NextResponse.json(
        { error: 'Only the Group Managing Director or an authorized executive can release funds.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const requestId = String(body.requestId || '').trim();
    const password = String(body.password || '').trim();
    const note = String(body.note || '').trim();

    if (!requestId) {
      return NextResponse.json({ error: 'Requisition ID is required.' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json(
        { error: 'Enter your current executive password to authorize release.' },
        { status: 400 }
      );
    }

    // Verify executive password
    const employee = await prisma.employee.findUnique({ where: { id: actor.id } });
    if (!employee || !employee.passwordHash) {
      return NextResponse.json({ error: 'Account credentials not verified.' }, { status: 401 });
    }

    const passwordValid = await verifyPassword(password, employee.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Incorrect executive password. Release authorization rejected.' },
        { status: 401 }
      );
    }

    // Fetch requisition with requester & subsidiary
    const req = await prisma.expenditureRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: true,
        subsidiary: true,
        vendor: true,
      },
    });

    if (!req) {
      return NextResponse.json({ error: 'Requisition not found.' }, { status: 404 });
    }

    if (req.paymentStatus === 'WALLET_CREDITED') {
      return NextResponse.json(
        { error: `Requisition ${req.requestNumber} has already been credited to the staff wallet.` },
        { status: 409 }
      );
    }

    if (req.requester.role !== 'STAFF' && !req.vendorId) {
      return NextResponse.json(
        { error: 'Wallet funding is strictly for staff. Administrators and executives do not hold wallets.' },
        { status: 400 }
      );
    }

    // Atomic execution of release to staff wallet
    const result = await prisma.$transaction(async (tx) => {
      // 1. Resolve active subsidiary funded budget envelope
      const [envelope] = await tx.$queryRaw<any[]>`
        SELECT * FROM "WalletBudgetEnvelope"
        WHERE "organizationId" = ${req.subsidiaryId}
          AND "status" = 'ACTIVE'
        ORDER BY "remainingMinor" DESC, "createdAt" ASC
        LIMIT 1
      `;

      if (!envelope) {
        throw new Error(
          `NO_BUDGET_ENVELOPE:No active funded budget envelope exists for ${req.subsidiary.legalName || 'this subsidiary'}. An executive must allocate a funded budget envelope before releasing funds.`
        );
      }

      if (BigInt(envelope.remainingMinor) < req.amountMinor) {
        const availableFormatted = '₦' + (Number(envelope.remainingMinor) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 });
        const requiredFormatted = '₦' + (Number(req.amountMinor) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 });
        throw new Error(
          `INSUFFICIENT_BUDGET_BUFFER:Insufficient funded budget in envelope "${envelope.label}". Available: ${availableFormatted}, Required: ${requiredFormatted}. Please top up or allocate additional funded budget before releasing funds.`
        );
      }

      // 2. Decrement envelope capacity
      await tx.$executeRaw`
        UPDATE "WalletBudgetEnvelope"
        SET "remainingMinor" = "remainingMinor" - ${req.amountMinor},
            "version" = "version" + 1
        WHERE "id" = ${envelope.id} AND "remainingMinor" >= ${req.amountMinor}
      `;

      // 3. Create Credit Lot for Staff Wallet
      const creditId = randomUUID();
      const proposalId = randomUUID();
      const category = req.requestType === 'REIMBURSEMENT' ? 'REIMBURSEMENT' : 'REQUEST';

      await tx.$executeRaw`
        INSERT INTO "WalletCreditLot" (
          "id", "proposalId", "requestId", "sourceType", "sourceId",
          "employeeId", "organizationId", "category", "amountMinor", "availableMinor"
        ) VALUES (
          ${creditId}, ${proposalId}, ${req.id}, 'REQUEST', ${req.id},
          ${req.requestedById}, ${req.subsidiaryId}, ${category}, ${req.amountMinor}, ${req.amountMinor}
        )
      `;

      // 4. Record WalletReleaseProposal
      await tx.$executeRaw`
        INSERT INTO "WalletReleaseProposal" (
          "id", "createdById", "sourceType", "sourceId", "envelopeId", "employeeId",
          "amountMinor", "category", "sourceHash", "confirmationHash", "expiresAt",
          "status", "approvedById", "approvedAt"
        ) VALUES (
          ${proposalId}, ${actor.id}, 'REQUEST', ${req.id}, ${envelope.id}, ${req.requestedById},
          ${req.amountMinor}, ${category}, ${'REQUEST:' + req.id}, ${'executed'}, now(),
          'EXECUTED', ${actor.id}, now()
        )
      `;

      // 5. Mark Paid Source to prevent duplicate releases
      await tx.$executeRaw`
        INSERT INTO "WalletPaidSource" ("key", "proposalId")
        VALUES (${'REQUEST:' + req.id}, ${proposalId})
        ON CONFLICT DO NOTHING
      `;

      // 6. Record Double-Entry Journal
      const journalId = randomUUID();
      const journalRef = `WLT-REL-${req.requestNumber}-${Date.now().toString().slice(-6)}`;
      await tx.$executeRaw`
        INSERT INTO "WalletJournal" ("id", "kind", "reference", "actorId")
        VALUES (${journalId}, 'WALLET_CREDITED', ${journalRef}, ${actor.id})
      `;
      await tx.$executeRaw`
        INSERT INTO "WalletJournalEntry" ("id", "journalId", "accountKey", "amountMinor")
        VALUES
          (${randomUUID()}, ${journalId}, ${'ENVELOPE:' + envelope.id}, ${-req.amountMinor}),
          (${randomUUID()}, ${journalId}, ${'STAFF:' + req.requestedById + ':' + category}, ${req.amountMinor})
      `;

      // 7. Update ExpenditureRequest Status
      await tx.expenditureRequest.update({
        where: { id: req.id },
        data: {
          approvalStatus: 'APPROVED',
          paymentStatus: 'WALLET_CREDITED',
          requestVersion: { increment: 1 },
        },
      });

      // 8. Update Pending ApprovalSteps
      await tx.approvalStep.updateMany({
        where: { requestId: req.id, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          approverId: actor.id,
          approverName: `${actor.legalName} (GMD)`,
          decisionReason: note || 'Authorized and released to staff internal wallet.',
          decidedAt: new Date(),
        },
      });

      // 9. Initialize Accountability Case (if not reimbursement)
      if (req.requestType !== 'REIMBURSEMENT') {
        const dueAt = await accountabilityDeadline(req.subsidiaryId, req.requestType === 'EMERGENCY', new Date(), tx);
        await tx.accountabilityCase.upsert({
          where: { requestId: req.id },
          update: {},
          create: {
            requestId: req.id,
            ownerUserId: req.requestedById,
            requiredDeliverables: req.deliverable || 'Receipts and expenditure proof',
            dueAt,
          },
        });
      }

      // 10. In-App Notification for Beneficiary Staff
      const formattedAmount = (Number(req.amountMinor) / 100).toLocaleString('en-NG', {
        style: 'currency',
        currency: 'NGN',
      });
      await tx.systemNotification.create({
        data: {
          employeeId: req.requestedById,
          kind: 'WALLET_CREDITED',
          title: 'Approved funds added to your wallet',
          body: `${formattedAmount} has been credited to your internal wallet for "${req.title}". You can withdraw to your verified bank account at any time.`,
          linkUrl: '/wallet',
        },
      });

      // 11. Audit Event
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          actorName: actor.legalName,
          actorRole: actor.role,
          groupId: req.subsidiary.parentGroupId || req.subsidiary.id,
          subsidiaryId: req.subsidiary.id,
          targetType: 'WALLET_CREDIT',
          targetId: creditId,
          action: 'GMD_WALLET_RELEASED',
          correlationId: proposalId,
          metadata: JSON.stringify({
            requestId: req.id,
            requestNumber: req.requestNumber,
            amountMinor: req.amountMinor.toString(),
            staffName: req.requester.legalName,
            staffNumber: req.requester.employeeNumber,
            staffWalletNumber: `WLT-${req.requester.employeeNumber}`,
            envelopeId: envelope.id,
            note,
          }),
        },
      });

      return {
        creditId,
        envelopeLabel: envelope.label,
        remainingEnvelopeMinor: (BigInt(envelope.remainingMinor) - req.amountMinor).toString(),
      };
    });

    const formattedAmount = (Number(req.amountMinor) / 100).toLocaleString('en-NG', {
      style: 'currency',
      currency: 'NGN',
    });

    // Real-time email notification to requester
    if (req.requester?.workEmail) {
      sendApprovalDecisionEmail({
        to: req.requester.workEmail,
        recipientName: req.requester.legalName,
        decision: 'APPROVED',
        decidedBy: `${actor.legalName} (GMD)`,
        decidedByRole: actor.role,
        requestNumber: req.requestNumber,
        title: req.title,
        amountMinor: Number(req.amountMinor),
        reason: note || 'Authorized by GMD and credited to internal wallet for disbursement.',
      }).catch((emailErr) => console.error(`[Wallet Release Email Error] Requisition ${req.requestNumber}:`, emailErr));
    }

    return NextResponse.json({
      success: true,
      message: `Funds successfully credited to ${req.requester.legalName}'s internal wallet.`,
      creditId: result.creditId,
      requestNumber: req.requestNumber,
      title: req.title,
      amountFormatted: formattedAmount,
      amountMinor: req.amountMinor.toString(),
      staff: {
        id: req.requester.id,
        name: req.requester.legalName,
        employeeNumber: req.requester.employeeNumber,
        walletNumber: `WLT-${req.requester.employeeNumber}`,
        role: req.requester.role,
      },
      subsidiary: {
        id: req.subsidiary.id,
        name: req.subsidiary.legalName,
        envelopeLabel: result.envelopeLabel,
      },
      timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    });
  } catch (error: any) {
    console.error('Wallet release approval error:', error);
    const msg = error?.message || 'Failed to release funds to staff wallet.';
    if (msg.startsWith('NO_BUDGET_ENVELOPE:')) {
      return NextResponse.json(
        {
          error: msg.replace('NO_BUDGET_ENVELOPE:', ''),
          code: 'NO_BUDGET_ENVELOPE',
          allocateUrl: '/finance?tab=Wallets+%26+funded+budgets',
        },
        { status: 422 }
      );
    }
    if (msg.startsWith('INSUFFICIENT_BUDGET_BUFFER:')) {
      return NextResponse.json(
        {
          error: msg.replace('INSUFFICIENT_BUDGET_BUFFER:', ''),
          code: 'INSUFFICIENT_BUDGET_BUFFER',
          allocateUrl: '/finance?tab=Wallets+%26+funded+budgets',
        },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
