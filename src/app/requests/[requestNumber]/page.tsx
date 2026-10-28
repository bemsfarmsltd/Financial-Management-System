import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedEmployee } from "@/lib/auth";
import { requestIdentifierWhere, toSystemRequestId } from "@/lib/request-id";
import { ConnectAppShell } from "@/components/layout/ConnectAppShell";
import { RequestChannelClient } from "./RequestChannelClient";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({
  params
}: {
  params: Promise<{ requestNumber: string }>;
}) {
  const actor = await getAuthenticatedEmployee();
  if (!actor) notFound();
  const { requestNumber } = await params;
  const request = await prisma.expenditureRequest.findUnique({
    where: requestIdentifierWhere(requestNumber),
    include: {
      subsidiary: true,
      requester: true,
      vendor: true,
      attachments: true,
      disbursements: {
        orderBy: { createdAt: 'desc' },
        include: {
          receipt: { select: { id: true, fileName: true, fileUrl: true, sha256: true, mimeType: true, uploadedAt: true } },
          recordedBy: { select: { id: true, legalName: true } },
          recipientConfirmation: { include: { employee: { select: { id: true, legalName: true } } } },
        },
      },
      approvalSteps: { orderBy: { stageIndex: "asc" }, include: { approver: true } },
      channel: {
        include: {
          messages: { where: { visibility: "GROUP" }, orderBy: { createdAt: "asc" } }
        }
      }
    }
  });

  if (!request) notFound();
  const isParticipant = request.requestedById === actor.id || request.approvalSteps.some((step) => step.approverId === actor.id);
  if (!isParticipant && actor.role !== 'GMD' && actor.role !== 'SYSTEM_ADMIN') notFound();

  const serializableRequest = JSON.parse(
    JSON.stringify(request, (_key, value) => typeof value === "bigint" ? value.toString() : value)
  );
  serializableRequest.systemId = toSystemRequestId(request.id);

  return (
    <ConnectAppShell>
      <RequestChannelClient request={serializableRequest} />
    </ConnectAppShell>
  );
}
