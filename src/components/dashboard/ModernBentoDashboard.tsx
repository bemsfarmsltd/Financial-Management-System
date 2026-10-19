'use client';

import React from 'react';
import { ExactForestBentoCards } from './exact-cards/ExactForestBentoCards';
import { ExactBlueFunnelCards } from './exact-cards/ExactBlueFunnelCards';
import { roleDashboardConfigs, RoleDashboardConfig } from './exact-cards/roleCardConfigs';

interface ModernBentoProps {
  role: string;
  businessName: string;
  onNavigate: (path: string) => void;
  onRoleChange?: (role: string) => void;
}

export function ModernBentoDashboard({ role, businessName, onNavigate }: ModernBentoProps) {
  // Retrieve role-specific data & color configuration directly from active role
  const config: RoleDashboardConfig = roleDashboardConfigs[role] || roleDashboardConfigs.GMD;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* CLUSTER 1: EXECUTIVE BENTO CARDS */}
      <section>
        <ExactForestBentoCards config={config} onNavigate={onNavigate} businessName={businessName} allowCreate={role !== 'GMD'} />
      </section>

      {/* CLUSTER 2: 3D STEPPED FUNNEL & VOLUME PIPELINE */}
      <section>
        <ExactBlueFunnelCards config={config} onNavigate={onNavigate} currency="₦" />
      </section>
    </div>
  );
}
