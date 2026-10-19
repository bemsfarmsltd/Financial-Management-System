'use client';

import React from 'react';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { TreasuryFinanceHubView } from '@/components/dashboard/gmd/TreasuryFinanceHubView';

export default function BudgetsPage() {
  return (
    <ConnectAppShell>
      <div style={{ padding: '4px 0' }}>
        <TreasuryFinanceHubView
          initialTab="budgets"
          businessName="BEMS Group Holdings Ltd"
          userName="Group Managing Director"
          onNavigate={() => {}}
          onSelectBusiness={() => {}}
        />
      </div>
    </ConnectAppShell>
  );
}
