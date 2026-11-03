import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function formatNaira(minor: bigint | number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(minor) / 100);
}

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor || !hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD', 'HR_ADMIN'])) {
      return NextResponse.json({ error: 'Authorized access required.' }, { status: 403 });
    }

    const proposals = await prisma.salaryChangeProposal.findMany({
      where: { status: 'PENDING_APPROVAL' },
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            legalName: true,
            jobTitle: true,
            isOfflineStaff: true,
            assignments: {
              include: {
                subsidiary: { select: { id: true, legalName: true } },
                department: { select: { id: true, name: true } },
              },
              take: 1,
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = proposals.map((p) => ({
      id: p.id,
      employeeId: p.employeeId,
      employeeName: p.employee.legalName,
      employeeNumber: p.employee.employeeNumber,
      jobTitle: p.employee.jobTitle || 'Staff',
      isOfflineStaff: p.employee.isOfflineStaff,
      subsidiaryName: p.employee.assignments[0]?.subsidiary?.legalName || 'BEMS Group',
      previousGrossMinor: Number(p.previousGrossMinor),
      previousGrossFormatted: formatNaira(p.previousGrossMinor),
      proposedGrossMinor: Number(p.proposedGrossMinor),
      proposedGrossFormatted: formatNaira(p.proposedGrossMinor),
      changeType: p.changeType,
      reason: p.reason,
      proposedByName: p.proposedByName,
      createdAt: p.createdAt,
    }));

    return NextResponse.json({ proposals: formatted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load salary proposals.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor || !hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Only the GMD or Super Admin can approve or reject salary proposals.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const proposalId = typeof body.proposalId === 'string' ? body.proposalId.trim() : '';
    const rawDecision = typeof body.decision === 'string' ? body.decision.toUpperCase() : '';
    const decision =
      rawDecision === 'APPROVE' || rawDecision === 'APPROVED'
        ? 'APPROVE'
        : rawDecision === 'REJECT' || rawDecision === 'REJECTED' || rawDecision === 'DECLINE' || rawDecision === 'DECLINED'
          ? 'REJECT'
          : null;
    const rejectionReason = typeof body.rejectionReason === 'string' ? body.rejectionReason.trim() : '';

    if (!proposalId || !decision) {
      return NextResponse.json({ error: 'Proposal ID and decision (APPROVE or REJECT) are required.' }, { status: 400 });
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const proposal = await tx.salaryChangeProposal.findUnique({
        where: { id: proposalId },
        include: {
          employee: {
            select: {
              id: true,
              legalName: true,
              assignments: { select: { subsidiaryId: true, departmentId: true }, take: 1 }
            }
          }
        }
      });

      if (!proposal) throw new Error('Salary proposal not found.');
      if (proposal.status !== 'PENDING_APPROVAL') throw new Error('This salary proposal has already been decided.');

      if (decision === 'REJECT') {
        const updated = await tx.salaryChangeProposal.update({
          where: { id: proposal.id },
          data: {
            status: 'REJECTED',
            decidedById: actor.id,
            decidedByName: actor.legalName,
            decisionNote: rejectionReason || 'Declined by executive review',
            decidedAt: now,
          }
        });

        await tx.systemNotification.create({
          data: {
            employeeId: proposal.proposedById,
            kind: 'SALARY_PROPOSAL_REJECTED',
            title: `Salary Proposal Declined: ${proposal.employee.legalName}`,
            body: `${actor.legalName} declined the proposed salary of ${formatNaira(proposal.proposedGrossMinor)} for ${proposal.employee.legalName}.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
            linkUrl: '/finance?tab=Staff+profiles'
          }
        });

        return { decision: 'REJECT' as const, proposal: updated, employeeName: proposal.employee.legalName };
      }

      // APPROVE: Apply to EmploymentAgreement + CompensationAgreement + CostAllocation
      const defaultOrg = proposal.employee.assignments[0]?.subsidiaryId || (await tx.organization.findFirst({ select: { id: true } }))?.id || '';

      let agreement = await tx.employmentAgreement.findFirst({
        where: { employeeId: proposal.employeeId, status: 'ACTIVE' },
        orderBy: { startDate: 'desc' },
        include: { compensations: true }
      });

      if (!agreement) {
        agreement = await tx.employmentAgreement.create({
          data: {
            employeeId: proposal.employeeId,
            employerEntityId: defaultOrg,
            agreementType: 'PERMANENT',
            paymentModel: 'GROUP_PAID',
            status: 'ACTIVE',
            startDate: now,
          },
          include: { compensations: true }
        });
      }

      const effectiveSalary = await tx.compensationAgreement.findFirst({
        where: {
          employmentAgreementId: agreement.id,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }]
        },
        orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }]
      });

      const nextVersion = Math.max(0, ...agreement.compensations.map(c => c.version)) + 1;
      if (effectiveSalary) {
        await tx.compensationAgreement.update({
          where: { id: effectiveSalary.id },
          data: { effectiveTo: new Date(now.getTime() - 1) }
        });
      }

      const compensation = await tx.compensationAgreement.create({
        data: {
          employmentAgreementId: agreement.id,
          grossMinor: proposal.proposedGrossMinor,
          currency: 'NGN',
          recurrence: 'MONTHLY',
          effectiveFrom: now,
          version: nextVersion,
          approvedBy: actor.id,
          changeType: proposal.changeType,
          changeReason: `${proposal.reason} (Proposed by ${proposal.proposedByName}, Approved by ${actor.legalName})`,
        }
      });

      await tx.costAllocation.create({
        data: {
          compensationAgreementId: compensation.id,
          subsidiaryId: defaultOrg,
          percentage: 100,
          effectiveFrom: now,
        }
      });

      const updatedProposal = await tx.salaryChangeProposal.update({
        where: { id: proposal.id },
        data: {
          status: 'APPROVED',
          decidedById: actor.id,
          decidedByName: actor.legalName,
          decidedAt: now,
        }
      });

      await tx.systemNotification.create({
        data: {
          employeeId: proposal.proposedById,
          kind: 'SALARY_PROPOSAL_APPROVED',
          title: `Salary Approved: ${proposal.employee.legalName}`,
          body: `${actor.legalName} approved ${proposal.employee.legalName}'s monthly gross salary of ${formatNaira(proposal.proposedGrossMinor)}.`,
          linkUrl: '/finance?tab=Staff+profiles'
        }
      });

      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          actorName: actor.legalName,
          actorRole: actor.role,
          groupId: defaultOrg,
          subsidiaryId: defaultOrg,
          targetType: 'PAYROLL',
          targetId: proposal.employeeId,
          action: 'SALARY_PROPOSAL_APPROVED',
          correlationId: `CORR-SAL-PROP-${randomUUID()}`,
          metadata: JSON.stringify({
            proposalId: proposal.id,
            employeeName: proposal.employee.legalName,
            previousGrossMinor: proposal.previousGrossMinor.toString(),
            proposedGrossMinor: proposal.proposedGrossMinor.toString(),
            proposedByName: proposal.proposedByName,
            compensationId: compensation.id,
          }),
        }
      });

      return {
        decision: 'APPROVE' as const,
        proposal: updatedProposal,
        employeeName: proposal.employee.legalName,
        approvedGrossFormatted: formatNaira(proposal.proposedGrossMinor),
      };
    });

    return NextResponse.json({
      success: true,
      message: result.decision === 'APPROVE'
        ? `Approved ${result.employeeName}'s salary (${result.approvedGrossFormatted}).`
        : `Declined salary proposal for ${result.employeeName}.`,
      result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Could not process salary proposal.' }, { status: 400 });
  }
}

