'use client';

import React, { useState } from 'react';
import { BarChart3, Table as TableIcon, TrendingUp } from 'lucide-react';

export interface ChartDataPoint {
  label: string;
  value: number;
  formattedValue?: string;
  secondaryLabel?: string;
  color?: string;
  percentage?: number;
}

export interface AiVisualChartProps {
  title?: string;
  subtitle?: string;
  chartType?: 'histogram' | 'bar' | 'distribution' | 'kpi';
  data: ChartDataPoint[];
  metricUnit?: string;
  isCurrency?: boolean;
}

export function AiVisualChart({
  title,
  subtitle,
  chartType = 'histogram',
  data = [],
  metricUnit = '',
  isCurrency = true,
}: AiVisualChartProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const totalValue = data.reduce((acc, d) => acc + d.value, 0);

  const formatVal = (val: number, customFormatted?: string) => {
    if (customFormatted) return customFormatted;
    if (isCurrency) {
      if (val >= 1_000_000_000) return `₦${(val / 1_000_000_000).toFixed(2)}B`;
      if (val >= 1_000_000) return `₦${(val / 1_000_000).toFixed(2)}M`;
      if (val >= 1_000) return `₦${(val / 1_000).toLocaleString()}k`;
      return `₦${val.toLocaleString()}`;
    }
    return `${val.toLocaleString()} ${metricUnit}`.trim();
  };

  const palette = [
    'linear-gradient(180deg, #f97316 0%, #ea580c 100%)',
    'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)',
    'linear-gradient(180deg, #34d399 0%, #059669 100%)',
    'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)',
    'linear-gradient(180deg, #fbbf24 0%, #d97706 100%)',
    'linear-gradient(180deg, #f43f5e 0%, #e11d48 100%)',
  ];

  return (
    <div
      className="ai-visual-chart-container"
      style={{
        margin: '14px 0',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.98) 100%)',
        border: '1px solid rgba(226, 232, 240, 0.95)',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          padding: '10px 14px',
          background: 'rgba(241, 245, 249, 0.75)',
          borderBottom: '1px solid rgba(226, 232, 240, 0.85)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              background: 'rgba(234, 88, 12, 0.12)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <BarChart3 size={15} color="#ea580c" />
          </div>
          <div>
            <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
              {title || 'Financial Data Visualization'}
            </div>
            {subtitle && (
              <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '1px' }}>
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {/* View toggle button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'chart' ? 'table' : 'chart')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '11px',
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {viewMode === 'chart' ? (
              <>
                <TableIcon size={12} />
                <span>Table view</span>
              </>
            ) : (
              <>
                <BarChart3 size={12} />
                <span>Histogram</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Chart Body */}
      <div style={{ padding: '16px 14px' }}>
        {viewMode === 'chart' ? (
          <div>
            {/* Histogram / Vertical Bars view */}
            {chartType === 'histogram' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '12px',
                    height: '140px',
                    paddingTop: '16px',
                    paddingBottom: '6px',
                    borderBottom: '1.5px solid #e2e8f0',
                    overflowX: 'auto',
                  }}
                >
                  {data.map((item, idx) => {
                    const pct = Math.max(8, Math.round((item.value / maxValue) * 100));
                    const isHovered = hoveredIdx === idx;
                    const barColor = item.color || palette[idx % palette.length];

                    return (
                      <div
                        key={idx}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                        style={{
                          flex: 1,
                          minWidth: '55px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          height: '100%',
                          justifyContent: 'flex-end',
                          position: 'relative',
                          cursor: 'pointer',
                        }}
                      >
                        {/* Hover Tooltip / Value above bar */}
                        <div
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 800,
                            color: isHovered ? '#ea580c' : '#334155',
                            marginBottom: '6px',
                            transition: 'all 0.15s ease',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatVal(item.value, item.formattedValue)}
                        </div>

                        {/* Bar Pillar */}
                        <div
                          style={{
                            width: '100%',
                            maxWidth: '44px',
                            height: `${pct}%`,
                            background: barColor,
                            borderRadius: '6px 6px 2px 2px',
                            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                            transform: isHovered ? 'scaleY(1.03)' : 'scaleY(1)',
                            transformOrigin: 'bottom',
                            boxShadow: isHovered
                              ? '0 6px 16px rgba(234, 88, 12, 0.3)'
                              : '0 2px 6px rgba(15, 23, 42, 0.08)',
                          }}
                        />

                        {/* X-axis Label below */}
                        <div
                          style={{
                            fontSize: '10.5px',
                            fontWeight: isHovered ? 700 : 600,
                            color: isHovered ? '#0f172a' : '#64748b',
                            marginTop: '8px',
                            textAlign: 'center',
                            width: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={item.label}
                        >
                          {item.label}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer summary metrics */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: '#64748b',
                    paddingTop: '2px',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={13} color="#ea580c" />
                    <strong>Total aggregate:</strong> {formatVal(totalValue)}
                  </span>
                  <span>{data.length} segments analyzed</span>
                </div>
              </div>
            )}

            {/* Horizontal Bar Breakdown view */}
            {chartType === 'bar' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.map((item, idx) => {
                  const sharePct = totalValue > 0 ? Math.round((item.value / totalValue) * 100) : 0;
                  const barPct = Math.max(4, Math.round((item.value / maxValue) * 100));
                  const isHovered = hoveredIdx === idx;

                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        padding: '6px 8px',
                        borderRadius: '8px',
                        background: isHovered ? 'rgba(241, 245, 249, 0.7)' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px' }}>
                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{item.label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, color: '#0f172a' }}>
                            {formatVal(item.value, item.formattedValue)}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              background: '#e2e8f0',
                              color: '#475569',
                              padding: '1px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            {sharePct}%
                          </span>
                        </div>
                      </div>

                      {/* Bar track */}
                      <div
                        style={{
                          height: '8px',
                          background: '#f1f5f9',
                          borderRadius: '999px',
                          overflow: 'hidden',
                          width: '100%',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${barPct}%`,
                            background: item.color || palette[idx % palette.length],
                            borderRadius: '999px',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Table View */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '6px 8px', fontWeight: 700 }}>Segment</th>
                  <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Amount / Value</th>
                  <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Share (%)</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, idx) => {
                  const sharePct = totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : '0';
                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: idx % 2 === 0 ? 'transparent' : 'rgba(248, 250, 252, 0.7)',
                      }}
                    >
                      <td style={{ padding: '8px', fontWeight: 600, color: '#1e293b' }}>{item.label}</td>
                      <td style={{ padding: '8px', fontWeight: 700, color: '#0f172a', textAlign: 'right' }}>
                        {formatVal(item.value, item.formattedValue)}
                      </td>
                      <td style={{ padding: '8px', fontWeight: 700, color: '#ea580c', textAlign: 'right' }}>
                        {sharePct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
