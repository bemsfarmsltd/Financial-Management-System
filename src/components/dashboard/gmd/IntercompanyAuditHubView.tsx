'use client';

import React, { useState } from 'react';
import { IntercompanyClient } from '@/app/intercompany/IntercompanyClient';
import { AuditClient } from '@/app/audit/AuditClient';

export type IntercompanyTab = 'notes' | 'allocation' | 'audit';

interface IntercompanyAuditHubViewProps {
  businessName: string;
  userName: string;
  initialTab?: IntercompanyTab;
  onNavigate: (page: string) => void;
  onSelectBusiness: (id: string) => void;
}

export function IntercompanyAuditHubView({
  businessName,
  userName,
  initialTab = 'notes',
  onNavigate,
  onSelectBusiness,
}: IntercompanyAuditHubViewProps) {
  const [activeTab, setActiveTab] = useState<IntercompanyTab>(initialTab);

  return (
    <div style={{ width: '100%' }}>
      {/* HUB SUB-NAV BAR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: '#ffffff',
          padding: '12px 18px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          marginBottom: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '13px',
              boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)',
            }}
          >
            ▥
          </div>
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: '#0b1220' }}>
              Intercompany & Governance Hub
            </h2>
            <p style={{ fontSize: '10px', color: '#64748b', margin: 0 }}>
              Automated inter-entity debit notes, multi-entity cost splits, and immutable audit logs
            </p>
          </div>
        </div>

        {/* SUB-TABS */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: '#f8fafc',
            padding: '4px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
          }}
        >
          <button
            onClick={() => setActiveTab('notes')}
            style={{
              padding: '6px 14px',
              fontSize: '11px',
              fontWeight: activeTab === 'notes' ? 700 : 500,
              color: activeTab === 'notes' ? '#ffffff' : '#475569',
              background: activeTab === 'notes' ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : 'transparent',
              border: 0,
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>₦</span>
            <span>Debit / Credit Notes</span>
            <span
              style={{
                fontSize: '9px',
                padding: '1px 6px',
                borderRadius: '999px',
                background: activeTab === 'notes' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                color: activeTab === 'notes' ? '#ffffff' : '#0f172a',
                fontWeight: 700,
              }}
            >
              Tax Ready
            </span>
          </button>

          <button
            onClick={() => setActiveTab('allocation')}
            style={{
              padding: '6px 14px',
              fontSize: '11px',
              fontWeight: activeTab === 'allocation' ? 700 : 500,
              color: activeTab === 'allocation' ? '#ffffff' : '#475569',
              background: activeTab === 'allocation' ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : 'transparent',
              border: 0,
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>▥</span>
            <span>Cost Allocation Rules</span>
            <span
              style={{
                fontSize: '9px',
                padding: '1px 6px',
                borderRadius: '999px',
                background: activeTab === 'allocation' ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                color: activeTab === 'allocation' ? '#ffffff' : '#0f172a',
                fontWeight: 700,
              }}
            >
              Shared HQ
            </span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            style={{
              padding: '6px 14px',
              fontSize: '11px',
              fontWeight: activeTab === 'audit' ? 700 : 500,
              color: activeTab === 'audit' ? '#ffffff' : '#475569',
              background: activeTab === 'audit' ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : 'transparent',
              border: 0,
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <span>≡</span>
            <span>Immutable Audit Trail</span>
            <span
              style={{
                fontSize: '9px',
                padding: '1px 6px',
                borderRadius: '999px',
                background: activeTab === 'audit' ? 'rgba(255,255,255,0.25)' : '#ecfdf5',
                color: activeTab === 'audit' ? '#ffffff' : '#047857',
                fontWeight: 700,
              }}
            >
              SHA-256
            </span>
          </button>
        </div>
      </div>

      {/* ACTIVE SUB-TAB CONTENT */}
      {activeTab === 'notes' && (
        <div style={{ background: '#ffffff', borderRadius: '10px', padding: '16px', border: '1px solid #e2e8f0' }}>
          <IntercompanyClient />
        </div>
      )}

      {activeTab === 'allocation' && (
        <div style={{ background: '#ffffff', borderRadius: '10px', padding: '20px', border: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: '18px' }}>
            <p style={{ fontSize: '8px', fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              INTERCOMPANY ACCOUNTING
            </p>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0b1220', margin: '4px 0 2px' }}>
              Multi-Subsidiary Cost Allocation Matrix
            </h3>
            <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
              Automated formula splits for shared engineering salaries, group headquarters rent, and utility infrastructure.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Engineering Allocation</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#ea580c', marginTop: '4px' }}>70 / 30 Split</div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>BemsSoft 70% · Bems Farms 30%</div>
            </div>
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Group HQ & Legal</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0b1220', marginTop: '4px' }}>50 / 50 Split</div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Holding 50% · Operating 50%</div>
            </div>
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Utilities & Bandwidth</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>60 / 40 Split</div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Tech 60% · Logistics 40%</div>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                <th style={{ padding: '10px' }}>Cost Center / Function</th>
                <th style={{ padding: '10px' }}>Primary Paying Entity</th>
                <th style={{ padding: '10px' }}>Sharing Entity</th>
                <th style={{ padding: '10px' }}>Split Ratio</th>
                <th style={{ padding: '10px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Engineering & DevOps', 'BemsSoft Hub Ltd (70%)', 'Bems Logistics & Farms (30%)', '70 / 30 Split', 'Active'],
                ['Executive & Legal Group HQ', 'BEMS Group Holdings (50%)', 'BemsSoft Hub Ltd (50%)', '50 / 50 Split', 'Active'],
                ['Facility Power & High-Speed Internet', 'BemsSoft Hub Ltd (60%)', 'Bems Logistics & Farms (40%)', '60 / 40 Split', 'Active'],
                ['Security & Guard Retainers', 'BEMS Group Holdings (100%)', 'Recharged across Group', 'Direct Recharge', 'Active'],
              ].map(r => (
                <tr key={r[0]} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px', fontWeight: 600, color: '#0b1220' }}>{r[0]}</td>
                  <td style={{ padding: '10px', color: '#475569' }}>{r[1]}</td>
                  <td style={{ padding: '10px', color: '#475569' }}>{r[2]}</td>
                  <td style={{ padding: '10px', fontWeight: 700, color: '#ea580c' }}>{r[3]}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '999px', background: '#ecfdf5', color: '#059669', fontSize: '10px', fontWeight: 700 }}>
                      {r[4]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'audit' && (
        <div style={{ background: '#ffffff', borderRadius: '10px', padding: '16px', border: '1px solid #e2e8f0' }}>
          <AuditClient />
        </div>
      )}
    </div>
  );
}
