import React from 'react';
import { redirect } from 'next/navigation';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { MobileAppsViewerClient } from './MobileAppsViewerClient';

export const dynamic = 'force-dynamic';

export default async function MobileAppsPage() {
  const actor = await getAuthenticatedEmployee();

  const userRole = actor?.role || 'GMD';
  const userName = actor?.legalName || 'Executive';

  return (
    <ConnectAppShell initialRole={userRole as any}>
      <MobileAppsViewerClient
        userName={userName}
        userRole={userRole}
      />
    </ConnectAppShell>
  );
}
