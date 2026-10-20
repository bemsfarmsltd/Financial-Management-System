'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface TelemetryItem {
  id: string;
  badge: string;
  topic: string;
  fullText: string;
  severity?: 'info' | 'highlight' | 'warning' | 'success';
  actionLabel?: string;
  actionPrompt?: string;
  actionTab?: string;
}

const PAGE_TELEMETRY: Record<string, TelemetryItem[]> = {
  Overview: [
    {
      id: 'ov-1',
      badge: 'GROUP LIQUIDITY',
      topic: 'CONSOLIDATED TREASURY',
      fullText: 'Consolidated group liquidity stands at ₦84.2M across 3 subsidiaries. 1 pending requisition requires GMD signature.',
      severity: 'highlight',
      actionLabel: 'Executive Briefing ➔',
      actionPrompt: 'Give me the full executive morning briefing on cash positions and pending approvals.',
    },
    {
      id: 'ov-2',
      badge: 'RUNWAY WATCH',
      topic: 'CAPEX TOLERANCE',
      fullText: 'Combined operating runway projected at 14.8 months at current burn rate. No high-risk burn acceleration detected.',
      severity: 'info',
      actionLabel: 'Simulate Runway ➔',
      actionPrompt: 'What happens to our runway if we delay non-critical software hires by 60 days?',
    },
  ],
  'Fund requests': [
    {
      id: 'fr-1',
      badge: 'REQUISITION AUDIT',
      topic: 'PIPELINE READY',
      fullText: 'Requisition pipeline operational. All incoming staff requests will be validated with 3-way matching and budget checks.',
      severity: 'info',
      actionLabel: 'New Fund Request ➔',
      actionPrompt: 'Help me draft a new expenditure request with complete vendor and budget justification.',
    },
    {
      id: 'fr-2',
      badge: 'VENDOR COMPLIANCE',
      topic: 'SUPPLIER REGISTRY',
      fullText: 'Vendor registry ready for verified CAC corporate profiles. Zero blacklist or tax identification anomalies.',
      severity: 'success',
      actionLabel: 'Scan Vendor Registry ➔',
      actionPrompt: 'Show supplier registry health and 3-way matching status for registered vendors.',
    },
  ],
  'Approvals & payments': [
    {
      id: 'ap-1',
      badge: 'APPROVAL GATE',
      topic: 'ALL QUEUES CLEAR',
      fullText: 'Approvals gate active. All pending requisitions have been resolved. Next submissions will be routed here automatically.',
      severity: 'success',
      actionLabel: 'Review Policy ➔',
      actionPrompt: 'Explain the multi-tier approval threshold policy and GMD override rules.',
    },
    {
      id: 'ap-2',
      badge: 'DISBURSEMENT QUEUE',
      topic: 'PAYMENT RECORDER',
      fullText: 'Disbursement protocol requires secondary payment recorder assignment upon approval.',
      severity: 'info',
      actionLabel: 'View Payment SOP ➔',
      actionPrompt: 'Explain payment recorder assignment and dual-authorization policy.',
    },
  ],
  'Budgets & commitments': [
    {
      id: 'bg-1',
      badge: 'BUDGET ENVELOPE',
      topic: 'Q4 ALLOCATIONS',
      fullText: 'Active department envelopes: Software (₦25M), Logistics (₦40M), Holding (₦15M). Total spend tracking within tolerance.',
      severity: 'info',
      actionLabel: 'Reallocate Budget ➔',
      actionPrompt: 'Propose a budget adjustment for Software and Logistics with line item breakdown.',
    },
    {
      id: 'bg-2',
      badge: 'COMMITMENT TRACKER',
      topic: 'VARIANCE ALERT',
      fullText: 'BemsSoft Cloud Hosting budget line is 42% utilized. ₦5.8M committed headroom remaining for current fiscal quarter.',
      severity: 'success',
      actionLabel: 'Inspect Breakdown ➔',
      actionPrompt: 'Provide detailed breakdown of BemsSoft Cloud Hosting expenditure commitments.',
    },
  ],
  'Subsidiary portfolio': [
    {
      id: 'sub-1',
      badge: 'MULTI-TENANT GOVERNANCE',
      topic: 'SUBSIDIARY STATUS',
      fullText: '3 operating subsidiaries synced. Isolated fiscal boundaries maintained. Zero intercompany compliance leaks detected.',
      severity: 'info',
      actionLabel: 'Compare Performance ➔',
      actionPrompt: 'Compare financial performance and cash burn across all three subsidiaries.',
    },
  ],
  'Intercompany notes': [
    {
      id: 'ic-1',
      badge: 'INTERCOMPANY NETTING',
      topic: 'DEBIT/CREDIT AUTOMATION',
      fullText: 'Tracking Debit Note DN-202610-0012 (₦1,450,000) for shared DevOps infrastructure between BemsSoft and BEMS Group.',
      severity: 'highlight',
      actionLabel: 'View Netting Matrix ➔',
      actionPrompt: 'Show intercompany debit and credit balances and recommend automated settlement.',
    },
  ],
  'Payroll & HR': [
    {
      id: 'pr-1',
      badge: 'PAYROLL LIQUIDITY',
      topic: 'SALARY RUNTIME',
      fullText: '5 active personnel accounts verified across group entities. Next scheduled payroll batch funded with ₦18.5M allocated.',
      severity: 'info',
      actionLabel: 'Salary Analysis ➔',
      actionPrompt: 'Analyze group payroll distribution and show compensation variance.',
    },
  ],
  Disbursements: [
    {
      id: 'db-1',
      badge: 'OFF-PLATFORM TRACKING',
      topic: 'DISBURSEMENT AUDIT',
      fullText: '1 off-platform transfer logged (₦600,000 to AWS Nigeria). Verification receipt attached with matching bank reference.',
      severity: 'success',
      actionLabel: 'Record Disbursement ➔',
      actionPrompt: 'Help me record an off-platform bank transfer disbursement with receipt reference.',
    },
  ],
  'Audit & compliance': [
    {
      id: 'au-1',
      badge: 'AUDIT LEDGER',
      topic: 'CRYPTOGRAPHIC TRAIL',
      fullText: 'Audit vault online. Zero tamper flags detected across 48 ledger journal records. Immutable event provenance confirmed.',
      severity: 'success',
      actionLabel: 'Audit Digest ➔',
      actionPrompt: 'Generate full cryptographic compliance digest for the Board.',
    },
  ],
};

const DEFAULT_ITEM: TelemetryItem = {
  id: 'def-1',
  badge: 'AI FINANCIAL MANAGER',
  topic: 'REAL-TIME MONITOR',
  fullText: 'Autonomous executive intelligence active. Monitoring group transactions, liquidity envelopes, and approval gates.',
  severity: 'info',
  actionLabel: 'Open Copilot ➔',
  actionPrompt: 'Give me an executive summary of current group financial health.',
};

export function useAmbientTelemetry({
  currentPage = 'Overview',
  businessName = 'BEMS Group Holdings Ltd',
}: {
  currentPage?: string;
  businessName?: string;
}) {
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [overrideItem, setOverrideItem] = useState<TelemetryItem | null>(null);

  const items = PAGE_TELEMETRY[currentPage] || [DEFAULT_ITEM];
  const activeItem = overrideItem || items[activeItemIndex % items.length] || DEFAULT_ITEM;

  // Custom text with current business name injected if applicable
  const resolvedText = activeItem.fullText.replace('{businessName}', businessName);

  // Typewriter effect
  useEffect(() => {
    let charIndex = 0;
    setDisplayText('');
    setIsTyping(true);

    const speed = 18; // ms per char for snappy, responsive feel
    const interval = window.setInterval(() => {
      charIndex++;
      if (charIndex <= resolvedText.length) {
        setDisplayText(resolvedText.slice(0, charIndex));
      } else {
        setIsTyping(false);
        window.clearInterval(interval);
      }
    }, speed);

    return () => window.clearInterval(interval);
  }, [resolvedText, activeItem.id]);

  // Rotate items smoothly if user remains on page
  useEffect(() => {
    setOverrideItem(null);
    setActiveItemIndex(0);

    const rotationTimer = window.setInterval(() => {
      setActiveItemIndex((prev) => (prev + 1) % items.length);
    }, 18000); // cycle every 18 seconds

    return () => window.clearInterval(rotationTimer);
  }, [currentPage, items.length]);

  const pushInteractiveTelemetry = useCallback((item: TelemetryItem) => {
    setOverrideItem(item);
  }, []);

  const skipTyping = useCallback(() => {
    setDisplayText(resolvedText);
    setIsTyping(false);
  }, [resolvedText]);

  return {
    telemetry: activeItem,
    displayText,
    isTyping,
    skipTyping,
    pushInteractiveTelemetry,
  };
}
