'use client';

import React, { useState } from 'react';
import { CardPatternDefs, TopographicBackground, ProjectGlyph } from './CardPatterns';
import { RoleDashboardConfig } from './roleCardConfigs';

interface ExactForestBentoProps {
  config: RoleDashboardConfig;
  onNavigate?: (path: string) => void;
  businessName?: string;
  allowCreate?: boolean;
}

export function ExactForestBentoCards({ config, onNavigate, businessName = 'BEMS Group', allowCreate = true }: ExactForestBentoProps) {
  const [timerRunning, setTimerRunning] = useState(true);
  const theme = config.theme;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'inherit' }}>
      <CardPatternDefs />


      {/* =========================================================================
          ROW 1: 4 BENTO METRIC PILLS (Exact styling from Image 2, blended with role palette)
      ========================================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {config.bentoPills.map((pill, idx) => {
          if (pill.isPrimary) {
            return (
              <div
                key={pill.label}
                onClick={() => onNavigate && onNavigate(pill.link)}
                style={{
                  background: theme.primaryGradient,
                  color: '#ffffff',
                  borderRadius: '20px',
                  padding: '22px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '135px',
                  boxShadow: `0 10px 25px ${theme.primarySolid}35`,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: '600', opacity: 0.9 }}>{pill.label}</span>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#ffffff',
                      color: theme.primarySolid,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '14px',
                      fontWeight: '800',
                    }}
                  >
                    ↗
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '42px', fontWeight: '800', lineHeight: 1.1, margin: '8px 0 6px', letterSpacing: '-0.03em' }}>
                    {pill.value}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', opacity: 0.9 }}>
                    <span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', textAlign: 'center', lineHeight: '14px' }}>⇗</span>
                    <span>{pill.delta}</span>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={pill.label}
              onClick={() => onNavigate && onNavigate(pill.link)}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '20px',
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '135px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#1e293b' }}>{pill.label}</span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#0f172a',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '14px',
                    fontWeight: '700',
                  }}
                >
                  ↗
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: '42px',
                    fontWeight: '800',
                    color: pill.statusBadge ? '#b45309' : '#0f172a',
                    lineHeight: 1.1,
                    margin: '8px 0 6px',
                    letterSpacing: '-0.03em',
                  }}
                >
                  {pill.value}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: pill.statusBadge ? '#b45309' : '#64748b', fontWeight: pill.statusBadge ? '600' : '400' }}>
                  {pill.statusBadge ? (
                    <>
                      <span>💬</span>
                      <span>{pill.delta}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ display: 'inline-block', width: '14px', height: '14px', borderRadius: '50%', background: '#f1f5f9', textAlign: 'center', lineHeight: '14px' }}>⇗</span>
                      <span>{pill.delta}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* =========================================================================
          ROW 2: PROJECT ANALYTICS CAPSULES, REMINDERS, PROJECT LIST (Exact Image 2)
      ========================================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.95fr 1.1fr', gap: '16px' }}>
        {/* PROJECT ANALYTICS (Capsule Bars: S, M, T, W, T, F, S) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
              {config.analyticsTitle}
            </h3>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '170px', padding: '0 8px 6px' }}>
            {config.capsuleDays.map((col, idx) => {
              const isHatched = col.type === 'hatched';
              const isTooltip = !!col.tooltip;

              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', position: 'relative' }}>
                  {isTooltip && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-26px',
                        background: theme.lightBg,
                        border: `1px solid ${theme.pillBorder}`,
                        color: theme.primarySolid,
                        fontSize: '10.5px',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.tooltip}
                    </div>
                  )}

                  <div
                    style={{
                      width: '38px',
                      height: `${col.height}px`,
                      borderRadius: '20px',
                      background: isHatched
                        ? 'repeating-linear-gradient(45deg, #f8fafc, #f8fafc 4px, #cbd5e1 4px, #cbd5e1 7px)'
                        : col.type === 'solid-dark'
                        ? theme.primarySolid
                        : col.type === 'solid-mid'
                        ? theme.secondarySolid
                        : theme.accentColor,
                      border: isHatched ? '1px solid #e2e8f0' : 'none',
                      boxShadow: !isHatched ? `0 4px 12px ${theme.primarySolid}30` : 'none',
                    }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8' }}>{col.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* REMINDERS CARD (Exact from Image 2) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', display: 'block', marginBottom: '14px' }}>
              Reminders
            </span>
            <h3 style={{ margin: '0 0 6px', fontSize: '19px', fontWeight: '800', color: theme.primarySolid, letterSpacing: '-0.01em' }}>
              {config.reminderTitle}
            </h3>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', fontWeight: '500' }}>
              {config.reminderSubtitle}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              {config.reminderTime}
            </p>
          </div>

          <button
            onClick={() => onNavigate && onNavigate('/approvals')}
            style={{
              background: theme.primarySolid,
              color: '#ffffff',
              border: 0,
              borderRadius: '24px',
              padding: '14px 20px',
              fontSize: '13.5px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              cursor: 'pointer',
              boxShadow: `0 6px 18px ${theme.primarySolid}35`,
              marginTop: '20px',
            }}
          >
            <span style={{ fontSize: '16px' }}>📹</span>
            <span>{config.reminderButton}</span>
          </button>
        </div>

        {/* PROJECT LIST CARD (Exact from Image 2) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
              {config.projectsTitle}
            </h3>
            {allowCreate && <button
              onClick={() => onNavigate && onNavigate('/requests/new')}
              style={{
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                borderRadius: '16px',
                padding: '3px 12px',
                fontSize: '11px',
                fontWeight: '700',
                color: theme.primarySolid,
                cursor: 'pointer',
              }}
            >
              + New
            </button>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {config.projects.map(p => (
              <div key={p.title} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '30px', height: '30px', display: 'grid', placeItems: 'center' }}>
                  <ProjectGlyph type={p.glyph} />
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '12.5px', color: '#0f172a', display: 'block', fontWeight: '700' }}>
                    {p.title}
                  </strong>
                  <small style={{ fontSize: '11px', color: '#94a3b8' }}>{p.date}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 3: TEAM COLLABORATION, PROJECT PROGRESS GAUGE, TIME TRACKER (Exact Image 2)
      ========================================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.95fr 1.1fr', gap: '16px' }}>
        {/* TEAM COLLABORATION CARD */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'block',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
              {config.teamTitle}
            </h3>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') window.location.href = '/staff-approvals';
              }}
              style={{
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                borderRadius: '16px',
                padding: '3px 12px',
                fontSize: '11px',
                fontWeight: '700',
                color: theme.primarySolid,
                cursor: 'pointer',
              }}
            >
              + Add Member
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {config.teamMembers.map(m => (
              <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: m.avatarBg,
                      border: '1px solid rgba(0,0,0,0.08)',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '16px',
                    }}
                  >
                    {m.avatarEmoji}
                  </div>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block', fontWeight: '700' }}>
                      {m.name}
                    </strong>
                    <small style={{ fontSize: '11px', color: '#64748b' }}>
                      {m.task}
                    </small>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    background: m.statusColor,
                    color: m.textColor,
                    border: `1px solid ${m.borderColor}`,
                    fontWeight: '600',
                  }}
                >
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* PROJECT PROGRESS ARC GAUGE (Exact from Image 2) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
              {config.arcTitle}
            </h3>
          </div>

          {/* SVG HALF-DONUT ARC GAUGE */}
          <div style={{ position: 'relative', width: '200px', height: '110px', marginTop: '10px' }}>
            <svg viewBox="0 0 100 55" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              {/* Inactive remaining arc with hatched pattern */}
              <path
                d="M 12,50 A 38,38 0 0,1 88,50"
                fill="none"
                stroke="url(#diagonalHatchGrey)"
                strokeWidth="11"
              />
              {/* Active arc calculated dynamically */}
              <path
                d={`M 12,50 A 38,38 0 0,1 ${12 + (config.arcPercent / 100) * 76},${50 - Math.sin((config.arcPercent / 100) * Math.PI) * 38}`}
                fill="none"
                stroke={theme.arcStroke}
                strokeWidth="12"
                strokeLinecap="round"
              />
            </svg>
            <div style={{ position: 'absolute', bottom: '0', width: '100%', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', lineHeight: 1 }}>
                {config.arcPercent}%
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', marginTop: '2px' }}>
                {config.arcSubtitle}
              </div>
            </div>
          </div>

          {/* LEGEND ROW */}
          <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: '#64748b', marginTop: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: theme.primarySolid }} />
              Completed
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: theme.accentColor }} />
              In Progress
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '2px',
                  background: 'repeating-linear-gradient(45deg, #cbd5e1, #cbd5e1 2px, #94a3b8 2px, #94a3b8 4px)',
                }}
              />
              Pending
            </span>
          </div>
        </div>

        {/* TIME TRACKER CARD (Exact from Image 2 with Topographic Wave Background and Role Theme) */}
        <div
          style={{
            background: theme.timeTrackerBg,
            color: '#ffffff',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: `0 10px 25px ${theme.primarySolid}40`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Topographic 3D wave contour lines */}
          <TopographicBackground strokeColor={theme.topographicStroke} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <span style={{ fontSize: '13px', fontWeight: '700', opacity: 0.9 }}>{config.timerTitle}</span>
            <small style={{ fontSize: '11px', opacity: 0.75, display: 'block', marginTop: '2px' }}>
              {config.timerSubtitle}
            </small>
          </div>

          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', margin: '14px 0' }}>
            <div
              style={{
                fontSize: '44px',
                fontWeight: '800',
                fontFamily: 'monospace, system-ui',
                letterSpacing: '0.04em',
                lineHeight: 1,
              }}
            >
              {config.timerValue}
            </div>
          </div>

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center', gap: '14px' }}>
            {/* Pause button */}
            <button
              onClick={() => setTimerRunning(!timerRunning)}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: '#ffffff',
                color: theme.primarySolid,
                border: 0,
                fontSize: '15px',
                fontWeight: '900',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              }}
            >
              {timerRunning ? '❚❚' : '▶'}
            </button>
            {/* Stop button */}
            <button
              onClick={() => setTimerRunning(false)}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: '#dc2626',
                color: '#ffffff',
                border: 0,
                fontSize: '15px',
                fontWeight: '900',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
              }}
            >
              ■
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
