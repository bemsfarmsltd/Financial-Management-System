'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  Wallet,
  CheckCircle2,
  Users,
  CalendarClock,
} from 'lucide-react';
import {
  HrOverviewData,
  HrSectionId,
  formatNairaMinor,
} from './hrTypes';

interface HrOverviewPanelProps {
  data: HrOverviewData;
  activeBrandColor: string;
  activeTintHex: string;
  activeBusinessName: string;
  roleLabel: string;
  userName: string;
  onNavigate: (section: HrSectionId, presetFilter?: string) => void;
  onSelectSubsidiary: (subsidiaryId: string) => void;
}

export default function HrOverviewPanel({
  data,
  activeBrandColor,
  activeTintHex,
  activeBusinessName,
  roleLabel,
  userName,
  onNavigate,
  onSelectSubsidiary,
}: HrOverviewPanelProps) {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [trendWindow, setTrendWindow] = useState<'7D' | '14D'>('7D');
  const [trendMode, setTrendMode] = useState<'COUNTS' | 'RATE'>('COUNTS');
  const [compositionTab, setCompositionTab] = useState<'CONTRACTS' | 'DEPARTMENTS'>('CONTRACTS');
  const [bottomRightTab, setBottomRightTab] = useState<'PAYROLL' | 'LEAVE'>('PAYROLL');

  const {
    metrics,
    attendance7DayTrend,
    attendance14DayTrend,
    employmentBreakdown = [],
    departmentBreakdown = [],
    leaveBreakdown = [],
    latestPayrollBatch,
    subsidiaries,
    todayStr,
  } = data;

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const shortName = userName.split(' ')[0] || 'Executive';

  const activeTrend =
    trendWindow === '14D' && attendance14DayTrend && attendance14DayTrend.length > 0
      ? attendance14DayTrend
      : attendance7DayTrend.slice(-7);

  const maxBar = Math.max(
    1,
    ...activeTrend.map((d) => Math.max(d.present, d.absent))
  );

  const totalPendingActions =
    metrics.pendingOnboarding +
    metrics.pendingLeaves +
    metrics.pendingExcuseRequests +
    metrics.pendingProfileUpdates;

  const attendanceRatePct =
    metrics.totalStaff > 0
      ? Math.round(((metrics.presentToday + metrics.excusedToday) / metrics.totalStaff) * 100)
      : 0;

  const punctualityRatePct =
    metrics.presentToday > 0
      ? Math.max(0, Math.round(((metrics.presentToday - metrics.lateToday) / metrics.presentToday) * 100))
      : 100;

  const leaveCoveragePct =
    metrics.totalStaff > 0 ? Math.round((metrics.onLeaveToday / metrics.totalStaff) * 100) : 0;

  const totalAssignedAcrossSubs = Math.max(
    1,
    subsidiaries.reduce((acc, s) => acc + s.staffCount, 0)
  );

  const totalLeaveCount = Math.max(
    1,
    leaveBreakdown.reduce((acc, l) => acc + l.count, 0)
  );

  const grossMinor = latestPayrollBatch ? Number(latestPayrollBatch.totalGrossMinor) : 0;
  const netMinor = latestPayrollBatch ? Number(latestPayrollBatch.totalNetMinor) : 0;
  const deductionsMinor = Math.max(0, grossMinor - netMinor);

  const formatEmpType = (t: string) =>
    t
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Welcome Row */}
      <div className="welcome-row">
        <div>
          <h1>Good {timeGreeting}, {shortName}.</h1>
          <p>
            Real-time workforce attendance, leave governance, and payroll readiness across {activeBusinessName}.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="outline-button"
            onClick={() => onNavigate('employees', 'ALL')}
          >
            Manage Workforce ▦
          </button>
        </div>
      </div>

      {/* Hero Banner Card (matches Finance WalletDashboardSummary) */}
      <div
        style={{
          background: `linear-gradient(135deg, #fffcf7 0%, #ffffff 100%)`,
          border: `1px solid ${activeBrandColor}45`,
          borderRadius: '18px',
          padding: '22px 26px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: `0 6px 20px ${activeBrandColor}0d`,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
          }}
        >
          <div style={{ flex: '1 1 420px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: activeBrandColor,
                marginBottom: '6px',
              }}
            >
              WORKFORCE &amp; PAYROLL PIPELINE
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
              Employee directory, daily attendance &amp; payroll preparation
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
              Review staff onboarding, track Starlink Wi-Fi &amp; GPS clock-ins, authorize leave requests, and prepare monthly payroll cycles before Finance sign-off.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              className="primary-button"
              onClick={() => onNavigate('employees', 'PENDING_APPROVAL')}
              style={{
                borderRadius: '12px',
                padding: '11px 18px',
                fontSize: '13px',
                fontWeight: 700,
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                background: `linear-gradient(135deg, ${activeTintHex} 0%, ${activeBrandColor} 100%)`,
              }}
            >
              Open HR Action Queue →
            </button>
          </div>
        </div>

        {/* 3 Inline Telemetry Columns */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            paddingTop: '14px',
            borderTop: '1px solid #f1f5f9',
          }}
        >
          <div>
            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Active Workforce &amp; Attendance</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '3px' }}>
              {metrics.totalStaff} staff · {attendanceRatePct}% present
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Pending HR Reviews</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: totalPendingActions > 0 ? activeBrandColor : '#0f172a', marginTop: '3px' }}>
              {totalPendingActions} queued ({metrics.pendingOnboarding} onboarding)
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Latest Payroll Batch</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', marginTop: '3px' }}>
              {latestPayrollBatch ? formatNairaMinor(latestPayrollBatch.totalNetMinor) : '₦0.00'}
            </div>
          </div>
        </div>

        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
          Last HR telemetry sync: {todayStr} · Africa/Lagos. Workforce &amp; attendance updates sync live from the BEMS Staff App.
        </div>
      </div>

      {/* 4 Interactive Analytical Bento KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Primary Filled Bento Card */}
        <div
          onClick={() => onNavigate('employees', 'ALL')}
          style={{
            background: `linear-gradient(135deg, ${activeTintHex} 0%, ${activeBrandColor} 100%)`,
            color: '#ffffff',
            borderRadius: '20px',
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: '148px',
            boxShadow: `0 10px 25px ${activeBrandColor}35`,
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#ffffff' }}>Total Staff</span>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: '#ffffff',
                color: activeBrandColor,
                display: 'grid',
                placeItems: 'center',
                fontSize: '13px',
                fontWeight: 800,
              }}
            >
              ↗
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '8px 0 6px' }}>
              <span style={{ fontSize: '40px', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.03em' }}>
                {metrics.totalStaff}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.2)' }}>
                {metrics.pendingOnboarding} pending
              </span>
            </div>
            <div style={{ height: '4px', borderRadius: '999px', background: 'rgba(255,255,255,0.22)', overflow: 'hidden', marginBottom: '6px' }}>
              <div style={{ width: '100%', height: '100%', background: '#ffffff', borderRadius: '999px' }} />
            </div>
            <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.92)', fontWeight: 600 }}>
              Active across {activeBusinessName}
            </div>
          </div>
        </div>

        {/* Interactive White KPI Cards with Live Rate Badges & Progress Bars */}
        {[
          {
            label: 'Present Today',
            value: metrics.presentToday,
            badge: `${attendanceRatePct}% rate`,
            progressPct: attendanceRatePct,
            sub: `${metrics.absentToday} unrecorded (${todayStr})`,
            onClick: () => onNavigate('attendance', 'PRESENT'),
          },
          {
            label: 'On Leave',
            value: metrics.onLeaveToday,
            badge: `${metrics.pendingLeaves} pending`,
            progressPct: leaveCoveragePct,
            sub: `${metrics.excusedToday} attendance excused`,
            onClick: () => onNavigate('leave', 'APPROVED'),
          },
          {
            label: 'Late Today',
            value: metrics.lateToday,
            badge: `${punctualityRatePct}% punctual`,
            progressPct: punctualityRatePct,
            sub: 'Click to inspect clock-in log',
            onClick: () => onNavigate('attendance', 'LATE'),
          },
        ].map((card) => (
          <div
            key={card.label}
            onClick={card.onClick}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '148px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>{card.label}</span>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: '#f1f5f9',
                  color: '#0f172a',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                ↗
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '8px 0 6px' }}>
                <span style={{ fontSize: '40px', fontWeight: 800, lineHeight: 1.05, color: '#0f172a', letterSpacing: '-0.03em' }}>
                  {card.value}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: `${activeBrandColor}14`,
                    color: activeBrandColor,
                  }}
                >
                  {card.badge}
                </span>
              </div>
              <div style={{ height: '4px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden', marginBottom: '6px' }}>
                <div
                  style={{
                    width: `${Math.min(100, Math.max(card.progressPct, 4))}%`,
                    height: '100%',
                    background: activeBrandColor,
                    borderRadius: '999px',
                  }}
                />
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500 }}>
                {card.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 3-Column Interactive Analytics Bento Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: '16px',
        }}
      >
        {/* 1. Dynamic Attendance Velocity Card (7D / 14D + Counts / Rate %) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '22px 22px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, color: '#0f172a' }}>
                  Attendance Velocity
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#64748b' }}>
                  {trendMode === 'COUNTS' ? 'Present vs. unrecorded' : 'Daily attendance %'} · Lagos
                </p>
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {(['7D', '14D'] as const).map((win) => (
                  <button
                    key={win}
                    type="button"
                    onClick={() => setTrendWindow(win)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '999px',
                      border: `1px solid ${trendWindow === win ? activeBrandColor : '#e2e8f0'}`,
                      background: trendWindow === win ? `${activeBrandColor}15` : '#ffffff',
                      color: trendWindow === win ? activeBrandColor : '#64748b',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {win}
                  </button>
                ))}
                {(['COUNTS', 'RATE'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTrendMode(m)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '999px',
                      border: `1px solid ${trendMode === m ? '#0f172a' : '#e2e8f0'}`,
                      background: trendMode === m ? '#0f172a' : '#ffffff',
                      color: trendMode === m ? '#ffffff' : '#64748b',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {m === 'COUNTS' ? '#' : '%'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', fontSize: '11.5px', fontWeight: 600, marginBottom: '6px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#334155' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: activeBrandColor }} />
                {trendMode === 'COUNTS' ? 'Present' : 'Attendance %'}
              </span>
              {trendMode === 'COUNTS' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#334155' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#cbd5e1' }} />
                  Absent
                </span>
              )}
            </div>
          </div>

          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${activeTrend.length || 7}, minmax(0, 1fr))`,
                gap: trendWindow === '14D' ? '4px' : '8px',
                alignItems: 'end',
                height: '165px',
                paddingTop: '24px',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              {activeTrend.map((day) => {
                const totalDay = Math.max(1, day.present + day.absent);
                const dayRatePct = Math.round((day.present / totalDay) * 100);
                const presentPct =
                  trendMode === 'RATE' ? dayRatePct : Math.round((day.present / maxBar) * 100);
                const absentPct = Math.round((day.absent / maxBar) * 100);
                const isHovered = hoveredDay === day.date;
                const barWidth = trendWindow === '14D' ? '8px' : '11px';

                return (
                  <div
                    key={day.date}
                    onMouseEnter={() => setHoveredDay(day.date)}
                    onMouseLeave={() => setHoveredDay(null)}
                    onClick={() => onNavigate('attendance', 'ALL')}
                    style={{
                      position: 'relative',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    {isHovered && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          zIndex: 20,
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '7px 9px',
                          boxShadow: '0 8px 20px rgba(15,23,42,0.12)',
                          fontSize: '10.5px',
                          minWidth: '96px',
                          pointerEvents: 'none',
                        }}
                      >
                        <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '3px' }}>
                          {day.dayLabel} · {day.date.slice(5)}
                        </div>
                        <div style={{ color: activeBrandColor, fontWeight: 700 }}>
                          Present: {day.present} ({dayRatePct}%)
                        </div>
                        <div style={{ color: '#64748b', fontWeight: 600 }}>Absent: {day.absent}</div>
                      </div>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: '3px',
                        height: '130px',
                        width: '100%',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: barWidth,
                          height: `${Math.max(day.present > 0 ? 12 : 4, presentPct)}%`,
                          background: activeBrandColor,
                          borderRadius: '5px 5px 2px 2px',
                          transition: 'height 0.2s ease',
                        }}
                      />
                      {trendMode === 'COUNTS' && (
                        <div
                          style={{
                            width: barWidth,
                            height: `${Math.max(day.absent > 0 ? 8 : 4, absentPct)}%`,
                            background: '#cbd5e1',
                            borderRadius: '5px 5px 2px 2px',
                            transition: 'height 0.2s ease',
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${activeTrend.length || 7}, minmax(0, 1fr))`,
                gap: trendWindow === '14D' ? '4px' : '8px',
                marginTop: '7px',
                textAlign: 'center',
                fontSize: trendWindow === '14D' ? '9.5px' : '11px',
                fontWeight: 600,
                color: '#64748b',
              }}
            >
              {activeTrend.map((day) => (
                <div key={day.date} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {trendWindow === '14D' ? day.date.slice(8) : day.dayLabel}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Workforce Composition Analytics (Contracts vs Departments) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '22px 22px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Users size={16} color={activeBrandColor} />
                <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, color: '#0f172a' }}>
                  Workforce Mix
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['CONTRACTS', 'DEPARTMENTS'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCompositionTab(t)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '999px',
                      border: `1px solid ${compositionTab === t ? activeBrandColor : '#e2e8f0'}`,
                      background: compositionTab === t ? `${activeBrandColor}15` : '#ffffff',
                      color: compositionTab === t ? activeBrandColor : '#64748b',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {t === 'CONTRACTS' ? 'Contracts' : 'Depts'}
                  </button>
                ))}
              </div>
            </div>

            {compositionTab === 'CONTRACTS' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {employmentBreakdown.length === 0 ? (
                  <p style={{ fontSize: '12.5px', color: '#64748b', margin: '12px 0' }}>
                    No active staff contract records in scope.
                  </p>
                ) : (
                  employmentBreakdown.map((item) => {
                    const pct = metrics.totalStaff > 0 ? Math.round((item.count / metrics.totalStaff) * 100) : 0;
                    return (
                      <div
                        key={item.type}
                        onClick={() => onNavigate('employees', 'ALL')}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>{formatEmpType(item.type)}</span>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>
                            {item.count} <span style={{ color: '#64748b', fontWeight: 500 }}>({pct}%)</span>
                          </span>
                        </div>
                        <div style={{ height: '7px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.max(6, pct)}%`,
                              height: '100%',
                              background: activeBrandColor,
                              borderRadius: '999px',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {departmentBreakdown.length === 0 ? (
                  <p style={{ fontSize: '12.5px', color: '#64748b', margin: '12px 0' }}>
                    No department assignments recorded in scope.
                  </p>
                ) : (
                  departmentBreakdown.map((item) => {
                    const pct = metrics.totalStaff > 0 ? Math.round((item.count / metrics.totalStaff) * 100) : 0;
                    return (
                      <div
                        key={item.department}
                        onClick={() => onNavigate('employees', 'ALL')}
                        style={{ cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                            {item.department}
                          </span>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>
                            {item.count} <span style={{ color: '#64748b', fontWeight: 500 }}>({pct}%)</span>
                          </span>
                        </div>
                        <div style={{ height: '7px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.max(6, pct)}%`,
                              height: '100%',
                              background: activeBrandColor,
                              borderRadius: '999px',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('employees', 'ALL')}
            style={{
              padding: '9px 12px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#0f172a',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Inspect Full Staff Directory →
          </button>
        </div>

        {/* 3. HR Action Centre */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '22px 22px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, color: '#0f172a' }}>
              HR Action Centre
            </h3>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: '999px',
                background: totalPendingActions > 0 ? `${activeBrandColor}18` : '#ecfdf5',
                color: totalPendingActions > 0 ? activeBrandColor : '#059669',
              }}
            >
              {totalPendingActions} pending
            </span>
          </div>

          {[
            {
              label: 'Pending Staff Onboarding',
              count: metrics.pendingOnboarding,
              onClick: () => onNavigate('employees', 'PENDING_APPROVAL'),
            },
            {
              label: 'Pending Leave Requests',
              count: metrics.pendingLeaves,
              onClick: () => onNavigate('leave', 'PENDING'),
            },
            {
              label: 'Attendance Excuse Reviews',
              count: metrics.pendingExcuseRequests,
              onClick: () => onNavigate('attendance', 'ALL'),
            },
            {
              label: 'Profile Update Requests',
              count: metrics.pendingProfileUpdates,
              onClick: () => onNavigate('employees', 'ALL'),
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: '11px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {item.count > 0 ? (
                  <AlertCircle size={14} color={activeBrandColor} />
                ) : (
                  <CheckCircle2 size={14} color="#059669" />
                )}
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#1e293b' }}>
                  {item.label}
                </span>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: item.count > 0 ? activeBrandColor : '#64748b',
                }}
              >
                {item.count} →
              </span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => onNavigate('employees', 'PENDING_APPROVAL')}
            style={{
              marginTop: 'auto',
              width: '100%',
              padding: '11px 16px',
              borderRadius: '999px',
              border: 'none',
              background: `linear-gradient(135deg, ${activeTintHex} 0%, ${activeBrandColor} 100%)`,
              color: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: `0 6px 16px ${activeBrandColor}30`,
            }}
          >
            Open HR Action Queue
          </button>
        </div>
      </div>

      {/* Bottom Interactive Row: Subsidiary Distribution + Payroll/Leave Switcher */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)',
          gap: '16px',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '22px 24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={16} color={activeBrandColor} />
              <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, color: '#0f172a' }}>
                Workforce Distribution by Subsidiary
              </h3>
            </div>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748b' }}>
              Click entity to scope dashboard
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: '10px' }}>
            {subsidiaries.map((sub) => {
              const sharePct = Math.round((sub.staffCount / totalAssignedAcrossSubs) * 100);
              const subColor = sub.brandColor || activeBrandColor;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    onSelectSubsidiary(sub.id);
                    onNavigate('employees', 'ALL');
                  }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: subColor }} />
                      <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748b' }}>{sub.code}</span>
                    </div>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: subColor }}>{sharePct}%</span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {sub.name}
                  </div>
                  <div style={{ height: '4px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden', margin: '7px 0 5px' }}>
                    <div style={{ width: `${Math.max(sub.staffCount > 0 ? 8 : 0, sharePct)}%`, height: '100%', background: subColor, borderRadius: '999px' }} />
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#334155', fontWeight: 600 }}>
                    {sub.staffCount} assigned staff
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Payroll & Leave Intelligence Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '22px 24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {bottomRightTab === 'PAYROLL' ? (
                  <Wallet size={16} color={activeBrandColor} />
                ) : (
                  <CalendarClock size={16} color={activeBrandColor} />
                )}
                <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 700, color: '#0f172a' }}>
                  {bottomRightTab === 'PAYROLL' ? 'Payroll & Benefits' : 'Leave Utilization'}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['PAYROLL', 'LEAVE'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setBottomRightTab(tab)}
                    style={{
                      padding: '3px 9px',
                      borderRadius: '999px',
                      border: `1px solid ${bottomRightTab === tab ? activeBrandColor : '#e2e8f0'}`,
                      background: bottomRightTab === tab ? `${activeBrandColor}15` : '#ffffff',
                      color: bottomRightTab === tab ? activeBrandColor : '#64748b',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {tab === 'PAYROLL' ? 'Payroll' : 'Leave'}
                  </button>
                ))}
              </div>
            </div>

            {bottomRightTab === 'PAYROLL' ? (
              latestPayrollBatch ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#475569' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Cycle</span>
                    <strong style={{ color: '#0f172a' }}>{latestPayrollBatch.yearMonth} (v{latestPayrollBatch.version})</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Status</span>
                    <span style={{ padding: '2px 8px', borderRadius: '999px', background: `${activeBrandColor}18`, color: activeBrandColor, fontSize: '11px', fontWeight: 700 }}>
                      {latestPayrollBatch.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Headcount Covered</span>
                    <strong style={{ color: '#0f172a' }}>{latestPayrollBatch.totalHeadcount} staff</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Gross Payroll</span>
                    <strong style={{ color: '#0f172a' }}>{formatNairaMinor(latestPayrollBatch.totalGrossMinor)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Deductions</span>
                    <strong style={{ color: '#dc2626' }}>{formatNairaMinor(String(deductionsMinor))}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>Net Disbursement</span>
                    <strong style={{ color: '#059669', fontSize: '14.5px' }}>{formatNairaMinor(latestPayrollBatch.totalNetMinor)}</strong>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: '#64748b' }}>No payroll batches generated yet.</p>
              )
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {leaveBreakdown.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#64748b' }}>No active or pending leave requests recorded.</p>
                ) : (
                  leaveBreakdown.map((l) => {
                    const pct = Math.round((l.count / totalLeaveCount) * 100);
                    return (
                      <div key={l.type}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>{formatEmpType(l.type)} Leave</span>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{l.count} ({pct}%)</span>
                        </div>
                        <div style={{ height: '6px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(8, pct)}%`, height: '100%', background: activeBrandColor, borderRadius: '999px' }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => onNavigate(bottomRightTab === 'PAYROLL' ? 'payroll' : 'leave')}
              style={{
                padding: '9px 14px',
                borderRadius: '10px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#0f172a',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {bottomRightTab === 'PAYROLL' ? 'HR Payroll Desk' : 'Leave Desk'}
            </button>
            <Link
              href="/finance"
              style={{
                flex: 1,
                padding: '9px 14px',
                borderRadius: '10px',
                background: `linear-gradient(135deg, ${activeTintHex} 0%, ${activeBrandColor} 100%)`,
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
              }}
            >
              Finance Sign-Off <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
