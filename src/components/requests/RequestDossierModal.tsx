'use client';

import React, { useState } from 'react';
import { RequestChatModal } from './RequestChatModal';
import { ExecutiveRequisitionModal, RequisitionModalData } from './ExecutiveRequisitionModal';

export type RequestDossier = RequisitionModalData;

export function RequestDossierModal({ request, onClose }: { request: RequestDossier; onClose: () => void }) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <ExecutiveRequisitionModal
        request={request}
        onClose={onClose}
        onRequestChat={() => setChatOpen(true)}
        canDecide={false}
      />

      {chatOpen && (
        <RequestChatModal
          requestNumber={request.requestNumber}
          title={request.title}
          initialMessages={request.recentMessages || []}
          onClose={() => setChatOpen(false)}
        />
      )}
    </>
  );
}
