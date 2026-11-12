import React from 'react';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UnifiedAuthScreen } from '@/components/auth/UnifiedAuthScreen';
import { EnterpriseModulesScreen, type EnterpriseUserSummary } from '@/components/dashboard/EnterpriseModulesScreen';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const actor = await getAuthenticatedEmployee();

  // If unauthenticated, display the unified enterprise suite sign-in screen
  if (!actor) {
    return <UnifiedAuthScreen />;
  }

  // Fetch primary assignment subsidiary for corporate context
  let subsidiaryName: string | undefined = undefined;
  try {
    const assignment = await prisma.employeeAssignment.findFirst({
      where: { employeeId: actor.id, status: 'ACTIVE' },
      include: { subsidiary: true },
      orderBy: { isPrimary: 'desc' },
    });
    subsidiaryName = assignment?.subsidiary?.legalName;
  } catch {
    // Graceful fallback
  }

  const userSummary: EnterpriseUserSummary = {
    id: actor.id,
    legalName: actor.legalName,
    role: actor.role,
    workEmail: actor.workEmail,
    employeeNumber: actor.employeeNumber,
    subsidiaryName,
  };

  // If authenticated, display the 14-module Suite Launchpad
  return <EnterpriseModulesScreen user={userSummary} />;
}
