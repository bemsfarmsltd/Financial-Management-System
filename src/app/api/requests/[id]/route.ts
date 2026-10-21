import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedEmployee } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getAuthenticatedEmployee();
    const { id } = await params;

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
        disbursements: {
          include: {
            bankAccount: true,
          },
        },
        attachments: true,
        accountabilityClearance: true,
      },
    });

    if (!expenditure) {
      return NextResponse.json(
        { error: `Fund request '${id}' not found.`, code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Compute budget impact if department/subsidiary budget exists
    let budgetImpact = null;
    try {
      const budget = await prisma.budget.findFirst({
        where: {
          subsidiaryId: expenditure.subsidiaryId,
          department: expenditure.category,
        },
      });
      if (budget) {
        const remaining = Number(budget.allocatedAmount) - Number(budget.spentAmount);
        budgetImpact = {
          budgetId: budget.id,
          allocatedAmount: Number(budget.allocatedAmount),
          spentAmount: Number(budget.spentAmount),
          remainingBeforeRequest: remaining,
          remainingAfterRequest: remaining - Number(expenditure.amount),
          exceedsCap: Number(expenditure.amount) > remaining,
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
        amount: Number(expenditure.amount),
        currency: expenditure.currency,
        category: expenditure.category,
        justification: expenditure.justification,
        status: expenditure.approvalStatus,
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
          accountNumber: expenditure.vendor.accountNumber,
          bankName: expenditure.vendor.bankName,
          status: expenditure.vendor.status,
        } : null,
        approvalSteps: expenditure.approvalSteps.map(step => ({
          stageIndex: step.stageIndex,
          stageName: step.stageName,
          approverRole: step.approverRole,
          status: step.status,
          approverNotes: step.approverNotes,
          actionTimestamp: step.actionTimestamp,
        })),
        disbursements: expenditure.disbursements.map(d => ({
          id: d.id,
          amountPaid: Number(d.amountPaid),
          paymentMethod: d.paymentMethod,
          reference: d.reference,
          payeeName: d.payeeName,
          disbursedAt: d.disbursedAt,
          bankAccount: d.bankAccount ? {
            bankName: d.bankAccount.bankName,
            accountNumber: d.bankAccount.accountNumber,
          } : null,
        })),
        evidenceCount: expenditure.attachments.length,
        budgetImpact,
      },
    });
  } catch (error) {
    console.error("Error retrieving fund request detail:", error);
    return NextResponse.json({ error: "Failed to retrieve fund request detail" }, { status: 500 });
  }
}
