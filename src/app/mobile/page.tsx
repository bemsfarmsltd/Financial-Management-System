import React from 'react';
import { redirect } from 'next/navigation';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';
import { MobileAppsViewerClient } from './MobileAppsViewerClient';

export const dynamic = 'force-dynamic';

export default async function MobileAppsPage() {
  const actor = await getAuthenticatedEmployee();
  if (!actor) {
    redirect('/');
  }

  // Restrict to executive roles (GMD & Super Admin)
  if (!hasAnyRole(actor, ['GMD', 'SUPER_ADMIN', 'SYSTEM_ADMIN'])) {
    redirect('/staff');
  }

  return (
    <ConnectAppShell initialRole={actor.role as any}>
      <MobileAppsViewerClient
        userName={actor.legalName}
        userRole={actor.role}
      />
    </ConnectAppShell>
  );
}
