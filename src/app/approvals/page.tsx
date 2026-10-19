'use client';

import React from 'react';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { ApprovalsHubView } from '@/components/dashboard/gmd/ApprovalsHubView';

export default function ApprovalsPage() {
  return (
    <ConnectAppShell>
      <div style={{ padding: '4px 0' }}>
        <ApprovalsHubView
          businessName="BEMS Group Holdings Ltd"
          userName="Group Managing Director"
          onNavigate={(p) => { window.location.href = p; }}
          onSelectBusiness={() => {}}
        />
      </div>
    </ConnectAppShell>
  );
}
