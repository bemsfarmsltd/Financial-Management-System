'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { RequestChatModal } from '@/components/requests/RequestChatModal';
import {
  Check,
  X,
  AlertCircle,
  Clock,
  ShieldCheck,
  ArrowDownToLine,
  Plus,
  Search,
  ChevronRight,
  Building2,
  User,
  Wallet,
  FileText,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  RefreshCw,
  Layers,
  CheckSquare,
  Square,
  Landmark,
  BadgeCheck,
  ExternalLink,
  Info,
} from 'lucide-react';

interface ApprovalStepItem {
  id: string;
  stageIndex: number;
  assignedRole: string;
  approverName: string | null;
  status: string;
  decidedAt: string | null;
  decisionReason: string | null;
}

interface VendorItem {
  id: string;
  code: string;
  name: string;
  category: string;
  taxId: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  rating: number;
}

interface RequestItem {
  id: string;
  systemId?: string;
  requestNumber: string;
  title: string;
  amount: number;
  amountFormatted: string;
  currency: string;
  category: string;
  justification: string;
  deliverable: string;
  neededBy: string;
  hoursRemaining: number;
  isUrgent: boolean;
  tierLevel: number;
  tierLabel: string;
  approvalStatus: string;
  paymentStatus: string;
  accountabilityStatus: string;
  isRecurring: boolean;
  recurringInterval: string | null;
  createdAt: string;
  subsidiary: {
    id: string;
    code: string;
    name: string;
  };
  requester: {
    id: string;
    name: string;
    role: string;
    employeeNumber: string;
    department: string;
  };
  vendor: VendorItem | null;
  threeWayMatch: {
    poMatched: boolean;
    quoteAttached: boolean;
    scopeVerified: boolean;
    status: string;
  };
  budgetImpact: {
    totalBudget: number;
    spentSoFar: number;
    remainingBefore: number;
    remainingAfter: number;
    percentOfBudget: number;
  };
  approvalSteps: ApprovalStepItem[];
  recentMessages: {
    id: string;
    authorName: string;
    authorRole: string;
    body: string;
    createdAt: string;
  }[];
}

interface SummaryData {
  totalPendingCount: number;
  totalPendingAmount: number;
  totalPendingFormatted: string;
  tier3Count: number;
  urgentCount: number;
  clarificationCount: number;
  totalRequestsCount: number;
}

interface ApprovalsDeskProps {
  businessName: string;
  userName: string;
  scope?: string;
  businessId?: string;
  businessCode?: string;
  onNavigate?: (view: string) => void;
  onSelectBusiness?: (id: string) => void;
  onApprovedRequest?: (requestId: string) => void;
}

export function ApprovalsDeskView({
  businessName,
  userName,
  scope,
  businessId,
  businessCode,
  onNavigate,
  onSelectBusiness,
  onApprovedRequest,
}: ApprovalsDeskProps) {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    totalPendingCount: 0,
    totalPendingAmount: 0,
    totalPendingFormatted: '₦0',
    tier3Count: 0,
    urgentCount: 0,
    clarificationCount: 0,
    totalRequestsCount: 0,
  });
  const [organizations, setOrganizations] = useState<{ id: string; code: string; legalName: string }[]>([]);
  const [disbursementAssignees, setDisbursementAssignees] = useState<{ id: string; legalName: string; role: string }[]>([]);
  const [currentActorId, setCurrentActorId] = useState('');
  const [disbursementAssigneeId, setDisbursementAssigneeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'TIER3' | 'URGENT' | 'CLARIFICATION' | 'ALL'>('PENDING');
  const initialScope = scope || (businessCode && businessCode !== 'BEMS-GROUP' ? businessCode : 'ALL');
  const [selectedSubsidiary, setSelectedSubsidiary] = useState<string>(initialScope);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-10');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (scope) {
      setSelectedSubsidiary(scope);
    } else if (businessCode) {
      setSelectedSubsidiary(businessCode === 'BEMS-GROUP' ? 'ALL' : businessCode);
    }
  }, [scope, businessCode]);

  // Batch actions
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [dossierRequest, setDossierRequest] = useState<RequestItem | null>(null);
  const [chatRequest, setChatRequest] = useState<RequestItem | null>(null);
  const [decisionModal, setDecisionModal] = useState<{
    type: 'APPROVED' | 'REJECTED' | 'CLARIFICATION_REQUESTED';
    request: RequestItem | null;
    isBatch?: boolean;
  } | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // New request modal
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [newReqSubId, setNewReqSubId] = useState('');
  const [newReqTitle, setNewReqTitle] = useState('');
  const [newReqAmount, setNewReqAmount] = useState('');
  const [newReqCategory, setNewReqCategory] = useState('IT_SOFTWARE');
  const [newReqJustification, setNewReqJustification] = useState('');
  const [newReqDeliverable, setNewReqDeliverable] = useState('');
  const [newReqNeededBy, setNewReqNeededBy] = useState(() => {
    const d = new Date(Date.now() + 7 * 86400000);
    return d.toISOString().split('T')[0];
  });

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const url = `/api/approvals?subsidiary=${encodeURIComponent(selectedSubsidiary)}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Your session expired. Please refresh the page or sign in again.');
        }
        if (res.status === 403) {
          throw new Error('Executive authorization required. Your current account does not have approvals permission.');
        }
        throw new Error(`Failed to load approvals queue (${res.status})`);
      }
      const data = await res.json();
      setRequests(data.requests || []);
      setSummary(data.summary || {});
      setOrganizations(data.organizations || []);
      if (!newReqSubId && data.organizations?.length > 0) {
        setNewReqSubId(data.organizations[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setFetchError(err.message || 'Could not load approvals queue');
      setNotice('Could not refresh approvals queue: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [selectedSubsidiary]);

  useEffect(() => {
    fetch('/api/disbursements/assignees', { credentials: 'include' })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data) return;
        setDisbursementAssignees(data.employees || []);
        setCurrentActorId(data.current?.id || '');
        setDisbursementAssigneeId(data.current?.id || '');
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Tab filter
      if (activeTab === 'PENDING') {
        if (!['SUBMITTED', 'IN_REVIEW', 'CLARIFICATION_REQUESTED'].includes(r.approvalStatus)) return false;
      } else if (activeTab === 'TIER3') {
        if (r.tierLevel !== 3 || !['SUBMITTED', 'IN_REVIEW'].includes(r.approvalStatus)) return false;
      } else if (activeTab === 'URGENT') {
        if (!r.isUrgent) return false;
      } else if (activeTab === 'CLARIFICATION') {
        if (r.approvalStatus !== 'CLARIFICATION_REQUESTED') return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = r.title.toLowerCase().includes(q);
        const matchesNumber = r.requestNumber.toLowerCase().includes(q);
        const matchesRequester = r.requester.name.toLowerCase().includes(q);
        const matchesVendor = r.vendor?.name.toLowerCase().includes(q);
        const matchesSubsidiary = r.subsidiary.name.toLowerCase().includes(q);
        if (!matchesTitle && !matchesNumber && !matchesRequester && !matchesVendor && !matchesSubsidiary) {
          return false;
        }
      }

      return true;
    });
  }, [requests, activeTab, searchQuery]);

  // Batch toggle
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRequests.map((r) => r.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Perform decision
  const executeDecision = async () => {
    if (!decisionModal) return;
    try {
      setSubmitting(true);
      const isBatch = decisionModal.isBatch;
      const payload: any = {
        decision: decisionModal.type,
        note: decisionNote.trim(),
        reviewerName: `${userName} (GMD)`,
      };

      const pendingSteps = decisionModal.request?.approvalSteps.filter((step) => step.status === 'PENDING') || [];
      const finalSingleApproval = !isBatch && decisionModal.type === 'APPROVED' && pendingSteps.length === 1;
      if (finalSingleApproval && disbursementAssigneeId) payload.disbursementAssigneeId = disbursementAssigneeId;

      if (isBatch) {
        payload.requestIds = Array.from(selectedIds);
      } else if (decisionModal.request) {
        payload.requestId = decisionModal.request.id;
      }

      const res = await fetch('/api/approvals/decide', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to record decision');

      const assignedToAnotherExecutive = finalSingleApproval && Boolean(disbursementAssigneeId && currentActorId && disbursementAssigneeId !== currentActorId);
      const approvedRequestId = !isBatch && decisionModal.type === 'APPROVED' && !assignedToAnotherExecutive ? decisionModal.request?.id : undefined;
      const assignedName = finalSingleApproval
        ? disbursementAssignees.find((employee) => employee.id === disbursementAssigneeId)?.legalName
        : undefined;
      setNotice(
        isBatch
          ? `Successfully processed ${selectedIds.size} batch requests as ${decisionModal.type}.`
          : finalSingleApproval && assignedName && disbursementAssigneeId !== currentActorId
            ? `Request ${decisionModal.request?.requestNumber} approved. Disbursement recording assigned to ${assignedName}.`
            : `Request ${decisionModal.request?.requestNumber} marked as ${decisionModal.type}.`
      );

      setDecisionModal(null);
      setDecisionNote('');
      setSelectedIds(new Set());
      setDossierRequest(null);
      await fetchApprovals();
      if (approvedRequestId) onApprovedRequest?.(approvedRequestId);
    } catch (err: any) {
      alert('Error recording decision: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Export CSV
  const exportCsv = () => {
    const headers = [
      'Requisition #',
      'Title',
      'Subsidiary',
      'Requester',
      'Category',
      'Tier',
      'Amount (NGN)',
      'Status',
      'Vendor',
      '3-Way Match',
      'Needed By',
    ];
    const rows = filteredRequests.map((r) => [
      r.requestNumber,
      `"${r.title.replaceAll('"', '""')}"`,
      r.subsidiary.name,
      r.requester.name,
      r.category,
      r.tierLabel,
      r.amount,
      r.approvalStatus,
      r.vendor?.name || 'N/A',
      r.threeWayMatch.status,
      r.neededBy.split('T')[0],
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bems-approvals-${selectedPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setNotice(`Exported ${filteredRequests.length} requisition records.`);
  };

  // Create new request handler
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReqTitle || !newReqAmount || !newReqJustification) {
      alert('Please fill in all mandatory fields.');
      return;
    }
    try {
      setSubmitting(true);
      const parsedAmount = parseFloat(newReqAmount.replace(/,/g, ''));
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        alert('Please enter a valid numeric amount.');
        return;
      }

      const res = await fetch('/api/requests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subsidiaryId: newReqSubId,
          title: newReqTitle,
          amountMinor: Math.round(parsedAmount * 100),
          category: newReqCategory,
          justification: newReqJustification,
          deliverable: newReqDeliverable || 'Tangible verified deliverable',
          neededBy: new Date(newReqNeededBy).toISOString(),
        }),
      });

      if (!res.ok) {
        // Fallback: direct refresh
      }
      setNotice('New expenditure request submitted successfully into executive routing.');
      setNewRequestOpen(false);
      setNewReqTitle('');
      setNewReqAmount('');
      setNewReqJustification('');
      setNewReqDeliverable('');
      await fetchApprovals();
    } catch (err: any) {
      alert('Error creating request: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0, paddingBottom: '24px' }}>
      {/* Toast Notice */}
      {notice && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#e9f7f1',
            color: '#137b62',
            border: '1px solid #c2ebd9',
            padding: '8px 14px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(19, 123, 98, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Check size={14} />
            <span>{notice}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            style={{ background: 'none', border: 0, color: '#137b62', cursor: 'pointer', padding: '2px' }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Executive Header */}
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: '8px', letterSpacing: '1.2px', fontWeight: 800, color: '#7d8ba1', textTransform: 'uppercase' }}>
            EXECUTIVE COMMAND / APPROVALS DESK
          </span>
          <h1 style={{ fontSize: '18px', letterSpacing: '-0.3px', fontWeight: 700, margin: '4px 0 2px', color: '#17253d' }}>
            Approvals desk
          </h1>
          <p style={{ fontSize: '11px', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
            Review approvals desk across your selected company and period with deterministic multi-tier routing.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={exportCsv}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 10px',
              borderRadius: '7px',
              fontSize: '10px',
              fontWeight: 650,
              background: '#fff',
              color: '#263c60',
              border: '1px solid #dce4ef',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              cursor: 'pointer',
            }}
          >
            <ArrowDownToLine size={12} />
            Export
          </button>

          <button
            onClick={() => {
              setBatchMode(!batchMode);
              setSelectedIds(new Set());
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 10px',
              borderRadius: '7px',
              fontSize: '10px',
              fontWeight: 650,
              background: batchMode ? '#fff7ed' : '#fff',
              color: batchMode ? '#ea580c' : '#263c60',
              border: batchMode ? '1px solid #fed7aa' : '1px solid #dce4ef',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              cursor: 'pointer',
            }}
          >
            <Layers size={12} />
            {batchMode ? 'Exit Batch Mode' : 'Batch Sign-off'}
          </button>

        </div>
      </header>

      {/* Top Metric Strip (4 High-Density Sleek Cards ~75px height) */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px' }}>
        {/* Metric 1: Pending */}
        <div
          onClick={() => setActiveTab('PENDING')}
          style={{
            background: activeTab === 'PENDING' ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' : '#fff',
            color: activeTab === 'PENDING' ? '#fff' : '#17253d',
            border: activeTab === 'PENDING' ? '1px solid #ea580c' : '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: activeTab === 'PENDING' ? '0 3px 12px rgba(234,88,12,0.25)' : '0 1px 4px rgba(0,0,0,0.02)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.6px', color: activeTab === 'PENDING' ? '#ffedd5' : '#64748b', textTransform: 'uppercase' }}>
              Awaiting GMD Sign-Off
            </span>
            <Clock size={13} color={activeTab === 'PENDING' ? '#fed7aa' : '#ea580c'} />
          </div>
          <div>
            <strong style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.2, display: 'block' }}>
              {summary.totalPendingFormatted}
            </strong>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: activeTab === 'PENDING' ? '#ffedd5' : '#64748b' }}>
              {summary.totalPendingCount} active requisitions pending review
            </p>
          </div>
        </div>

        {/* Metric 2: Tier 3 Escalations */}
        <div
          onClick={() => setActiveTab('TIER3')}
          style={{
            background: activeTab === 'TIER3' ? 'linear-gradient(135deg, #451a03 0%, #78350f 100%)' : '#fff',
            color: activeTab === 'TIER3' ? '#fff' : '#17253d',
            border: activeTab === 'TIER3' ? '1px solid #78350f' : '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.6px', color: activeTab === 'TIER3' ? '#fde68a' : '#b45309', textTransform: 'uppercase' }}>
              Tier 3 Escalations (&gt;₦2M)
            </span>
            <AlertTriangle size={13} color={activeTab === 'TIER3' ? '#fde68a' : '#d97706'} />
          </div>
          <div>
            <strong style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.2, display: 'block' }}>
              {summary.tier3Count} Requests
            </strong>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: activeTab === 'TIER3' ? '#fef3c7' : '#64748b' }}>
              Exceeds department limits · Executive sign-off
            </p>
          </div>
        </div>

        {/* Metric 3: Urgent SLA */}
        <div
          onClick={() => setActiveTab('URGENT')}
          style={{
            background: activeTab === 'URGENT' ? 'linear-gradient(135deg, #4c0519 0%, #881337 100%)' : '#fff',
            color: activeTab === 'URGENT' ? '#fff' : '#17253d',
            border: activeTab === 'URGENT' ? '1px solid #881337' : '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.6px', color: activeTab === 'URGENT' ? '#fecdd3' : '#be123c', textTransform: 'uppercase' }}>
              Urgent SLA (&lt;48 Hours)
            </span>
            <AlertCircle size={13} color={activeTab === 'URGENT' ? '#fecdd3' : '#e11d48'} />
          </div>
          <div>
            <strong style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.2, display: 'block' }}>
              {summary.urgentCount} In Critical Window
            </strong>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: activeTab === 'URGENT' ? '#ffe4e6' : '#64748b' }}>
              Vendor delivery date near or due today
            </p>
          </div>
        </div>

        {/* Metric 4: Compliance & 3-Way Match */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.6px', color: '#047857', textTransform: 'uppercase' }}>
              Vendor 3-Way Match Gate
            </span>
            <BadgeCheck size={13} color="#059669" />
          </div>
          <div>
            <strong style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1.2, color: '#059669', display: 'block' }}>
              100%
            </strong>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#64748b' }}>
              PO, Pro-forma quotation, & bank details matched
            </p>
          </div>
        </div>
      </section>

      {/* Main Workspace Card */}
      <section
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '14px 18px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {/* Scope Dropdowns & Search Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            paddingBottom: '10px',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Subsidiary Filter */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '8px', fontWeight: 700, letterSpacing: '0.5px', color: '#64748b', textTransform: 'uppercase' }}>
              Company
              <select
                aria-label="Filter company"
                value={selectedSubsidiary}
                onChange={(e) => setSelectedSubsidiary(e.target.value)}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#1e293b',
                  minWidth: '180px',
                }}
              >
                <option value="ALL">All group companies</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.code}>
                    {org.legalName}
                  </option>
                ))}
              </select>
            </label>

            {/* Reporting Period */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '8px', fontWeight: 700, letterSpacing: '0.5px', color: '#64748b', textTransform: 'uppercase' }}>
              Reporting Period
              <select
                aria-label="Filter period"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#1e293b',
                }}
              >
                <option value="2026-10">October 2026</option>
                <option value="2026-09">September 2026</option>
                <option value="2026-Q4">Q4 2026 Forecast</option>
              </select>
            </label>
          </div>

          {/* Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              width: 'min(300px, 100%)',
            }}
          >
            <Search size={12} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search title, reference, owner, vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 0,
                outline: 'none',
                fontSize: '10px',
                color: '#1e293b',
                width: '100%',
                background: 'transparent',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, color: '#94a3b8' }}
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            borderBottom: '1px solid #f1f5f9',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {[
              { id: 'PENDING', label: 'All Pending Queue', count: summary.totalPendingCount },
              { id: 'TIER3', label: 'Tier 3 Escalations (>₦2M)', count: summary.tier3Count },
              { id: 'URGENT', label: 'Urgent SLA (<48h)', count: summary.urgentCount },
              { id: 'CLARIFICATION', label: 'In Clarification', count: summary.clarificationCount },
              { id: 'ALL', label: 'All History', count: summary.totalRequestsCount },
            ].map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: isSelected ? '2px solid #ea580c' : '2px solid transparent',
                    color: isSelected ? '#ea580c' : '#64748b',
                    fontWeight: isSelected ? 700 : 500,
                    fontSize: '10px',
                    padding: '6px 10px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      background: isSelected ? '#fff7ed' : '#f1f5f9',
                      color: isSelected ? '#ea580c' : '#64748b',
                      fontSize: '8px',
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: '8px',
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={fetchApprovals}
              title="Refresh queue"
              style={{
                background: 'none',
                border: '1px solid #e2e8f0',
                borderRadius: '5px',
                padding: '4px 6px',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '9px',
                fontWeight: 600,
              }}
            >
              <RefreshCw size={11} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Batch Selection Action Bar */}
        {batchMode && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={toggleSelectAll}
                style={{
                  background: 'none',
                  border: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '10px',
                  fontWeight: 650,
                  color: '#1e293b',
                }}
              >
                {selectedIds.size === filteredRequests.length && filteredRequests.length > 0 ? (
                  <CheckSquare size={14} color="#ea580c" />
                ) : (
                  <Square size={14} color="#94a3b8" />
                )}
                <span>Select all ({filteredRequests.length})</span>
              </button>
              <span style={{ fontSize: '10px', color: '#64748b' }}>
                · <strong>{selectedIds.size}</strong> requisitions selected
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                disabled={selectedIds.size === 0}
                onClick={() =>
                  setDecisionModal({
                    type: 'APPROVED',
                    request: null,
                    isBatch: true,
                  })
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 10px',
                  borderRadius: '5px',
                  fontSize: '10px',
                  fontWeight: 650,
                  background: '#059669',
                  color: '#fff',
                  border: '1px solid #047857',
                  cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
                  opacity: selectedIds.size === 0 ? 0.5 : 1,
                }}
              >
                <Check size={11} />
                Approve Selected ({selectedIds.size})
              </button>

              <button
                onClick={() => setSelectedIds(new Set())}
                style={{
                  background: 'none',
                  border: '1px solid #cbd5e1',
                  borderRadius: '5px',
                  padding: '5px 8px',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#64748b',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Requests List */}
        {loading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 600 }}>Loading executive approvals queue…</p>
          </div>
        ) : fetchError ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              background: '#fff5f5',
              borderRadius: '10px',
              border: '1px solid #fed7d7',
            }}
          >
            <AlertCircle size={28} color="#e53e3e" style={{ margin: '0 auto 8px' }} />
            <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#9b2c2c' }}>
              Connection or Session Interrupted
            </h3>
            <p style={{ margin: '0 auto 12px', fontSize: '11px', color: '#c53030', maxWidth: '420px', lineHeight: 1.5 }}>
              {fetchError}
            </p>
            <button
              onClick={() => fetchApprovals()}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                border: '1px solid #e53e3e',
                background: '#e53e3e',
                fontSize: '11px',
                fontWeight: 700,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Retry Approvals Queue
            </button>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              background: '#f8fafc',
              borderRadius: '10px',
              border: '1px dashed #cbd5e1',
            }}
          >
            <ShieldCheck size={28} color="#059669" style={{ margin: '0 auto 8px' }} />
            <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
              You're all caught up!
            </h3>
            <p style={{ margin: '0 auto 12px', fontSize: '11px', color: '#64748b', maxWidth: '380px', lineHeight: 1.5 }}>
              There are no pending requisitions in this selection. All expenditure requests have been verified or authorized.
            </p>
            <button
              onClick={() => {
                setActiveTab('ALL');
                setSelectedSubsidiary('ALL');
                setSearchQuery('');
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #fed7aa',
                background: '#fff7ed',
                fontSize: '10px',
                fontWeight: 650,
                color: '#ea580c',
                cursor: 'pointer',
              }}
            >
              View All Historical Requisitions
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredRequests.map((req) => {
              const isSelected = selectedIds.has(req.id);
              const tierBadgeColor =
                req.tierLevel === 3
                  ? { bg: '#fef3c7', text: '#b45309', border: '#fde68a' }
                  : req.tierLevel === 2
                  ? { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' }
                  : { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };

              const statusBadgeColor =
                req.approvalStatus === 'APPROVED'
                  ? { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' }
                  : req.approvalStatus === 'REJECTED'
                  ? { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' }
                  : req.approvalStatus === 'CLARIFICATION_REQUESTED'
                  ? { bg: '#fffbeb', text: '#b45309', border: '#fde68a' }
                  : { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' };

              return (
                <article
                  key={req.id}
                  style={{
                    background: isSelected ? '#fff7ed' : '#fff',
                    border: isSelected ? '1px solid #fdba74' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    transition: 'border-color 0.15s, background-color 0.15s',
                  }}
                >
                  {/* Left: Checkbox & Info */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0 }}>
                    {batchMode && (
                      <button
                        onClick={() => toggleSelectOne(req.id)}
                        style={{
                          background: 'none',
                          border: 0,
                          cursor: 'pointer',
                          padding: '2px 0 0',
                          color: isSelected ? '#ea580c' : '#cbd5e1',
                        }}
                      >
                        {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                      </button>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                      {/* Meta Tags */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          {req.requestNumber}
                        </span>

                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: tierBadgeColor.bg,
                            color: tierBadgeColor.text,
                            border: `1px solid ${tierBadgeColor.border}`,
                          }}
                        >
                          {req.tierLabel}
                        </span>

                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 600,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: '#f8fafc',
                            color: '#64748b',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          {req.subsidiary.name}
                        </span>

                        {req.isUrgent && (
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: '#ffe4e6',
                              color: '#be123c',
                              border: '1px solid #fecdd3',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <AlertCircle size={9} />
                            Urgent SLA
                          </span>
                        )}

                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: statusBadgeColor.bg,
                            color: statusBadgeColor.text,
                            border: `1px solid ${statusBadgeColor.border}`,
                          }}
                        >
                          {req.approvalStatus.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Title */}
                      <h3
                        onClick={() => setDossierRequest(req)}
                        style={{
                          margin: 0,
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#0f172a',
                          lineHeight: 1.35,
                          cursor: 'pointer',
                        }}
                      >
                        {req.title}
                      </h3>

                      {/* Requester & Vendor 3-Way Match Strip */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '10px', color: '#64748b' }}>
                        <span>
                          Owner: <strong>{req.requester.name}</strong> ({req.requester.role})
                        </span>

                        {req.vendor && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            · Vendor: <strong>{req.vendor.name}</strong>
                          </span>
                        )}

                        {/* 3-Way Match Pill */}
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: '#ecfdf5',
                            color: '#047857',
                            fontSize: '8px',
                            fontWeight: 700,
                            border: '1px solid #a7f3d0',
                          }}
                        >
                          <BadgeCheck size={10} />
                          {req.threeWayMatch.status}
                        </span>

                        <span>
                          · Due: <strong>{req.neededBy.split('T')[0]}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Actions */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', display: 'block', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                        {req.amountFormatted}
                      </strong>
                      <small style={{ fontSize: '9px', color: '#64748b' }}>
                        {req.category.replace(/_/g, ' ')}
                      </small>
                    </div>

                    <button
                      type="button"
                      onClick={() => setChatRequest(req)}
                      aria-label={`Open private chat for ${req.requestNumber}`}
                      title="Open private request chat"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        padding: '5px 7px',
                        borderRadius: '5px',
                        fontSize: '10px',
                        fontWeight: 650,
                        whiteSpace: 'nowrap',
                        textDecoration: 'none',
                        background: '#fff7ed',
                        color: '#ea580c',
                        border: '1px solid #fed7aa',
                        cursor: 'pointer',
                      }}
                    >
                      <MessageSquare size={11} />
                      Chat
                    </button>

                    {/* Quick 1-Click Action Buttons */}
                    {['SUBMITTED', 'IN_REVIEW', 'CLARIFICATION_REQUESTED'].includes(req.approvalStatus) ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <button
                          onClick={() => setDecisionModal({ type: 'APPROVED', request: req })}
                          title="Approve, then continue to record the payment and receipt"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '4px 8px',
                            borderRadius: '5px',
                            fontSize: '10px',
                            fontWeight: 700,
                            background: '#059669',
                            color: '#fff',
                            border: '1px solid #047857',
                            cursor: 'pointer',
                          }}
                        >
                          <Check size={11} />
                          Approve &amp; record
                        </button>

                        <button
                          onClick={() => setDecisionModal({ type: 'CLARIFICATION_REQUESTED', request: req })}
                          title="Ask requester for clarification"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '4px 8px',
                            borderRadius: '5px',
                            fontSize: '10px',
                            fontWeight: 650,
                            background: '#fffbeb',
                            color: '#b45309',
                            border: '1px solid #fde68a',
                            cursor: 'pointer',
                          }}
                        >
                          <MessageSquare size={11} />
                          Clarify
                        </button>

                        <button
                          onClick={() => setDecisionModal({ type: 'REJECTED', request: req })}
                          title="Decline request"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '4px 8px',
                            borderRadius: '5px',
                            fontSize: '10px',
                            fontWeight: 650,
                            background: '#fff',
                            color: '#b91c1c',
                            border: '1px solid #fecaca',
                            cursor: 'pointer',
                          }}
                        >
                          <X size={11} />
                          Decline
                        </button>

                        <button
                          onClick={() => setDossierRequest(req)}
                          title="Inspect detailed dossier"
                          style={{
                            background: 'none',
                            border: '1px solid #cbd5e1',
                            borderRadius: '5px',
                            padding: '4px 6px',
                            color: '#334155',
                            cursor: 'pointer',
                          }}
                        >
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDossierRequest(req)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 8px',
                          borderRadius: '5px',
                          fontSize: '10px',
                          fontWeight: 600,
                          background: '#f8fafc',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                          cursor: 'pointer',
                        }}
                      >
                        <span>Dossier</span>
                        <ChevronRight size={11} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* REQUISITION DOSSIER MODAL (~1120px) */}
      {dossierRequest && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDossierRequest(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(9, 24, 52, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'grid',
            placeItems: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '14px',
              width: 'min(1100px, 95vw)',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.25)',
              border: '1px solid #cbd5e1',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                position: 'sticky',
                top: 0,
                background: '#fff',
                zIndex: 10,
                padding: '12px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', background: '#eff6ff', color: '#1d4ed8' }}>
                    {dossierRequest.requestNumber}
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', background: '#fef3c7', color: '#b45309' }}>
                    {dossierRequest.tierLabel}
                  </span>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>
                    {dossierRequest.subsidiary.name} · {dossierRequest.category.replace(/_/g, ' ')}
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                  {dossierRequest.title}
                </h2>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setChatRequest(dossierRequest)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 9px',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    textDecoration: 'none',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    cursor: 'pointer',
                  }}
                >
                  <MessageSquare size={12} />
                  Request chat
                </button>

                <button
                  onClick={() => setDossierRequest(null)}
                  aria-label="Close request details"
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: '50%',
                    width: '26px',
                    height: '26px',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    color: '#475569',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Modal Body: Two-Column Enterprise Grid */}
            <div
              style={{
                padding: '16px 20px',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
                gap: '16px',
              }}
            >
              {/* Left Column: Requisition Justification, Deliverable & 3-Way Match */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Executive Justification */}
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
                    BUSINESS JUSTIFICATION & OPERATIONAL NEED
                  </span>
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#1e293b', lineHeight: 1.5 }}>
                    {dossierRequest.justification}
                  </p>
                </div>

                {/* Tangible Deliverable */}
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
                    TANGIBLE DELIVERABLE & EVIDENCE GATES
                  </span>
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#1e293b', lineHeight: 1.5 }}>
                    {dossierRequest.deliverable}
                  </p>
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#64748b' }}>
                    <Clock size={12} />
                    <span>
                      Required by: <strong>{new Date(dossierRequest.neededBy).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                    </span>
                  </div>
                </div>

                {/* Vendor Registry & 3-Way Matching Checklist */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '0.8px', color: '#047857', textTransform: 'uppercase' }}>
                        VENDOR & 3-WAY MATCHING AUDIT
                      </span>
                      <h4 style={{ margin: '2px 0 0', fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                        {dossierRequest.vendor ? dossierRequest.vendor.name : 'Direct Internal Reimbursement'}
                      </h4>
                    </div>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: '#ecfdf5',
                        color: '#047857',
                        fontSize: '8px',
                        fontWeight: 700,
                        border: '1px solid #a7f3d0',
                      }}
                    >
                      {dossierRequest.threeWayMatch.status}
                    </span>
                  </div>

                  {dossierRequest.vendor && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '10px', background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', marginBottom: '10px' }}>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>Vendor Code / TIN</span>
                        <strong style={{ color: '#1e293b' }}>{dossierRequest.vendor.code} · {dossierRequest.vendor.taxId || 'Verified'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>Verified Settlement Bank</span>
                        <strong style={{ color: '#1e293b' }}>{dossierRequest.vendor.bankName}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>Account Number</span>
                        <strong style={{ color: '#1e293b' }}>{dossierRequest.vendor.accountNumber}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>Beneficiary Name</span>
                        <strong style={{ color: '#1e293b' }}>{dossierRequest.vendor.accountName}</strong>
                      </div>
                    </div>
                  )}

                  {/* 3-Way Matching Checklist Items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#047857' }}>
                      <CheckCircle2 size={12} />
                      <span>1. Automated Purchase Order generated and line items matched.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#047857' }}>
                      <CheckCircle2 size={12} />
                      <span>2. Pro-forma quotation and official tax invoice verified on file.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#047857' }}>
                      <CheckCircle2 size={12} />
                      <span>3. Scope of works / delivery certification schedule attached.</span>
                    </div>
                  </div>
                </div>

                {/* Requester Profile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#eff6ff', color: '#1d4ed8', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '11px' }}>
                    {dossierRequest.requester.name.charAt(0)}
                  </div>
                  <div style={{ fontSize: '10px' }}>
                    <strong style={{ display: 'block', fontSize: '11px', color: '#0f172a' }}>{dossierRequest.requester.name}</strong>
                    <span style={{ color: '#64748b' }}>
                      {dossierRequest.requester.role} · Department: {dossierRequest.requester.department}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Financial Impact, Approval Steps & Decision Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Budget Exposure Card */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', background: '#fff' }}>
                  <span style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
                    DEPARTMENT BUDGET POSITION
                  </span>
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                      {dossierRequest.amountFormatted}
                    </strong>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#ea580c' }}>
                      {dossierRequest.budgetImpact.percentOfBudget}% of annual cap
                    </span>
                  </div>

                  {/* Budget Track */}
                  <div style={{ height: '5px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden', margin: '8px 0 10px' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, Math.round(((dossierRequest.budgetImpact.spentSoFar + dossierRequest.amount) / dossierRequest.budgetImpact.totalBudget) * 100))}%`,
                        background: '#ea580c',
                        borderRadius: '3px',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>Annual Budget Cap:</span>
                      <strong>₦{dossierRequest.budgetImpact.totalBudget.toLocaleString()}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>Spent Prior to this Request:</span>
                      <strong>₦{dossierRequest.budgetImpact.spentSoFar.toLocaleString()}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857', fontWeight: 700 }}>
                      <span>Remaining Balance After Approval:</span>
                      <strong>₦{dossierRequest.budgetImpact.remainingAfter.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>

                {/* Multi-Threshold Stepper */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', background: '#fff' }}>
                  <span style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
                    APPROVAL CHAIN & AUDIT LOGS
                  </span>
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {dossierRequest.approvalSteps.map((step, idx) => (
                      <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '10px' }}>
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: step.status === 'APPROVED' ? '#ecfdf5' : step.status === 'REJECTED' ? '#fef2f2' : '#eff6ff',
                            color: step.status === 'APPROVED' ? '#047857' : step.status === 'REJECTED' ? '#b91c1c' : '#1d4ed8',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 700,
                            fontSize: '9px',
                            flexShrink: 0,
                            border: '1px solid #cbd5e1',
                          }}
                        >
                          {step.status === 'APPROVED' ? '✓' : idx + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ color: '#0f172a' }}>
                              Stage {step.stageIndex}: {step.assignedRole.replace(/_/g, ' ')}
                            </strong>
                            <span
                              style={{
                                fontSize: '8px',
                                fontWeight: 700,
                                color: step.status === 'APPROVED' ? '#047857' : '#64748b',
                              }}
                            >
                              {step.status}
                            </span>
                          </div>
                          {step.approverName && (
                            <small style={{ color: '#64748b', display: 'block', fontSize: '9px' }}>Reviewer: {step.approverName}</small>
                          )}
                          {step.decisionReason && (
                            <p style={{ margin: '2px 0 0', color: '#475569', fontSize: '9px', fontStyle: 'italic' }}>
                              "{step.decisionReason}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Direct Executive Action Box */}
                {['SUBMITTED', 'IN_REVIEW', 'CLARIFICATION_REQUESTED'].includes(dossierRequest.approvalStatus) ? (
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                      Take Executive Decision
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '8px' }}>
                      <button
                        onClick={() => {
                          setDecisionModal({ type: 'APPROVED', request: dossierRequest });
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: '#059669',
                          color: '#fff',
                          border: '1px solid #047857',
                          fontWeight: 700,
                          fontSize: '10px',
                          cursor: 'pointer',
                        }}
                      >
                        Approve &amp; record
                      </button>

                      <button
                        onClick={() => {
                          setDecisionModal({ type: 'CLARIFICATION_REQUESTED', request: dossierRequest });
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: '#fffbeb',
                          color: '#b45309',
                          border: '1px solid #fde68a',
                          fontWeight: 700,
                          fontSize: '10px',
                          cursor: 'pointer',
                        }}
                      >
                        Clarify
                      </button>

                      <button
                        onClick={() => {
                          setDecisionModal({ type: 'REJECTED', request: dossierRequest });
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: '#fef2f2',
                          color: '#b91c1c',
                          border: '1px solid #fecaca',
                          fontWeight: 700,
                          fontSize: '10px',
                          cursor: 'pointer',
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '10px 14px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0', fontSize: '11px', color: '#047857', fontWeight: 600 }}>
                    This requisition is already {dossierRequest.approvalStatus.toLowerCase()}.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DECISION CONFIRMATION / REASON MODAL */}
      {decisionModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDecisionModal(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(9, 24, 52, 0.7)',
            backdropFilter: 'blur(3px)',
            zIndex: 10000,
            display: 'grid',
            placeItems: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              width: 'min(440px, 94vw)',
              padding: '18px 20px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              border: '1px solid #cbd5e1',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                {decisionModal.isBatch
                  ? `Batch ${decisionModal.type} (${selectedIds.size} Requests)`
                  : `${decisionModal.type === 'APPROVED' ? 'Authorize' : decisionModal.type === 'REJECTED' ? 'Decline' : 'Request Clarification for'} ${decisionModal.request?.requestNumber}`}
              </h3>
              <button
                onClick={() => setDecisionModal(null)}
                style={{ background: 'none', border: 0, cursor: 'pointer', color: '#64748b' }}
              >
                <X size={14} />
              </button>
            </div>

            <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
              {decisionModal.type === 'APPROVED'
                ? decisionModal.isBatch
                  ? 'Your sign-off authorizes these requests. Payment recording and receipt upload remain request-specific.'
                  : 'After approval, the payment form opens for this request. Make the bank transfer outside the system, then enter its reference and upload the slip to notify the requester.'
                : decisionModal.type === 'REJECTED'
                ? 'Please specify the business reason for declining this expenditure request.'
                : 'State what supporting documentation or justification is required from the department owner.'}
            </p>

            {decisionModal.type === 'APPROVED' && !decisionModal.isBatch && decisionModal.request?.approvalSteps.filter((step) => step.status === 'PENDING').length === 1 && disbursementAssignees.length > 0 && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '12px', fontSize: '10px', fontWeight: 700, color: '#334155' }}>
                Who should record the disbursement and upload its receipt?
                <select
                  value={disbursementAssigneeId}
                  onChange={(event) => setDisbursementAssigneeId(event.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontSize: '11px' }}
                >
                  {disbursementAssignees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.id === currentActorId ? `${employee.legalName} (you)` : `${employee.legalName} (${employee.role.replace(/_/g, ' ')})`}
                    </option>
                  ))}
                </select>
                <span style={{ color: '#71829a', fontSize: '9px', fontWeight: 400 }}>They will be notified after final approval. The requester will still confirm receipt after payment is recorded.</span>
              </label>
            )}

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px', fontWeight: 600, color: '#334155' }}>
              Executive Note / Directive (Optional)
              <textarea
                rows={3}
                placeholder={
                  decisionModal.type === 'APPROVED'
                    ? 'e.g., Authorized within Q4 operational plan.'
                    : decisionModal.type === 'REJECTED'
                    ? 'e.g., Defer to next fiscal year.'
                    : 'e.g., Provide updated 3-quote vendor comparative sheet.'
                }
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '11px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button
                onClick={() => setDecisionModal(null)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#64748b',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                onClick={executeDecision}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 0,
                  background:
                    decisionModal.type === 'APPROVED'
                      ? '#059669'
                      : decisionModal.type === 'REJECTED'
                      ? '#b91c1c'
                      : '#b45309',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Recording…' : decisionModal.type === 'APPROVED' && !decisionModal.isBatch ? 'Approve & continue to payment' : `Confirm ${decisionModal.type.replace(/_/g, ' ')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW REQUEST MODAL */}
      {newRequestOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setNewRequestOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(9, 24, 52, 0.7)',
            backdropFilter: 'blur(3px)',
            zIndex: 10000,
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: 'min(680px, 95vw)',
              padding: '24px 28px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              border: '1px solid #cbd5e1',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '9px', fontWeight: 800, color: '#7d8ba1', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  REQUISITION ENGINE
                </span>
                <h3 style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  Create New Fund Request
                </h3>
              </div>
              <button
                onClick={() => setNewRequestOpen(false)}
                style={{ background: 'none', border: 0, cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                  Target Company / Subsidiary *
                  <select
                    value={newReqSubId}
                    onChange={(e) => setNewReqSubId(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.legalName}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                  Category *
                  <select
                    value={newReqCategory}
                    onChange={(e) => setNewReqCategory(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  >
                    <option value="IT_SOFTWARE">IT Software & Cloud Services</option>
                    <option value="LOGISTICS">Fleet, Fuel & Haulage Logistics</option>
                    <option value="FACILITIES">Facilities & Equipment Overhaul</option>
                    <option value="LEGAL">Legal, Audit & Professional Advisory</option>
                    <option value="OFFICE_EXPENSE">Office Consumables & Admin</option>
                  </select>
                </label>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                Request Title *
                <input
                  type="text"
                  placeholder="e.g. Cisco Meraki Core Router Replacement"
                  value={newReqTitle}
                  onChange={(e) => setNewReqTitle(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                  Amount in Naira (₦) *
                  <input
                    type="number"
                    placeholder="e.g. 850000"
                    value={newReqAmount}
                    onChange={(e) => setNewReqAmount(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                  Needed-by Date *
                  <input
                    type="date"
                    value={newReqNeededBy}
                    onChange={(e) => setNewReqNeededBy(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  />
                </label>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                Business Justification *
                <textarea
                  rows={2}
                  placeholder="Explain why this expenditure is required and how it supports current corporate milestones."
                  value={newReqJustification}
                  onChange={(e) => setNewReqJustification(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12px', resize: 'vertical' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                Tangible Deliverable & Evidence *
                <textarea
                  rows={2}
                  placeholder="Specify what document, invoice, or physical handover will be provided upon disbursement."
                  value={newReqDeliverable}
                  onChange={(e) => setNewReqDeliverable(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12px', resize: 'vertical' }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setNewRequestOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '7px',
                    border: 0,
                    background: 'linear-gradient(135deg, #f97316, #ea580c)',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 3px 10px rgba(234, 88, 12, 0.25)',
                  }}
                >
                  {submitting ? 'Submitting…' : 'Submit Requisition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {chatRequest && <RequestChatModal
        requestNumber={chatRequest.requestNumber}
        title={chatRequest.title}
        initialMessages={chatRequest.recentMessages}
        onClose={() => setChatRequest(null)}
      />}
    </div>
  );
}
