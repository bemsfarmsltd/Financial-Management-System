import { hasGmdFeatureAccess } from '@/lib/gmd-access';
import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';
import { prisma } from '@/lib/prisma';

const EMERGENCY_CAP_NAIRA = 1_000_000;

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req, { allowServiceToken: true });
    if (actor && !hasGmdFeatureAccess(actor.role)) return NextResponse.json({ok:false,error_code:'GMD_AI_ONLY',message:'AI access requires GMD or an authorized Super Admin.'},{status:403});
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only the Group Managing Director or Super Admin can stage an emergency override.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      mode: rawMode,
      request_id,
      requestId,
      subsidiary_id,
      subsidiaryId,
      title,
      amount: rawAmount,
      justification: rawJustification,
    } = body;

    const targetRequestId = String(request_id || requestId || '').trim();
    const mode = String(
      rawMode || (targetRequestId ? 'OVERRIDE_EXISTING_REQUEST' : 'DECLARE_NEW_EMERGENCY')
    )
      .toUpperCase()
      .trim();

    const justification = String(rawJustification || '').trim();
    if (!justification || justification.length < 5) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'JUSTIFICATION_REQUIRED',
          message: 'An explicit justification (at least 5 characters) is required for any emergency declaration or override.',
        },
        { status: 400 }
      );
    }

    if (mode === 'DECLARE_NEW_EMERGENCY') {
      const subQuery = String(subsidiary_id || subsidiaryId || '').trim();
      const cleanTitle = String(title || '').trim();
      const amountNum = Number(rawAmount);

      if (!subQuery || !cleanTitle || isNaN(amountNum)) {
        return NextResponse.json(
          {
            ok: false,
            error_code: 'VALIDATION_FAILED',
            message: 'subsidiary_id, title, justification, and amount are required to declare a new emergency.',
          },
          { status: 400 }
        );
      }

      if (amountNum <= 0 || amountNum > EMERGENCY_CAP_NAIRA) {
        return NextResponse.json(
          {
            ok: false,
            error_code: 'EMERGENCY_CAP_EXCEEDED',
            message: `Emergency declaration amount (₦${amountNum.toLocaleString()}) must be positive and cannot exceed the ₦1,000,000 cap.`,
          },
          { status: 422 }
        );
      }

      const org = await prisma.organization.findFirst({
        where: {
          OR: [
            { id: subQuery },
            { code: { equals: subQuery, mode: 'insensitive' } },
            { legalName: { equals: subQuery, mode: 'insensitive' } },
          ],
        },
      });
      if (!org) {
        return NextResponse.json(
          { ok: false, error_code: 'SUBSIDIARY_NOT_FOUND', message: `Subsidiary "${subQuery}" not found.` },
          { status: 404 }
        );
      }

      const amountFormatted = `₦${amountNum.toLocaleString()}`;
      const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
        actionType: 'emergency_override',
        targetSubsidiaryId: org.id,
        materialPayload: {
          mode: 'DECLARE_NEW_EMERGENCY',
          subsidiary_id: org.id,
          title: cleanTitle,
          justification,
          amount: amountNum,
          amount_minor: Math.round(amountNum * 100),
        },
        summary: `Declare New Emergency Override (${amountFormatted}) for ${org.legalName}: ${cleanTitle}`,
        preview: {
          mode: 'DECLARE_NEW_EMERGENCY',
          title: cleanTitle,
          amount: amountFormatted,
          subsidiary: org.legalName,
          justification,
          accountability_sla: '24 Hours Mandatory Retirement',
        },
      });
      return NextResponse.json(staged);
    }

    if (mode !== 'OVERRIDE_EXISTING_REQUEST') {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'INVALID_MODE',
          message: 'mode must be DECLARE_NEW_EMERGENCY or OVERRIDE_EXISTING_REQUEST.',
        },
        { status: 400 }
      );
    }

    if (!targetRequestId) {
      return NextResponse.json(
        { ok: false, error_code: 'VALIDATION_FAILED', message: 'request_id is required to override an existing request.' },
        { status: 400 }
      );
    }

    const reqItem = await prisma.expenditureRequest.findFirst({
      where: { OR: [{ id: targetRequestId }, { requestNumber: targetRequestId }] },
      include: { requester: true, subsidiary: true },
    });

    if (!reqItem) {
      return NextResponse.json({ ok: false, error_code: 'NOT_FOUND', message: `Request ${targetRequestId} not found.` }, { status: 404 });
    }

    if (!['SUBMITTED', 'IN_REVIEW', 'CLARIFICATION_REQUESTED'].includes(reqItem.approvalStatus)) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'INVALID_REQUEST_STATE',
          message: `Request ${reqItem.requestNumber} is already ${reqItem.approvalStatus} and cannot be overridden.`,
        },
        { status: 409 }
      );
    }

    const reqAmountNaira = Number(reqItem.amountMinor) / 100;
    if (reqAmountNaira <= 0 || reqAmountNaira > EMERGENCY_CAP_NAIRA) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'EMERGENCY_CAP_EXCEEDED',
          message: `Request ${reqItem.requestNumber} amount (₦${reqAmountNaira.toLocaleString()}) exceeds the ₦1,000,000 emergency override cap. Use the standard approval flow instead.`,
        },
        { status: 422 }
      );
    }

    if (
      rawAmount !== undefined &&
      rawAmount !== null &&
      Math.abs(Number(rawAmount) - reqAmountNaira) > 0.01
    ) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'AMOUNT_MISMATCH',
          message: `Supplied amount (₦${Number(rawAmount).toLocaleString()}) does not match request ${reqItem.requestNumber} amount (₦${reqAmountNaira.toLocaleString()}).`,
        },
        { status: 409 }
      );
    }

    const amountFormatted = `₦${reqAmountNaira.toLocaleString()}`;

    const staged = await stageAction({
          actorContext: actor,
          userId: actor.id,
      actionType: 'emergency_override',
      targetSubsidiaryId: reqItem.subsidiaryId,
      materialPayload: {
        mode: 'OVERRIDE_EXISTING_REQUEST',
        request_id: reqItem.id,
        request_number: reqItem.requestNumber,
        justification,
        amount: reqAmountNaira,
        amount_minor: Number(reqItem.amountMinor),
        expected_version: reqItem.requestVersion,
      },
      summary: `GMD Emergency Override: Authorize immediate payout for ${reqItem.requestNumber} (${amountFormatted})`,
      preview: {
        mode: 'OVERRIDE_EXISTING_REQUEST',
        request_number: reqItem.requestNumber,
        title: reqItem.title,
        amount: amountFormatted,
        requester: reqItem.requester?.legalName || 'Staff',
        subsidiary: reqItem.subsidiary?.legalName || 'BEMS Group',
        justification,
        accountability_sla: '24 Hours Mandatory Retirement',
        action: 'BYPASS_INTERMEDIATE_APPROVALS',
      },
    });

    return NextResponse.json(staged);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
