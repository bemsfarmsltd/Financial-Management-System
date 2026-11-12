import React from 'react';
import { redirect } from 'next/navigation';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { loadAuthorizedExecutiveBriefing } from '@/lib/services/briefing-read';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { ExecutiveBriefingClient } from './ExecutiveBriefingClient';

export const dynamic = 'force-dynamic';

export default async function ExecutiveBriefingPage() {
  const actor = await getAuthenticatedEmployee();
  if (!actor) {
    redirect('/?redirect=/briefing');
  }

  if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
    redirect('/staff');
  }

  const briefing = await loadAuthorizedExecutiveBriefing(actor);
  if (!briefing.authorized) {
    redirect('/finance');
  }

  const initialRole = actor.role === 'GMD' ? 'GMD' : 'SystemAdmin';

  return (
    <ConnectAppShell initialRole={initialRole}>
      <ExecutiveBriefingClient
        organizations={briefing.data.organizations}
        requests={briefing.data.requests}
        budgets={briefing.data.budgets}
        accountabilityCases={briefing.data.accountabilityCases}
        disbursements={briefing.data.disbursements}
      />
    </ConnectAppShell>
  );
}
