'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  UserCheck,
  Calendar,
  Clock,
  AlertCircle,
  ArrowUpRight,
  Building2,
  Wallet,
  CheckCircle2,
} from 'lucide-react';
import {
  HrOverviewData,
  HrSectionId,
  formatNairaMinor,
} from './hrTypes';

interface HrOverviewPanelProps {
  data: HrOverviewData;
  onNavigate: (section: HrSectionId, presetFilter?: string) => void;
  onSelectSubsidiary: (subsidiaryId: string) => void;
}

export default function HrOverviewPanel({
  data,
  onNavigate,
  onSelectSubsidiary,
}: HrOverviewPanelProps) {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const { metrics, attendance7DayTrend, latestPayrollBatch, subsidiaries, todayStr } = data;

  const maxBar = Math.max(
    1,
    ...attendance7DayTrend.map((d) => Math.max(d.present, d.absent))
  );

  const totalPendingActions =
    metrics.pendingOnboarding +
    metrics.pendingLeaves +
    metrics.pendingExcuseRequests +
    metrics.pendingProfileUpdates;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top 4 KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
        }}
      >
        <button
          type="button"
          onClick={() => onNavigate('employees', 'ALL')}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '18px 20px',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Total Staff</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>
              {metrics.totalStaff}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Active across selected scope
            </div>
          </div>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#fff7ed',
              color: '#ea580c',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Users size={18} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('attendance', 'PRESENT')}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '18px 20px',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Present Today</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#059669', marginTop: '6px' }}>
              {metrics.presentToday}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              {metrics.absentToday} unrecorded / absent ({todayStr})
            </div>
          </div>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#ecfdf5',
              color: '#059669',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <UserCheck size={18} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('leave', 'APPROVED')}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '18px 20px',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>On Leave</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#2563eb', marginTop: '6px' }}>
              {metrics.onLeaveToday}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              {metrics.excusedToday} attendance excused
            </div>
          </div>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Calendar size={18} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('attendance', 'LATE')}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '18px 20px',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Late Today</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#d97706', marginTop: '6px' }}>
              {metrics.lateToday}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Click to review clock-in log
            </div>
          </div>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#fffbeb',
              color: '#d97706',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Clock size={18} />
          </div>
        </button>
      </div>

      {/* 7-Day Attendance Chart + HR Action Centre */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)',
          gap: '16px',
        }}
      >
        {/* 7-Day Attendance Chart */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '18px',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                Employee Attendance — Last 7 Days
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                Live daily check-ins vs. unrecorded staff (Africa/Lagos)
              </p>
            </div>
            <div style={{ display: 'flex', gap: '14px', fontSize: '12px', fontWeight: 600 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#3b82f6' }} />
                Present
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#22c55e' }} />
                Absent
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${attendance7DayTrend.length || 7}, 1fr)`,
              gap: '12px',
              alignItems: 'end',
              height: '200px',
              paddingTop: '24px',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            {attendance7DayTrend.map((day) => {
              const presentPct = Math.round((day.present / maxBar) * 100);
              const absentPct = Math.round((day.absent / maxBar) * 100);
              const isHovered = hoveredDay === day.date;
              return (
                <div
                  key={day.date}
                  onMouseEnter={() => setHoveredDay(day.date)}
                  onMouseLeave={() => setHoveredDay(null)}
                  style={{
                    position: 'relative',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isHovered && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-10px',
                        zIndex: 10,
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '8px 10px',
                        boxShadow: '0 8px 20px rgba(15,23,42,0.08)',
                        fontSize: '11px',
                        minWidth: '104px',
                        pointerEvents: 'none',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                        {day.dayLabel} · {day.date.slice(5)}
                      </div>
                      <div style={{ color: '#2563eb', fontWeight: 600 }}>Present: {day.present}</div>
                      <div style={{ color: '#16a34a', fontWeight: 600 }}>Absent: {day.absent}</div>
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: '5px',
                      height: '150px',
                      width: '100%',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: `${Math.max(day.present > 0 ? 10 : 4, presentPct)}%`,
                        background: '#3b82f6',
                        borderRadius: '6px 6px 2px 2px',
                        transition: 'height 0.2s ease',
                      }}
                    />
                    <div
                      style={{
                        width: '18px',
                        height: `${Math.max(day.absent > 0 ? 8 : 4, absentPct)}%`,
                        background: '#4ade80',
                        borderRadius: '6px 6px 2px 2px',
                        transition: 'height 0.2s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${attendance7DayTrend.length || 7}, 1fr)`,
              gap: '12px',
              marginTop: '8px',
              textAlign: 'center',
              fontSize: '12px',
              fontWeight: 600,
              color: '#64748b',
            }}
          >
            {attendance7DayTrend.map((day) => (
              <div key={day.date}>{day.dayLabel}</div>
            ))}
          </div>
        </div>

        {/* HR Action Centre */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
              HR Action Centre
            </h3>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: '999px',
                background: totalPendingActions > 0 ? '#fff7ed' : '#ecfdf5',
                color: totalPendingActions > 0 ? '#ea580c' : '#059669',
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
                padding: '11px 14px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {item.count > 0 ? (
                  <AlertCircle size={15} color="#ea580c" />
                ) : (
                  <CheckCircle2 size={15} color="#059669" />
                )}
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                  {item.label}
                </span>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: item.count > 0 ? '#ea580c' : '#64748b',
                }}
              >
                {item.count} →
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Row: Subsidiaries & Payroll Snapshot */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)',
          gap: '16px',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Building2 size={16} color="#ea580c" />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
              Workforce by Subsidiary
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
            {subsidiaries.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => {
                  onSelectSubsidiary(sub.id);
                  onNavigate('employees', 'ALL');
                }}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: sub.brandColor || '#ea580c',
                    }}
                  />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                    {sub.code}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#0f172a',
                    marginTop: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {sub.name}
                </div>
                <div style={{ fontSize: '12px', color: '#334155', marginTop: '4px', fontWeight: 600 }}>
                  {sub.staffCount} assigned staff
                </div>
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Wallet size={16} color="#ea580c" />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                Payroll Overview
              </h3>
            </div>
            {latestPayrollBatch ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '13px', color: '#475569' }}>
                  Period: <strong style={{ color: '#0f172a' }}>{latestPayrollBatch.yearMonth}</strong> (v
                  {latestPayrollBatch.version})
                </div>
                <div style={{ fontSize: '13px', color: '#475569' }}>
                  Status:{' '}
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: '#fff7ed',
                      color: '#ea580c',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  >
                    {latestPayrollBatch.status}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#475569' }}>
                  Headcount: <strong style={{ color: '#0f172a' }}>{latestPayrollBatch.totalHeadcount}</strong>
                </div>
                <div style={{ fontSize: '13px', color: '#475569' }}>
                  Gross / Net:{' '}
                  <strong style={{ color: '#0f172a' }}>
                    {formatNairaMinor(latestPayrollBatch.totalGrossMinor)}
                  </strong>{' '}
                  /{' '}
                  <strong style={{ color: '#059669' }}>
                    {formatNairaMinor(latestPayrollBatch.totalNetMinor)}
                  </strong>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#64748b' }}>No payroll batches generated yet.</p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => onNavigate('payroll')}
              style={{
                padding: '9px 14px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#0f172a',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              HR Payroll Desk
            </button>
            <Link
              href="/finance"
              style={{
                padding: '9px 14px',
                borderRadius: '8px',
                background: '#ea580c',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              Finance Payment Sign-Off <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
