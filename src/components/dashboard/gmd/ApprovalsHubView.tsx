'use client';

import React, { useState } from 'react';
import { ApprovalsDeskView } from './ApprovalsDeskView';
import { ApprovalMatrixView } from './ApprovalMatrixView';
import { EmergencyOverridesView } from './EmergencyOverridesView';

export type ApprovalsTab = 'desk' | 'matrix' | 'emergency';

interface ApprovalsHubViewProps {
  businessName: string;
  userName: string;
  initialTab?: ApprovalsTab;
  onNavigate: (page: string) => void;
  onSelectBusiness: (id: string) => void;
  onApprovedRequest?: (requestId: string) => void;
}

export function ApprovalsHubView({
  businessName,
  userName,
  initialTab = 'desk',
  onNavigate,
  onSelectBusiness,
  onApprovedRequest,
}: ApprovalsHubViewProps) {
  const [activeTab, setActiveTab] = useState<ApprovalsTab>(initialTab);

  return (
    <div style={{ width: '100%' }}>
      <nav aria-label="Approval workspace" style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', padding: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9, marginBottom: 12, width: 'fit-content', maxWidth: '100%' }}>
          <button
            type="button"
            aria-pressed={activeTab === 'desk'}
            onClick={() => setActiveTab('desk')}
            style={{
              padding: '7px 11px',
              fontSize: '12px',
              fontWeight: activeTab === 'desk' ? 700 : 500,
              color: activeTab === 'desk' ? '#fff' : '#52647c',
              background: activeTab === 'desk' ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : 'transparent',
              border: 0,
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Pending approvals
          </button>

          <button
            type="button"
            aria-pressed={activeTab === 'matrix'}
            onClick={() => setActiveTab('matrix')}
            style={{
              padding: '7px 11px',
              fontSize: '12px',
              fontWeight: activeTab === 'matrix' ? 700 : 500,
              color: activeTab === 'matrix' ? '#fff' : '#52647c',
              background: activeTab === 'matrix' ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : 'transparent',
              border: 0,
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Approval matrix
          </button>

          <button
            type="button"
            aria-pressed={activeTab === 'emergency'}
            onClick={() => setActiveTab('emergency')}
            style={{
              padding: '7px 11px',
              fontSize: '12px',
              fontWeight: activeTab === 'emergency' ? 700 : 500,
              color: activeTab === 'emergency' ? '#fff' : '#52647c',
              background: activeTab === 'emergency' ? '#b42318' : 'transparent',
              border: 0,
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Emergency overrides
          </button>
      </nav>

      {/* ACTIVE SUB-TAB CONTENT */}
      {activeTab === 'desk' && (
        <ApprovalsDeskView
          businessName={businessName}
          userName={userName}
          onNavigate={onNavigate}
          onSelectBusiness={onSelectBusiness}
          onApprovedRequest={onApprovedRequest}
        />
      )}
      {activeTab === 'matrix' && (
        <ApprovalMatrixView
          businessName={businessName}
          userName={userName}
          onNavigate={onNavigate}
          onSelectBusiness={onSelectBusiness}
        />
      )}
      {activeTab === 'emergency' && (
        <EmergencyOverridesView
          businessName={businessName}
          userName={userName}
          onNavigate={onNavigate}
          onSelectBusiness={onSelectBusiness}
        />
      )}
    </div>
  );
}
