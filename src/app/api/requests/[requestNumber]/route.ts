import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedEmployee } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ requestNumber?: string; id?: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    const resolvedParams = await params;
    const id = resolvedParams.requestNumber || resolvedParams.id;

    if (!id) {
      return NextResponse.json({ error: "Request identifier is required." }, { status: 400 });
    }

    // Lookup by ID or by requestNumber (e.g. REQ-2026-0042)
    const expenditure = await prisma.expenditureRequest.findFirst({
      where: {
        OR: [
          { id: id },
          { requestNumber: id },
          { requestNumber: id.toUpperCase() },
        ],
      },
      include: {
        subsidiary: true,
        requester: {
          select: {
            id: true,
            employeeNumber: true,
            legalName: true,
            workEmail: true,
            phone: true,
            role: true,
            jobTitle: true,
          },
        },
        vendor: true,
        approvalSteps: {
          orderBy: { stageIndex: "asc" },
        },
        disbursements: true,
        attachments: true,
        accountabilityCase: true,
      },
    });

    if (!expenditure) {
      return NextResponse.json(
        { error: `Fund request '${id}' not found.`, code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const amountNaira = Number(expenditure.amountMinor) / 100;

    // Compute budget impact if department/subsidiary budget exists
    let budgetImpact = null;
    try {
      const budget = await prisma.budget.findFirst({
        where: {
          organizationId: expenditure.subsidiaryId,
        },
        include: { lines: true },
      });
      if (budget) {
        const totalAllocated = Number(budget.totalAmountMinor) / 100;
        budgetImpact = {
          budgetId: budget.id,
          totalAllocated,
          currency: budget.currency,
          impactAmount: amountNaira,
          status: budget.status,
        };
      }
    } catch {
      // Non-blocking budget impact calculation
    }

    return NextResponse.json({
      request: {
        id: expenditure.id,
        requestNumber: expenditure.requestNumber,
        title: expenditure.title,
        amount: amountNaira,
        amountMinor: Number(expenditure.amountMinor),
        currency: expenditure.currency,
        category: expenditure.category,
        justification: expenditure.justification,
        deliverable: expenditure.deliverable,
        neededBy: expenditure.neededBy,
        approvalStatus: expenditure.approvalStatus,
        paymentStatus: expenditure.paymentStatus,
        accountabilityStatus: expenditure.accountabilityStatus,
        createdAt: expenditure.createdAt,
        updatedAt: expenditure.updatedAt,
        subsidiary: expenditure.subsidiary ? {
          id: expenditure.subsidiary.id,
          name: expenditure.subsidiary.legalName,
          legalName: expenditure.subsidiary.legalName,
          code: expenditure.subsidiary.code,
        } : null,
        requester: expenditure.requester,
        vendor: expenditure.vendor ? {
          id: expenditure.vendor.id,
          name: expenditure.vendor.name,
          code: expenditure.vendor.code,
          category: expenditure.vendor.category,
          accountNumber: expenditure.vendor.accountNumber,
          bankName: expenditure.vendor.bankName,
        } : null,
        approvalSteps: expenditure.approvalSteps.map((step) => ({
          stageIndex: step.stageIndex,
          assignedRole: step.assignedRole,
          approverName: step.approverName,
          status: step.status,
          decisionReason: step.decisionReason,
          decidedAt: step.decidedAt,
        })),
        disbursements: expenditure.disbursements.map((d) => ({
          id: d.id,
          amountPaid: Number(d.amountMinor) / 100,
          currency: d.currency,
          reference: d.externalReference,
          bankName: d.bankName,
          beneficiaryName: d.beneficiaryName,
          beneficiaryBank: d.beneficiaryBank,
          beneficiaryAccount: d.beneficiaryAccount,
          disbursedAt: d.paidAt,
          status: d.status,
        })),
        evidenceCount: expenditure.attachments.length,
        accountability: expenditure.accountabilityCase ? {
          id: expenditure.accountabilityCase.id,
          status: expenditure.accountabilityCase.status,
        } : null,
        budgetImpact,
      },
    });
  } catch (error: any) {
    console.error("Error retrieving fund request detail:", error);
    return NextResponse.json({ error: error.message || "Failed to retrieve fund request detail" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ requestNumber?: string; id?: string }> }
) {
  try {
    let actor = await getAuthenticatedEmployee(request);
    if (!actor) {
      const fallbackEmpId = request.headers.get("x-employee-id");
      if (fallbackEmpId) {
        const emp = await prisma.employee.findUnique({
          where: { id: fallbackEmpId },
          select: { id: true, employeeNumber: true, legalName: true, workEmail: true, role: true, status: true, approvalStatus: true },
        });
        if (emp && emp.status === "ACTIVE" && emp.approvalStatus === "APPROVED") {
          actor = emp as any;
        }
      }
    }

    if (!actor) {
      return NextResponse.json({ error: "Unauthorized. Please sign in to delete request." }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = resolvedParams.requestNumber || resolvedParams.id;
    if (!id) {
      return NextResponse.json({ error: "Request identifier is required." }, { status: 400 });
    }

    const expenditure = await prisma.expenditureRequest.findFirst({
      where: {
        OR: [
          { id: id },
          { requestNumber: id },
          { requestNumber: id.toUpperCase() },
        ],
      },
      include: {
        approvalSteps: true,
        channel: true,
        disbursements: true,
      },
    });

    if (!expenditure) {
      return NextResponse.json({ error: `Fund request '${id}' not found.` }, { status: 404 });
    }

    // Authorization: Only owner or Executive Admin/GMD
    const isOwner = expenditure.requestedById === actor.id;
    const isExecutiveAdmin = ["SYSTEM_ADMIN", "GMD"].includes(actor.role);
    if (!isOwner && !isExecutiveAdmin) {
      return NextResponse.json({ error: "Permission denied. You can only delete your own fund requests." }, { status: 403 });
    }

    // Business Rules: Staff cannot delete once admin approve
    if (expenditure.approvalStatus === "APPROVED") {
      return NextResponse.json(
        { error: "Cannot delete request: This requisition has already been approved by Admin/Management." },
        { status: 400 }
      );
    }

    const hasApprovedStep = expenditure.approvalSteps.some((s) => s.status === "APPROVED");
    if (hasApprovedStep) {
      return NextResponse.json(
        { error: "Cannot delete request: Approval workflow has already commenced and been signed off." },
        { status: 400 }
      );
    }

    if (expenditure.paymentStatus !== "UNPAID" || expenditure.disbursements.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete request: Funds have already been scheduled or disbursed." },
        { status: 400 }
      );
    }

    // Cascading deletion inside transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete Channel Messages and Followup Tasks
      if (expenditure.channel) {
        await tx.channelMessage.deleteMany({
          where: { channelId: expenditure.channel.id },
        });
        await tx.followupTask.deleteMany({
          where: { channelId: expenditure.channel.id },
        });
        await tx.requestChannel.delete({
          where: { id: expenditure.channel.id },
        });
      }

      // 2. Delete Approval Steps
      await tx.approvalStep.deleteMany({
        where: { requestId: expenditure.id },
      });

      // 3. Delete Attachments
      await tx.attachment.deleteMany({
        where: {
          OR: [
            { requestId: expenditure.id },
            { ownerType: "EXPENDITURE_REQUEST", ownerId: expenditure.id },
          ],
        },
      });

      // 4. Delete Accountability Case if any
      await tx.accountabilityCase.deleteMany({
        where: { requestId: expenditure.id },
      });

      // 5. Delete the Expenditure Request
      await tx.expenditureRequest.delete({
        where: { id: expenditure.id },
      });

      // 6. Log audit event
      await tx.auditEvent.create({
        data: {
          actorId: actor!.id,
          actorName: actor!.legalName,
          actorRole: actor!.role,
          groupId: expenditure.groupId,
          subsidiaryId: expenditure.subsidiaryId,
          targetType: "REQUEST",
          targetId: expenditure.id,
          action: "DELETED",
          correlationId: expenditure.requestNumber,
          metadata: JSON.stringify({
            requestNumber: expenditure.requestNumber,
            amountMinor: Number(expenditure.amountMinor),
            deletedBy: actor!.legalName,
            deletedAt: new Date().toISOString(),
          }),
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Fund requisition ${expenditure.requestNumber} was successfully deleted.`,
      requestNumber: expenditure.requestNumber,
    });
  } catch (error: any) {
    console.error("Error deleting fund request:", error);
    return NextResponse.json({ error: error.message || "Failed to delete fund request" }, { status: 500 });
  }
}
