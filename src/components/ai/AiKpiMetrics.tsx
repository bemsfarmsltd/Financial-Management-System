'use client';

import React from 'react';
import { DollarSign, Hash, Percent, Layers, ShieldCheck } from 'lucide-react';

export interface KpiMetricItem {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

export interface AiKpiMetricsProps {
  metrics: KpiMetricItem[];
}

export function AiKpiMetrics({ metrics }: AiKpiMetricsProps) {
  if (!metrics || metrics.length === 0) return null;

  return (
    <div
      className="ai-kpi-metrics-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(130px, 1fr))`,
        gap: '8px',
        margin: '12px 0',
        width: '100%',
      }}
    >
      {metrics.map((item, idx) => (
        <div
          key={idx}
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%)',
            border: '1px solid rgba(226, 232, 240, 0.9)',
            borderRadius: '10px',
            padding: '9px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)',
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {item.label}
          </div>
          <div style={{ fontSize: '14.5px', fontWeight: 800, color: item.color || '#0f172a', letterSpacing: '-0.02em' }}>
            {item.value}
          </div>
          {item.subtext && (
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
              {item.subtext}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
