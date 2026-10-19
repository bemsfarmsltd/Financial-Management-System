'use client';

import React from 'react';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { FundFlowWorkspace } from '@/components/dashboard/gmd/FundFlowWorkspace';

export default function FundFlowPage() {
  return (
    <ConnectAppShell>
      <FundFlowWorkspace
        businessName="BEMS Group Holdings Ltd"
        userName="Group Managing Director"
        onNavigate={(path) => { window.location.href = path; }}
        onSelectBusiness={() => {}}
      />
    </ConnectAppShell>
  );
}
