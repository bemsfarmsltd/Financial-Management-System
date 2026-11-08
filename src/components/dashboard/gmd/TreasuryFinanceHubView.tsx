'use client';

import Link from 'next/link';
import React from 'react';
import { DisbursementsDeskView } from './DisbursementsDeskView';
import { TreasuryAccountsView } from './TreasuryAccountsView';
import { PayrollSignOffView } from './PayrollSignOffView';
import { BudgetsClient } from '@/app/budgets/BudgetsClient';

export type TreasuryTab = 'disbursements' | 'treasury' | 'budgets' | 'payroll';

interface TreasuryFinanceHubViewProps {
  businessName: string;
  userName: string;
  scope?: string;
  businessId?: string;
  businessCode?: string;
  initialTab?: TreasuryTab;
  onNavigate: (page: string) => void;
  onSelectBusiness: (id: string) => void;
}

export function TreasuryFinanceHubView({
  businessName,
  userName,
  scope,
  businessId,
  businessCode,
  initialTab = 'disbursements',
  onNavigate,
  onSelectBusiness,
}: TreasuryFinanceHubViewProps) {
  return (
    <div style={{ width: '100%' }}>
      <Link href="/wallet/funding" className="mb-4 block rounded-lg bg-orange-700 px-4 py-3 font-bold text-white">Wallet funding and GMD releases</Link>
      {initialTab === 'disbursements' && (
        <DisbursementsDeskView
          businessName={businessName}
          userName={userName}
          scope={scope}
          businessId={businessId}
          businessCode={businessCode}
          onNavigate={onNavigate}
          onSelectBusiness={onSelectBusiness}
        />
      )}
      {initialTab === 'treasury' && (
        <TreasuryAccountsView
          businessName={businessName}
          userName={userName}
          scope={scope}
          businessId={businessId}
          businessCode={businessCode}
          onNavigate={onNavigate}
          onSelectBusiness={onSelectBusiness}
        />
      )}
      {initialTab === 'budgets' && (
        <div style={{ background: '#ffffff', borderRadius: '10px', padding: '16px', border: '1px solid #e2e8f0' }}>
          <BudgetsClient
            activeOrgId={businessId}
            activeOrgName={businessName}
            activeOrgCode={businessCode}
          />
        </div>
      )}
      {initialTab === 'payroll' && (
        <PayrollSignOffView
          businessName={businessName}
          userName={userName}
          onNavigate={onNavigate}
          onSelectBusiness={onSelectBusiness}
        />
      )}
    </div>
  );
}
