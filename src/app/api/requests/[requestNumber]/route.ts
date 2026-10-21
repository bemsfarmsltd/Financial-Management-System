import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedEmployee } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ requestNumber?: string; id?: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee();
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
          name: expenditure.subsidiary.name,
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
