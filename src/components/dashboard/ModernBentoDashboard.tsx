'use client';

import React from 'react';
import { ExactForestBentoCards } from './exact-cards/ExactForestBentoCards';
import { ExactBlueFunnelCards } from './exact-cards/ExactBlueFunnelCards';
import { useDynamicDashboardConfig } from './exact-cards/useDynamicDashboardConfig';

interface ModernBentoProps {
  role: string;
  businessName: string;
  subsidiaryId?: string;
  onNavigate: (path: string) => void;
  onRoleChange?: (role: string) => void;
}

export function ModernBentoDashboard({ role, businessName, subsidiaryId, onNavigate }: ModernBentoProps) {
  const { config, loading } = useDynamicDashboardConfig({ role, businessName, subsidiaryId });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* CLUSTER 1: EXECUTIVE BENTO CARDS */}
      <section style={{ opacity: loading ? 0.75 : 1, transition: 'opacity 0.2s ease' }}>
        <ExactForestBentoCards config={config} onNavigate={onNavigate} businessName={businessName} allowCreate={role !== 'GMD'} />
      </section>

      {/* CLUSTER 2: 3D STEPPED FUNNEL & VOLUME PIPELINE */}
      <section style={{ opacity: loading ? 0.75 : 1, transition: 'opacity 0.2s ease' }}>
        <ExactBlueFunnelCards config={config} onNavigate={onNavigate} currency="₦" />
      </section>
    </div>
  );
}
