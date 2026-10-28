'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  AlertTriangle,
  Building2,
  Clock,
  Download,
  CheckCircle2,
  ChevronRight,
  Printer,
  Wallet
} from 'lucide-react';

interface Organization {
  id: string;
  legalName: string;
  code: string;
  type: string;
  status: string;
  currency: string;
}

interface RequestItem {
  id: string;
  requestNumber: string;
  title: string;
  justification: string;
  deliverable: string;
  category: string;
  requestType: string;
  amountMinor: string;
  amountNaira: number;
  currency: string;
  approvalStatus: string;
  paymentStatus: string;
  accountabilityStatus: string;
  createdAt: string;
  neededBy: string;
  subsidiary: {
    id: string;
    legalName: string;
    code: string;
  };
  requester: {
    id: string;
    legalName: string;
    role: string;
    workEmail: string;
  };
  approvalSteps: {
    id: string;
    stageIndex: number;
    assignedRole: string;
    status: string;
    approverName: string | null;
    decidedAt: string | null;
    decisionReason: string | null;
  }[];
}

interface BudgetLine {
  id: string;
  departmentName: string;
  category: string;
  expenseType: string;
  allocatedAmount: number;
  committedAmount: number;
  spentAmount: number;
  status: string;
}

interface BudgetItem {
  id: string;
  organizationId: string;
  fiscalYear: number;
  fiscalPeriod: string;
  periodName: string;
  totalAmount: number;
  committedAmount: number;
  spentAmount: number;
  status: string;
  warningThreshold: number;
  organization: {
    id: string;
    legalName: string;
    code: string;
  };
  lines: BudgetLine[];
}

interface AccountabilityCaseItem {
  id: string;
  status: string;
  requiredDeliverables: string;
  dueAt: string;
  closureNotes: string | null;
  request: {
    id: string;
    requestNumber: string;
    title: string;
    amountNaira: number;
    currency: string;
    subsidiary: {
      legalName: string;
      code: string;
    };
    requester: {
      legalName: string;
      role: string;
    };
  };
}

interface DisbursementItem {
  id: string;
  amountNaira: number;
  externalReference: string;
  bankName: string;
  paidAt: string;
  status: string;
  payerOrg: {
    legalName: string;
    code: string;
  };
}

interface Props {
  organizations: Organization[];
  requests: RequestItem[];
  budgets: BudgetItem[];
  accountabilityCases: AccountabilityCaseItem[];
  disbursements: DisbursementItem[];
}

export function ExecutiveBriefingClient({
  organizations: initialOrgs = [],
  requests: initialRequests = [],
  budgets: initialBudgets = [],
  accountabilityCases: initialCases = [],
  disbursements: initialDisbursements = [],
}: Partial<Props> = {}) {
  const router = useRouter();
  const [selectedSub, setSelectedSub] = useState<string>('ALL');
  const [orgs, setOrgs] = useState<Organization[]>(initialOrgs);
  const [requestsList, setRequestsList] = useState<RequestItem[]>(initialRequests);
  const [budgetsList, setBudgetsList] = useState<BudgetItem[]>(initialBudgets);
  const [casesList, setCasesList] = useState<AccountabilityCaseItem[]>(initialCases);
  const [disbList, setDisbList] = useState<DisbursementItem[]>(initialDisbursements);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/treasury')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && Array.isArray(d.accounts) && d.accounts.length > 0) {
          setBankAccounts(d.accounts);
        }
      })
      .catch(() => {});

    if (initialOrgs.length === 0 && initialRequests.length === 0) {
      fetch('/api/briefing')
        .then((r) => r.json())
        .then((d) => {
          if (d.organizations) setOrgs(d.organizations);
          if (d.requests) setRequestsList(d.requests);
          if (d.budgets) setBudgetsList(d.budgets);
          if (d.accountabilityCases) setCasesList(d.accountabilityCases);
          if (d.disbursements) setDisbList(d.disbursements);
          if (d.treasuryAccounts && Array.isArray(d.treasuryAccounts) && d.treasuryAccounts.length > 0) {
            setBankAccounts(prev => prev.length === 0 ? d.treasuryAccounts.map((a: any, i: number) => ({
              id: `acc-${i + 1}`,
              bankName: a.bankName,
              accountName: a.accountName || a.bankName,
              accountNumber: a.accountNumber,
              accountType: a.accountType || 'Corporate Operational',
              balance: a.balanceNaira || a.balance || 0,
              status: 'Active',
              assignedSubsidiary: a.assignedSubsidiary || a.organization?.legalName || (a.scope === 'HQ' ? 'BEMS Group Holdings Ltd (HQ)' : 'BEMS Subsidiary'),
            })) : prev);
          }
        })
        .catch(console.error);
    }
  }, [initialOrgs.length, initialRequests.length]);

  // Decision Modal State
  const [activeDecisionReq, setActiveDecisionReq] = useState<RequestItem | null>(null);
  const [decisionAction, setDecisionAction] = useState<'APPROVE' | 'REJECT' | 'REQUEST_CLARIFICATION'>('APPROVE');
  const [decisionReason, setDecisionReason] = useState<string>('');

  // Filter based on selected subsidiary
  const filteredRequests = useMemo(() => {
    if (selectedSub === 'ALL') return requestsList;
    return requestsList.filter((r) => r.subsidiary?.id === selectedSub || r.subsidiary?.legalName.includes(selectedSub));
  }, [requestsList, selectedSub]);

  const filteredBudgets = useMemo(() => {
    if (selectedSub === 'ALL') return budgetsList;
    return budgetsList.filter((b) => b.organizationId === selectedSub || b.organization?.legalName.includes(selectedSub));
  }, [budgetsList, selectedSub]);

  const filteredAccountability = useMemo(() => {
    if (selectedSub === 'ALL') return casesList;
    return casesList.filter((c) => c.request?.subsidiary?.legalName.includes(selectedSub));
  }, [casesList, selectedSub]);

  // Telemetry Calculations
  const totalVerifiedDisbursed = useMemo(() => {
    return disbList.reduce((acc, d) => acc + d.amountNaira, 0);
  }, [disbList]);

  const totalCommitted = useMemo(() => {
    return filteredRequests
      .filter((r) => r.approvalStatus === 'APPROVED' && r.paymentStatus !== 'VERIFIED_PAID')
      .reduce((acc, r) => acc + r.amountNaira, 0);
  }, [filteredRequests]);

  const tier3Escalations = useMemo(() => {
    return filteredRequests.filter(
      (r) =>
        (r.amountNaira > 2000000 || r.category === 'ASSET') &&
        (r.approvalStatus === 'SUBMITTED' || r.approvalStatus === 'IN_REVIEW')
    );
  }, [filteredRequests]);

  const totalEscalationsValue = useMemo(() => {
    return tier3Escalations.reduce((acc, r) => acc + r.amountNaira, 0);
  }, [tier3Escalations]);

  // Corporate bank accounts (derived directly from live treasury registry)
  const corporateTreasury = useMemo(() => {
    const totalLiquid = bankAccounts.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);
    const bankNames = bankAccounts.map((a) => a.bankName).filter(Boolean);
    const uniqueBankNames = Array.from(new Set(bankNames));
    return {
      totalLiquid,
      bankListLabel: uniqueBankNames.length > 0 ? uniqueBankNames.join(' & ') : 'No accounts configured',
      hasAccounts: bankAccounts.length > 0,
    };
  }, [bankAccounts]);

  // Real monthly burn based on verified disbursements
  const monthlyBurn = useMemo(() => {
    const totalDisb = disbList.reduce((acc, d) => acc + d.amountNaira, 0);
    return totalDisb;
  }, [disbList]);

  const runwayMonths = useMemo(() => {
    if (corporateTreasury.totalLiquid <= 0) return '0.0';
    if (monthlyBurn <= 0) return '12.0';
    return (corporateTreasury.totalLiquid / monthlyBurn).toFixed(1);
  }, [corporateTreasury.totalLiquid, monthlyBurn]);

  // Receipts and Proof Score
  const proofScore = useMemo(() => {
    if (filteredAccountability.length === 0) return '0.0%';
    const verified = filteredAccountability.filter(
      (c) => c.status === 'VERIFIED' || c.status === 'CLOSED'
    ).length;
    return `${((verified / filteredAccountability.length) * 100).toFixed(1)}%`;
  }, [filteredAccountability]);

  // Decision submit handler
  const handleExecuteDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDecisionReq) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/requests/${activeDecisionReq.requestNumber}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: decisionAction,
          actorId: 'gmd-exec-user',
          actorName: 'Group Managing Director',
          actorRole: 'GMD',
          decisionReason: decisionReason || (decisionAction === 'APPROVE' ? 'Approved by GMD.' : 'Further review requested.'),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to record decision.');
      }

      setRequestsList((prev) =>
        prev.map((r) => {
          if (r.id === activeDecisionReq.id) {
            return {
              ...r,
              approvalStatus: decisionAction === 'APPROVE' ? 'APPROVED' : decisionAction === 'REJECT' ? 'REJECTED' : 'CLARIFICATION_REQUESTED',
            };
          }
          return r;
        })
      );

      setNotice(`Done! Recorded ${decisionAction.toLowerCase()} for ${activeDecisionReq.requestNumber}.`);
      setActiveDecisionReq(null);
      setDecisionReason('');
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Error saving decision');
    } finally {
      setActionLoading(false);
    }
  };

  // Export Briefing CSV
  const handleExportBriefing = () => {
    const rows = [
      ['BEMS GROUP EXECUTIVE BRIEFING'],
      ['Date', new Date().toLocaleDateString('en-GB')],
      ['Company View', selectedSub === 'ALL' ? 'All Companies' : selectedSub],
      [''],
      ['KEY METRICS'],
      ['Cash Runway', `${runwayMonths} Months`],
      ['Total Cash in Banks', `NGN ${corporateTreasury.totalLiquid.toLocaleString()}`],
      ...(bankAccounts.length > 0
        ? bankAccounts.map((a) => [a.bankName || 'Bank Account', `NGN ${(Number(a.balance) || 0).toLocaleString()}`])
        : [['Bank Accounts', 'No accounts configured']]),
      ['Awaiting Your Approval', `${tier3Escalations.length} requests (NGN ${totalEscalationsValue.toLocaleString()})`],
      ['Approved (Unpaid)', `NGN ${totalCommitted.toLocaleString()}`],
      ['Paid Out', `NGN ${totalVerifiedDisbursed.toLocaleString()}`],
      ['Receipts & Proof Score', proofScore],
      [''],
      ['REQUESTS AWAITING APPROVAL'],
      ['Request Number', 'Title', 'Company', 'Amount NGN', 'Status', 'Category'],
      ...tier3Escalations.map((r) => [
        r.requestNumber,
        `"${r.title.replaceAll('"', '""')}"`,
        r.subsidiary.legalName,
        r.amountNaira,
        r.approvalStatus,
        r.category,
      ]),
      [''],
      ['COMPANY BUDGETS'],
      ['Company', 'Budget NGN', 'Spent NGN', 'Approved (Unpaid) NGN', 'Remaining NGN', 'Budget Used %'],
      ...filteredBudgets.map((b) => {
        const spent = b.spentAmount;
        const comm = b.committedAmount;
        const avail = b.totalAmount - (spent + comm);
        const pct = b.totalAmount > 0 ? Math.round(((spent + comm) / b.totalAmount) * 100) : 0;
        return [b.organization.legalName, b.totalAmount, spent, comm, avail, `${pct}%`];
      }),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Executive_Briefing_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="executive-briefing-wrap" style={{ paddingBottom: '50px' }}>
      {/* Toast Notice */}
      {notice && (
        <div
          style={{
            position: 'fixed',
            top: '90px',
            right: '25px',
            zIndex: 100,
            background: '#071a40',
            color: '#fff',
            padding: '12px 18px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
          }}
        >
          <CheckCircle2 size={16} color="#4ee0ba" />
          <span>{notice}</span>
          <button
            onClick={() => setNotice(null)}
            style={{
              marginLeft: '10px',
              border: 0,
              background: 'transparent',
              color: '#9fb4d8',
              cursor: 'pointer',
              fontSize: '15px',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* HEADER SECTION - Clean, Short & Human */}
      <div
        className="section-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: '800',
                letterSpacing: '0.08em',
                color: 'var(--blue)',
                background: 'rgba(16, 94, 232, 0.08)',
                padding: '3px 8px',
                borderRadius: '6px',
              }}
            >
              EXECUTIVE BRIEFING
            </span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <h1 style={{ fontSize: '24px', color: 'var(--navy)', margin: '0 0 4px', fontWeight: '800' }}>
            Daily Executive Briefing
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
            Overview of bank balances, pending approvals, and company spending.
          </p>
        </div>

        {/* Action Buttons & Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', border: '1px solid var(--line)', borderRadius: '9px', padding: '4px 10px' }}>
            <Building2 size={14} color="var(--blue)" />
            <select
              aria-label="Filter Company"
              value={selectedSub}
              onChange={(e) => setSelectedSub(e.target.value)}
              style={{
                border: 0,
                outline: 0,
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--navy)',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Companies</option>
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.legalName}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExportBriefing}
            className="outline-button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              padding: '7px 12px',
              borderRadius: '9px',
              background: '#fff',
              border: '1px solid var(--line)',
              color: 'var(--navy)',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            <Download size={13} />
            Export CSV
          </button>

          <button
            onClick={() => window.print()}
            className="outline-button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              padding: '7px 12px',
              borderRadius: '9px',
              background: '#fff',
              border: '1px solid var(--line)',
              color: 'var(--navy)',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            <Printer size={13} />
            Print
          </button>
        </div>
      </div>

      {/* 4 CLEAR KPI TILES */}
      <div
        className="customer-summary"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        {/* Metric 1: Cash Runway */}
        <article
          style={{
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            color: '#fff',
            borderRadius: '14px',
            padding: '18px 20px',
            boxShadow: '0 6px 20px rgba(234, 88, 12, 0.25)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <small style={{ color: '#ffedd5', fontSize: '10px', fontWeight: '800', letterSpacing: '0.08em' }}>
              SAFE CASH CUSHION
            </small>
            <Clock size={15} color="#fed7aa" />
          </div>
          <strong style={{ display: 'block', fontSize: '28px', margin: '6px 0 2px', fontWeight: '800', color: '#fff' }}>
            {runwayMonths} <span style={{ fontSize: '15px', fontWeight: '500' }}>Months</span>
          </strong>
          <span style={{ fontSize: '11px', color: '#ffedd5' }}>
            {monthlyBurn > 0 ? `At ~₦${(monthlyBurn / 1000000).toFixed(1)}M monthly spend` : 'Safe cash reserve'}
          </span>
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: corporateTreasury.totalLiquid > 0 ? '#ffedd5' : 'rgba(255,255,255,0.4)' }} />
            <small style={{ fontSize: '10px', color: '#ffffff', fontWeight: '700' }}>
              {corporateTreasury.totalLiquid > 0 ? 'Safe cash reserve' : 'Awaiting treasury setup'}
            </small>
          </div>
        </article>

        {/* Metric 2: Liquid Cash */}
        <article
          style={{
            background: '#fff',
            border: '1px solid var(--line)',
            borderRadius: '14px',
            padding: '18px 20px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <small style={{ color: 'var(--muted)', fontSize: '10px', fontWeight: '800', letterSpacing: '0.08em' }}>
              TOTAL CASH IN BANKS
            </small>
            <Wallet size={15} color="var(--blue)" />
          </div>
          <strong style={{ display: 'block', fontSize: '26px', margin: '6px 0 2px', fontWeight: '800', color: 'var(--navy)' }}>
            ₦{corporateTreasury.totalLiquid.toLocaleString()}
          </strong>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
            {corporateTreasury.bankListLabel}
          </span>
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            {corporateTreasury.hasAccounts ? (
              <>
                <CheckCircle2 size={12} color="#059669" />
                <small style={{ fontSize: '10px', color: '#059669', fontWeight: '600' }}>
                  All bank accounts balanced
                </small>
              </>
            ) : (
              <>
                <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#94a3b8' }} />
                <small style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>
                  Awaiting account setup
                </small>
              </>
            )}
          </div>
        </article>

        {/* Metric 3: Needs Your Approval */}
        <article
          style={{
            background: '#fff',
            border: '1px solid var(--line)',
            borderRadius: '14px',
            padding: '18px 20px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <small style={{ color: 'var(--muted)', fontSize: '10px', fontWeight: '800', letterSpacing: '0.08em' }}>
              WAITING FOR YOUR APPROVAL
            </small>
            <AlertTriangle size={15} color="#d97706" />
          </div>
          <strong style={{ display: 'block', fontSize: '26px', margin: '6px 0 2px', fontWeight: '800', color: tier3Escalations.length > 0 ? '#d97706' : 'var(--navy)' }}>
            {tier3Escalations.length} <span style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: '500' }}>Pending</span>
          </strong>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
            {tier3Escalations.length > 0 ? `₦${totalEscalationsValue.toLocaleString()} total` : 'All requests approved'}
          </span>
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: tier3Escalations.length > 0 ? '#d97706' : '#059669' }} />
            <small style={{ fontSize: '10px', color: tier3Escalations.length > 0 ? '#d97706' : '#059669', fontWeight: '600' }}>
              {tier3Escalations.length > 0 ? 'Signature required' : 'All signed'}
            </small>
          </div>
        </article>

        {/* Metric 4: Receipts Score */}
        <article
          style={{
            background: '#fff',
            border: '1px solid var(--line)',
            borderRadius: '14px',
            padding: '18px 20px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <small style={{ color: 'var(--muted)', fontSize: '10px', fontWeight: '800', letterSpacing: '0.08em' }}>
              STAFF RECEIPTS ON TIME
            </small>
            <ShieldCheck size={15} color={filteredAccountability.length > 0 ? '#059669' : '#64748b'} />
          </div>
          <strong style={{ display: 'block', fontSize: '26px', margin: '6px 0 2px', fontWeight: '800', color: filteredAccountability.length > 0 ? '#059669' : 'var(--navy)' }}>
            {proofScore}
          </strong>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
            {filteredAccountability.length > 0 ? `${filteredAccountability.length} staff advance${filteredAccountability.length > 1 ? 's' : ''} being tracked` : '0 advances awaiting proof'}
          </span>
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            {filteredAccountability.length > 0 ? (
              <>
                <CheckCircle2 size={12} color="#059669" />
                <small style={{ fontSize: '10px', color: '#059669', fontWeight: '600' }}>
                  Receipts tracked live
                </small>
              </>
            ) : (
              <>
                <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#059669' }} />
                <small style={{ fontSize: '10px', color: '#059669', fontWeight: '600' }}>
                  All receipts submitted
                </small>
              </>
            )}
          </div>
        </article>
      </div>

      {/* SECTION 1: REQUESTS AWAITING APPROVAL */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <h2 style={{ fontSize: '16px', color: 'var(--navy)', margin: '0 0 2px', fontWeight: '800' }}>
              Requests Awaiting Your Decision
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
              Expenses over ₦2,000,000 or company assets that need your sign-off.
            </p>
          </div>
          <Link
            href="/approvals"
            style={{
              fontSize: '12px',
              color: 'var(--blue)',
              fontWeight: '600',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            All Approvals <ChevronRight size={13} />
          </Link>
        </div>

        {tier3Escalations.length === 0 ? (
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--line)',
              borderRadius: '14px',
              padding: '28px',
              textAlign: 'center',
            }}
          >
            <CheckCircle2 size={30} color="#059669" style={{ margin: '0 auto 8px' }} />
            <h3 style={{ margin: '0 0 4px', fontSize: '14px', color: 'var(--navy)' }}>All caught up!</h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
              No requests are currently waiting for your approval.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {tier3Escalations.map((req) => (
              <div
                key={req.id}
                style={{
                  background: '#fff',
                  border: '1px solid #fed7aa',
                  borderLeft: '4px solid #f97316',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 2px 8px rgba(249, 115, 22, 0.04)',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ flex: '1 1 500px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '2px 7px',
                        borderRadius: '5px',
                        background: '#fff7ed',
                        color: '#c2410c',
                      }}
                    >
                      {req.requestNumber}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '2px 7px',
                        borderRadius: '5px',
                        background: '#fef3c7',
                        color: '#92400e',
                      }}
                    >
                      Over ₦2M
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {req.subsidiary.legalName}
                    </span>
                  </div>

                  <h3 style={{ margin: '0 0 4px', fontSize: '15px', color: 'var(--navy)', fontWeight: '700' }}>
                    {req.title}
                  </h3>
                  <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#475569', lineHeight: 1.4 }}>
                    {req.justification}
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)' }}>
                    From <strong>{req.requester.legalName}</strong> · Needed by{' '}
                    {new Date(req.neededBy).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                </div>

                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <strong style={{ fontSize: '22px', color: 'var(--navy)', fontWeight: '800' }}>
                    ₦{req.amountNaira.toLocaleString()}
                  </strong>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <Link
                      href={`/requests/${req.requestNumber}`}
                      style={{
                        fontSize: '11px',
                        padding: '6px 11px',
                        borderRadius: '7px',
                        border: '1px solid var(--line)',
                        background: '#fff',
                        color: 'var(--navy)',
                        textDecoration: 'none',
                        fontWeight: '600',
                      }}
                    >
                      Open Request ↗
                    </Link>

                    <button
                      onClick={() => {
                        setActiveDecisionReq(req);
                        setDecisionAction('APPROVE');
                      }}
                      style={{
                        fontSize: '11px',
                        padding: '6px 12px',
                        borderRadius: '7px',
                        border: 0,
                        background: '#059669',
                        color: '#fff',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <CheckCircle2 size={12} />
                      Approve
                    </button>

                    <button
                      onClick={() => {
                        setActiveDecisionReq(req);
                        setDecisionAction('REQUEST_CLARIFICATION');
                      }}
                      style={{
                        fontSize: '11px',
                        padding: '6px 10px',
                        borderRadius: '7px',
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        color: '#334155',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Ask Question
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: COMPANY BUDGETS */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <h2 style={{ fontSize: '16px', color: 'var(--navy)', margin: '0 0 2px', fontWeight: '800' }}>
              Company Budgets & Spending
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
              Budget, money spent, and balance remaining for each company.
            </p>
          </div>
          <Link
            href="/budgets"
            style={{
              fontSize: '12px',
              color: 'var(--blue)',
              fontWeight: '600',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            All Budgets <ChevronRight size={13} />
          </Link>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid var(--line)',
            borderRadius: '14px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.2fr 1.2fr 1.2fr 1.2fr 1.5fr',
              padding: '10px 18px',
              background: '#f8fafc',
              borderBottom: '1px solid var(--line)',
              fontSize: '10px',
              fontWeight: '700',
              color: '#64748b',
              letterSpacing: '0.04em',
            }}
          >
            <span>BUSINESS DIVISION</span>
            <span>APPROVED BUDGET</span>
            <span>MONEY SPENT</span>
            <span>APPROVED (UNPAID)</span>
            <span>MONEY REMAINING</span>
            <span>BUDGET SPENT</span>
          </div>

          {filteredBudgets.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
              No active budgets configured yet for this company. All expenditure is tracked against approved requisition limits.
            </div>
          ) : (
            filteredBudgets.map((b) => {
            const spent = b.spentAmount;
            const comm = b.committedAmount;
            const totalUsed = spent + comm;
            const available = Math.max(0, b.totalAmount - totalUsed);
            const pct = b.totalAmount > 0 ? Math.round((totalUsed / b.totalAmount) * 100) : 0;
            const isWarning = pct >= (b.warningThreshold || 80);

            return (
              <div
                key={b.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.2fr 1.2fr 1.2fr 1.2fr 1.5fr',
                  padding: '14px 18px',
                  borderBottom: '1px solid #f1f5f9',
                  alignItems: 'center',
                  fontSize: '12px',
                }}
              >
                <div>
                  <strong style={{ color: 'var(--navy)', display: 'block', fontSize: '13px' }}>
                    {b.organization.legalName}
                  </strong>
                  <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                    {b.periodName}
                  </small>
                </div>

                <div style={{ fontWeight: '700', color: 'var(--navy)' }}>
                  ₦{b.totalAmount.toLocaleString()}
                </div>

                <div style={{ color: '#059669', fontWeight: '600' }}>
                  ₦{spent.toLocaleString()}
                </div>

                <div style={{ color: '#d97706', fontWeight: '600' }}>
                  ₦{comm.toLocaleString()}
                </div>

                <div style={{ color: available > 0 ? 'var(--navy)' : '#dc2626', fontWeight: '700' }}>
                  ₦{available.toLocaleString()}
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: isWarning ? '#d97706' : '#059669' }}>
                      {pct}%
                    </span>
                    <small style={{ fontSize: '10px', color: 'var(--muted)' }}>
                      of ₦{b.totalAmount.toLocaleString()}
                    </small>
                  </div>
                  <div
                    style={{
                      height: '5px',
                      background: '#e2e8f0',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        height: '100%',
                        background: isWarning ? '#d97706' : 'var(--blue)',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          }))}
        </div>
      </div>

      {/* SECTION 3: BANK ACCOUNTS */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <h2 style={{ fontSize: '16px', color: 'var(--navy)', margin: '0 0 2px', fontWeight: '800' }}>
              Company Bank Accounts
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
              Current balances in our primary bank accounts.
            </p>
          </div>
          <button
            onClick={() => router.push('/finance?tab=Treasury+accounts')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--line)',
              background: '#fff',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--orange, #ea580c)',
              cursor: 'pointer'
            }}
          >
            ＋ Add / Manage Bank Accounts
          </button>
        </div>

        {bankAccounts.length === 0 ? (
          <div style={{
            background: '#fff',
            border: '1px dashed var(--line)',
            borderRadius: '12px',
            padding: '28px 20px',
            textAlign: 'center'
          }}>
            <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--muted)' }}>
              No company bank accounts configured yet.
            </p>
            <button
              onClick={() => router.push('/finance?tab=Treasury+accounts')}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                border: 'none',
                background: '#ea580c',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ＋ Add Bank Account in Treasury
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
            {bankAccounts.map((acc) => (
              <div
                key={acc.id}
                style={{
                  background: '#fff',
                  border: '1px solid var(--line)',
                  borderRadius: '14px',
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--blue)', background: '#eff6ff', padding: '2px 7px', borderRadius: '5px' }}>
                      {acc.accountType}
                    </span>
                    <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>● {acc.status || 'Active'}</span>
                  </div>
                  <h3 style={{ margin: '0 0 2px', fontSize: '15px', color: 'var(--navy)', fontWeight: '800' }}>
                    {acc.bankName}
                  </h3>
                  <p style={{ margin: '0 0 14px', fontSize: '11px', color: 'var(--muted)' }}>
                    Account: {acc.accountNumber} · {acc.accountName}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                  <div>
                    <small style={{ color: 'var(--muted)', fontSize: '10px' }}>AVAILABLE BALANCE</small>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--navy)' }}>
                      {acc.balanceFormatted}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <small style={{ color: 'var(--muted)', fontSize: '10px' }}>DAILY LIMIT</small>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#ea580c' }}>
                      {acc.dailyLimitFormatted}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 4: DELIVERABLES & PROOFS */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <h2 style={{ fontSize: '16px', color: 'var(--navy)', margin: '0 0 2px', fontWeight: '800' }}>
              Receipts & Proof Waiting for Review
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
              Proof from staff showing how disbursed funds were spent.
            </p>
          </div>
          <Link
            href="/accountability"
            style={{
              fontSize: '12px',
              color: 'var(--blue)',
              fontWeight: '600',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            All Proofs <ChevronRight size={13} />
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredAccountability.length === 0 ? (
            <div style={{ padding: '24px', background: '#fff', borderRadius: '14px', border: '1px solid var(--line)', textAlign: 'center' }}>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px' }}>
                All receipts and proofs are up to date.
              </p>
            </div>
          ) : (
            filteredAccountability.map((item) => (
              <div
                key={item.id}
                style={{
                  background: '#fff',
                  border: '1px solid var(--line)',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--blue)', background: '#eff6ff', padding: '2px 7px', borderRadius: '5px' }}>
                      {item.request.requestNumber}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '2px 7px',
                        borderRadius: '5px',
                        background: item.status === 'CLOSED' ? '#ecfdf5' : item.status === 'EVIDENCE_SUBMITTED' ? '#eff6ff' : '#fffbeb',
                        color: item.status === 'CLOSED' ? '#059669' : item.status === 'EVIDENCE_SUBMITTED' ? '#2563eb' : '#b45309',
                      }}
                    >
                      {item.status === 'EVIDENCE_SUBMITTED' ? 'Proof Submitted' : item.status === 'CLOSED' ? 'Cleared' : 'Pending Proof'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {item.request.subsidiary.legalName}
                    </span>
                  </div>

                  <strong style={{ display: 'block', fontSize: '14px', color: 'var(--navy)' }}>
                    {item.request.title}
                  </strong>
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#475569' }}>
                    Required: <em>"{item.requiredDeliverables}"</em>
                  </p>
                </div>

                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <strong style={{ fontSize: '15px', color: 'var(--navy)' }}>
                    ₦{item.request.amountNaira.toLocaleString()}
                  </strong>
                  <Link
                    href={`/requests/${item.request.requestNumber}`}
                    className="outline-button"
                    style={{ fontSize: '11px', padding: '4px 10px', textDecoration: 'none' }}
                  >
                    View Proof ↗
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* FAST DECISION MODAL */}
      {activeDecisionReq && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(7, 26, 64, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--blue)', letterSpacing: '0.08em' }}>
                  EXECUTIVE DECISION
                </span>
                <h3 style={{ margin: '3px 0 0', fontSize: '17px', color: 'var(--navy)', fontWeight: '800' }}>
                  {decisionAction === 'APPROVE' ? 'Approve Fund Release' : decisionAction === 'REJECT' ? 'Reject Fund Request' : 'Ask for Clarification'}
                </h3>
              </div>
              <button
                onClick={() => setActiveDecisionReq(null)}
                style={{
                  border: 0,
                  background: '#f1f5f9',
                  borderRadius: '50%',
                  width: '26px',
                  height: '26px',
                  cursor: 'pointer',
                  fontWeight: '700',
                  color: '#64748b',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--navy)' }}>
                  {activeDecisionReq.requestNumber}
                </span>
                <strong style={{ fontSize: '14px', color: '#059669' }}>
                  ₦{activeDecisionReq.amountNaira.toLocaleString()}
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                {activeDecisionReq.title}
              </p>
            </div>

            <form onSubmit={handleExecuteDecision}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--navy)', marginBottom: '6px' }}>
                  Select Action
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setDecisionAction('APPROVE')}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      border: decisionAction === 'APPROVE' ? '2px solid #059669' : '1px solid var(--line)',
                      background: decisionAction === 'APPROVE' ? '#ecfdf5' : '#fff',
                      color: decisionAction === 'APPROVE' ? '#059669' : 'var(--muted)',
                      cursor: 'pointer',
                    }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionAction('REQUEST_CLARIFICATION')}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      border: decisionAction === 'REQUEST_CLARIFICATION' ? '2px solid #2563eb' : '1px solid var(--line)',
                      background: decisionAction === 'REQUEST_CLARIFICATION' ? '#eff6ff' : '#fff',
                      color: decisionAction === 'REQUEST_CLARIFICATION' ? '#2563eb' : 'var(--muted)',
                      cursor: 'pointer',
                    }}
                  >
                    ? Ask Question
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionAction('REJECT')}
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      border: decisionAction === 'REJECT' ? '2px solid #dc2626' : '1px solid var(--line)',
                      background: decisionAction === 'REJECT' ? '#fef2f2' : '#fff',
                      color: decisionAction === 'REJECT' ? '#dc2626' : 'var(--muted)',
                      cursor: 'pointer',
                    }}
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--navy)', marginBottom: '6px' }}>
                  Add a short note:
                </label>
                <textarea
                  required={decisionAction !== 'APPROVE'}
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder={
                    decisionAction === 'APPROVE'
                      ? 'e.g. Approved for operations.'
                      : 'Provide any question or reason...'
                  }
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    fontSize: '12px',
                    color: 'var(--navy)',
                    resize: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setActiveDecisionReq(null)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '7px',
                    border: '1px solid var(--line)',
                    background: '#fff',
                    color: 'var(--muted)',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '7px',
                    border: 0,
                    background: decisionAction === 'APPROVE' ? '#059669' : decisionAction === 'REJECT' ? '#dc2626' : '#2563eb',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  {actionLoading ? 'Saving...' : decisionAction === 'APPROVE' ? 'Confirm Approval' : decisionAction === 'REJECT' ? 'Confirm Rejection' : 'Send Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExecutiveBriefingClient;
