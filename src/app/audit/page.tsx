'use client';

import React from 'react';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { IntercompanyAuditHubView } from '@/components/dashboard/gmd/IntercompanyAuditHubView';

export default function AuditPage() {
  return (
    <ConnectAppShell>
      <div style={{ padding: '4px 0' }}>
        <IntercompanyAuditHubView
          initialTab="audit"
          businessName="BEMS Group Holdings Ltd"
          userName="Group Managing Director"
          onNavigate={() => {}}
          onSelectBusiness={() => {}}
        />
      </div>
    </ConnectAppShell>
  );
}
