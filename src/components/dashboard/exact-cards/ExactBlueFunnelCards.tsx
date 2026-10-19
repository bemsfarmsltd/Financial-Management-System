'use client';

import React, { useState } from 'react';
import { CardPatternDefs } from './CardPatterns';
import { RoleDashboardConfig } from './roleCardConfigs';

interface ExactBlueFunnelProps {
  config: RoleDashboardConfig;
  onNavigate?: (path: string) => void;
  currency?: string;
}

export function ExactBlueFunnelCards({ config, onNavigate, currency = '₦' }: ExactBlueFunnelProps) {
  const [promptInput, setPromptInput] = useState(config.funnelExplorePrompt);
  const theme = config.theme;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'inherit' }}>
      <CardPatternDefs />

      {/* TOP ROW: MULTI-STAGE 3D STEPPED FUNNEL & GROSS VOLUME (Exact Image 1, blended with system & role colors) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
        {/* 1. PAYMENTS / EXPENDITURE MULTI-STAGE STEP-DOWN FUNNEL CARD */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '24px',
            padding: '26px 28px 20px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                {config.funnelTitle}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                {config.funnelSubtitle}
              </p>
            </div>
            <button
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#64748b',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              •••
            </button>
          </div>

          {/* Stepped Funnel Chart with Y-axis */}
          <div style={{ display: 'flex', gap: '14px', alignItems: 'stretch', minHeight: '230px', position: 'relative' }}>
            {/* Y-axis Ticks */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                paddingBottom: '24px',
                fontSize: '11px',
                color: '#94a3b8',
                fontWeight: '500',
                width: '28px',
                textAlign: 'right',
              }}
            >
              <span>100%</span>
              <span>80%</span>
              <span>60%</span>
              <span>40%</span>
              <span>20%</span>
            </div>

            {/* 5 Funnel Stages */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0px', position: 'relative' }}>
              {config.funnelStages.map((stage, idx) => {
                const isThirdHighlighted = idx === 2;

                return (
                  <div
                    key={stage.label}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0 6px',
                      background: isThirdHighlighted ? `${theme.lightBg}cc` : 'transparent',
                      borderRadius: isThirdHighlighted ? '12px 12px 0 0' : '0',
                      position: 'relative',
                    }}
                  >
                    <div style={{ textAlign: 'center', paddingTop: isThirdHighlighted ? '4px' : '0' }}>
                      <span style={{ fontSize: '11px', color: isThirdHighlighted ? '#0f172a' : '#94a3b8', fontWeight: isThirdHighlighted ? '700' : '500', display: 'block' }}>
                        {stage.label}
                      </span>
                      <strong style={{ fontSize: isThirdHighlighted ? '19px' : '18px', fontWeight: '800', color: '#0f172a' }}>
                        {stage.value}
                      </strong>
                      <div style={{ width: '22px', height: '4px', background: theme.primarySolid, borderRadius: '2px', margin: '4px auto 0' }} />
                    </div>

                    {/* Floating Tooltip above the highlighted 3rd stage */}
                    {isThirdHighlighted && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '75px',
                          left: '50%',
                          transform: 'translateX(-30%)',
                          background: 'rgba(255, 255, 255, 0.95)',
                          backdropFilter: 'blur(8px)',
                          border: `1px solid ${theme.pillBorder}`,
                          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                          borderRadius: '20px',
                          padding: '6px 14px',
                          fontSize: '11px',
                          color: '#334155',
                          whiteSpace: 'nowrap',
                          zIndex: 20,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <strong style={{ color: '#0f172a' }}>{stage.amount}</strong>
                        <span style={{ color: '#cbd5e1' }}>|</span>
                        Conversion: <strong style={{ color: theme.primarySolid }}>89%</strong>
                        <span style={{ color: '#cbd5e1' }}>|</span>
                        Drop-off: <strong style={{ color: '#dc2626' }}>{stage.drop}</strong>
                      </div>
                    )}

                    {/* 3D Bar */}
                    <div style={{ width: '100%', height: `${stage.height}px`, position: 'relative', marginTop: '16px' }}>
                      {isThirdHighlighted ? (
                        <>
                          {/* Top 3D Facet */}
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: '8px',
                              background: theme.primarySolid,
                              borderRadius: '8px 8px 0 0',
                            }}
                          />
                          {/* Front Face */}
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              borderRadius: '8px 8px 0 0',
                              background: theme.funnelGradient,
                              boxShadow: `0 8px 20px ${theme.primarySolid}40`,
                            }}
                          />
                          {/* Cursor Pointer */}
                          <div style={{ position: 'absolute', top: '-18px', left: '-8px', fontSize: '16px' }}>
                            ↖
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              borderRadius: '8px 8px 0 0',
                              background: theme.funnelHatch,
                              opacity: 0.9,
                            }}
                          />
                          {/* Connection slope */}
                          {idx < 4 && (
                            <div
                              style={{
                                position: 'absolute',
                                right: '-12px',
                                top: '25px',
                                width: '12px',
                                height: `${stage.height - 25}px`,
                                background: `linear-gradient(to right, ${theme.primarySolid}30, transparent)`,
                                zIndex: 1,
                                pointerEvents: 'none',
                              }}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CONVERSATIONAL SEARCH / EXPLORE PROMPT PILL (Exact from Image 1) */}
          <div
            style={{
              marginTop: '20px',
              background: '#f1f5f9',
              borderRadius: '16px',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569', fontWeight: '600' }}>
                <span style={{ fontSize: '14px', color: theme.secondarySolid }}>✦</span>
                <span>What would you like to explore next?</span>
              </div>
              <span style={{ fontSize: '14px', color: '#64748b', cursor: 'pointer' }}>⌃</span>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
              }}
            >
              <span style={{ color: '#0f172a' }}>{config.funnelExplorePrompt}</span>
              <span
                style={{
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  color: '#d97706',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              >
                {config.funnelTagText}
              </span>
              <span style={{ animation: 'blink 1s infinite', fontWeight: '600', color: '#64748b' }}>|</span>
            </div>
          </div>
        </div>

        {/* 2. GROSS VOLUME CARD (Exact from Image 1, blended with role-specific volume & rows) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '24px',
            padding: '26px 24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
              {config.volumeTitle}
            </h3>
            <div
              style={{
                fontSize: '48px',
                fontWeight: '900',
                color: '#0f172a',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                margin: '14px 0 24px',
              }}
            >
              {config.volumeAmount}
            </div>

            {/* 3 Striped Hatched Progress Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {config.volumeRows.map(row => (
                <div key={row.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#475569' }}>
                      {row.label}
                    </span>
                    <strong style={{ fontSize: '12px', color: row.color }}>
                      {row.percent}%
                    </strong>
                  </div>
                  <div style={{ width: '100%', height: '14px', background: '#f1f5f9', borderRadius: '7px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${row.percent}%`,
                        height: '100%',
                        background: row.hatchGradient,
                        borderRadius: '7px',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: RETENTION, TRANSACTIONS, INSIGHTS (Exact from Image 1) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 0.9fr', gap: '20px' }}>
        {/* 3. RETENTION CARD (Histogram line chart with peak badge) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '24px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
              {config.retentionTitle}
            </h3>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>•••</span>
          </div>

          {/* Stepped Histogram Graphic with Pink/Role Outline & Vertical Hatch Lines */}
          <div style={{ position: 'relative', height: '110px', marginTop: '16px' }}>
            {/* Peak Tag */}
            <div
              style={{
                position: 'absolute',
                top: '0px',
                left: '38%',
                background: '#ffffff',
                border: '1px solid #fecdd3',
                color: '#e11d48',
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '12px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
              }}
            >
              {config.retentionPeak}
            </div>

            {/* Stepped SVG Line */}
            <svg viewBox="0 0 200 90" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              {/* Vertical light pink fill lines */}
              {Array.from({ length: 25 }).map((_, i) => (
                <line
                  key={i}
                  x1={10 + i * 7.5}
                  y1={i > 8 && i < 14 ? 25 : i > 4 && i <= 8 ? 45 : 70}
                  x2={10 + i * 7.5}
                  y2={85}
                  stroke="#ffe4e6"
                  strokeWidth="1.5"
                />
              ))}

              {/* Stepped Outline */}
              <path
                d="M 10,80 L 30,80 L 30,65 L 50,65 L 50,45 L 85,45 L 85,25 L 105,25 L 105,65 L 125,65 L 125,50 L 145,50 L 145,80 L 190,80"
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              {/* Peak Circle Marker */}
              <circle cx="85" cy="25" r="4" fill="#f43f5e" stroke="#ffffff" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* 4. TRANSACTIONS CARD (Dot Column Histogram Matrix) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '24px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
              {config.transactionsTitle}
            </h3>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>•••</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '12px' }}>
            <div>
              <div style={{ fontSize: '38px', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>
                {config.transactionsAmount}
              </div>
            </div>

            {/* Matrix / Dot Column Histogram (Peak Day) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  color: '#15803d',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  marginBottom: '8px',
                }}
              >
                Peak: {config.transactionsPeak}
              </span>

              {/* Stacked green dots column equalizer */}
              <div style={{ display: 'flex', gap: '5px', alignItems: 'flex-end', height: '55px' }}>
                {[
                  [1],
                  [1, 2],
                  [1, 2, 3],
                  [1, 2, 3, 4, 5], // Peak
                  [1, 2, 3],
                  [1, 2],
                  [1],
                  [1],
                  [1],
                ].map((stack, colIdx) => (
                  <div key={colIdx} style={{ display: 'flex', flexDirection: 'column-reverse', gap: '4px' }}>
                    {stack.map(dot => (
                      <div
                        key={dot}
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: colIdx === 3 ? theme.primarySolid : theme.accentColor,
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* vs last period delta */}
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>vs last period</span>
              <strong style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                {config.transactionsDelta}
              </strong>
            </div>
          </div>
        </div>

        {/* 5. INSIGHTS CARD (Iridescent sunset/teal gradient with percentage) */}
        <div
          style={{
            background: 'linear-gradient(135deg, #c7d2fe 0%, #fed7aa 50%, #6ee7b7 100%)',
            borderRadius: '24px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Frosted glass pill badge */}
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.55)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.7)',
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: '700',
                color: '#1e293b',
              }}
            >
              <span>💡</span>
              <span>{config.insightLabel}</span>
            </div>
          </div>

          {/* Huge Typography */}
          <div>
            <div
              style={{
                fontSize: '60px',
                fontWeight: '900',
                color: '#ffffff',
                textShadow: '0 2px 10px rgba(0,0,0,0.12)',
                lineHeight: 1,
                letterSpacing: '-0.03em',
              }}
            >
              {config.insightValue}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
