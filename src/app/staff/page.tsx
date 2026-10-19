'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  ArrowUpRight,
  Receipt,
  CheckCircle2,
  Clock,
  Flame,
  Wallet,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Home,
  FileText,
  User,
  ArrowLeft,
  X,
  CreditCard,
  Building2,
  Calendar,
  AlertCircle,
  Send,
  UploadCloud,
  FileCheck,
  MessageSquare,
  Sparkles,
  Download,
  Bell,
  Smartphone,
  ExternalLink,
  DollarSign,
  Trash2,
  Check,
} from 'lucide-react';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface ChannelMessage {
  id: string;
  author: string;
  role: string;
  text: string;
  timestamp: string;
  isStaff?: boolean;
}

interface RequestItem {
  id: string;
  number: string;
  title: string;
  category: string;
  amount: number;
  status: 'SUBMITTED' | 'HOD_REVIEW' | 'FINANCE_AUDIT' | 'GMD_APPROVED' | 'DISBURSED' | 'CLOSED';
  statusLabel: string;
  stepIndex: number;
  submittedAt: string;
  department: string;
  needsRetirement: boolean;
  subsidiary: string;
  beneficiaryAccount: string;
  lineItems: LineItem[];
  messages: ChannelMessage[];
}

interface ReceiptItem {
  id: string;
  merchant: string;
  category: string;
  amount: number;
  fileName: string;
}

export default function StaffMobilePage() {
  const [activeTab, setActiveTab] = useState<'home' | 'requests' | 'retirements' | 'payslips' | 'profile'>('home');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [notice, setNotice] = useState<string | null>(null);

  // Active Subsidiary Switcher State
  const [activeSubsidiary, setActiveSubsidiary] = useState('Bems Group Cloud & Technologies Ltd');
  const subsidiaries = [
    'Bems Group Cloud & Technologies Ltd',
    'Bems Group Holdings Ltd (HQ)',
    'Bems Group Media & Logistics Ltd',
  ];

  // Request Creation Wizard State (5 Steps)
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizTitle, setWizTitle] = useState('');
  const [wizCategory, setWizCategory] = useState('Software & Infrastructure');
  const [wizDepartment, setWizDepartment] = useState('Technology & DevOps');
  const [wizRationale, setWizRationale] = useState('');
  const [wizRequiredDate, setWizRequiredDate] = useState('2026-10-25');
  const [wizBeneficiary, setWizBeneficiary] = useState('STAFF_ACCOUNT');
  const [wizAttachedFile, setWizAttachedFile] = useState<string | null>(null);
  const [wizLineItems, setWizLineItems] = useState<LineItem[]>([
    { id: '1', description: 'Core Server Instance Renewal', quantity: 1, unitPrice: 350000 },
  ]);

  // Request Detail Drawer State
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
  const [expandedAccordion, setExpandedAccordion] = useState<number | null>(0);
  const [chatMessage, setChatMessage] = useState('');

  // Multi-Receipt Retirement Desk State
  const [selectedAdvanceId, setSelectedAdvanceId] = useState('req-003');
  const [retirementReceipts, setRetirementReceipts] = useState<ReceiptItem[]>([
    { id: 'r1', merchant: 'Oregun Fiber Cables Ltd', category: 'Materials', amount: 850000, fileName: 'invoice_fiber_materials_inv882.pdf' },
    { id: 'r2', merchant: 'Logistics Courier Haulage', category: 'Transport', amount: 200000, fileName: 'haulage_waybill_receipt.pdf' },
  ]);
  const [newReceiptMerchant, setNewReceiptMerchant] = useState('');
  const [newReceiptAmount, setNewReceiptAmount] = useState('');
  const [refundProofFile, setRefundProofFile] = useState<string | null>(null);
  const [retirementSubmitted, setRetirementSubmitted] = useState(false);

  // Payslip Modal State (PR-14)
  const [showPayslipVoucher, setShowPayslipVoucher] = useState(false);
  const [payslipConfirmed, setPayslipConfirmed] = useState(false);

  // Simulated Push Notification Banner State
  const [simulatedAlert, setSimulatedAlert] = useState<{ title: string; body: string; type: 'whatsapp' | 'slack' } | null>(null);

  // Master Requests Store
  const [requests, setRequests] = useState<RequestItem[]>([
    {
      id: 'req-001',
      number: 'REQ-2026-0001',
      title: 'Hostinger Cloud VPS Hosting Renewal',
      category: 'Software',
      amount: 450000,
      status: 'HOD_REVIEW',
      statusLabel: 'Under HOD Review',
      stepIndex: 1,
      submittedAt: 'Oct 16, 2026',
      department: 'Technology',
      subsidiary: 'Bems Group Cloud & Technologies Ltd',
      beneficiaryAccount: 'Hostinger International Corp · Vendor Verified',
      needsRetirement: false,
      lineItems: [{ id: 'l1', description: 'Annual VPS Cloud Tier 4', quantity: 1, unitPrice: 450000 }],
      messages: [
        { id: 'm1', author: 'Temitope Bakare', role: 'Requester', text: 'Submitted proforma quote from Hostinger with annual 20% discount applied.', timestamp: 'Oct 16, 09:15 AM', isStaff: true },
        { id: 'm2', author: 'Adaobi Okeke', role: 'COO / Acting HOD', text: 'Checked. Backup retention policy aligns with Q4 requirements. Endorsing to Finance.', timestamp: 'Oct 16, 11:20 AM' },
      ],
    },
    {
      id: 'req-002',
      number: 'REQ-2026-0002',
      title: 'Emergency Generator Diesel Supply (4000L)',
      category: 'Power & Diesel',
      amount: 2800000,
      status: 'GMD_APPROVED',
      statusLabel: 'Approved for Banking Transfer',
      stepIndex: 3,
      submittedAt: 'Oct 15, 2026',
      department: 'Operations',
      subsidiary: 'Bems Group Holdings Ltd (HQ)',
      beneficiaryAccount: 'Oando Energy Plc · Vendor 3-Way Match Verified',
      needsRetirement: false,
      lineItems: [{ id: 'l2', description: 'Low Sulfur Automotive Gas Oil (AGO)', quantity: 4000, unitPrice: 700 }],
      messages: [
        { id: 'm3', author: 'Henry Nwosu', role: 'GMD', text: 'Approved for Access Bank direct treasury disbursement.', timestamp: 'Oct 15, 04:30 PM' },
      ],
    },
    {
      id: 'req-003',
      number: 'REQ-2026-0003',
      title: 'On-site Fiber Infrastructure Advance',
      category: 'Advances',
      amount: 1200000,
      status: 'DISBURSED',
      statusLabel: 'Funds Disbursed — Retirement Due',
      stepIndex: 4,
      submittedAt: 'Oct 14, 2026',
      department: 'Infrastructure',
      subsidiary: 'Bems Group Cloud & Technologies Ltd',
      beneficiaryAccount: 'Access Bank · 0123456789 (Temitope Bakare)',
      needsRetirement: true,
      lineItems: [
        { id: 'l3', description: 'Fiber Optic Patch Cords & Transceivers', quantity: 1, unitPrice: 850000 },
        { id: 'l4', description: 'Contractor Splicing & Site Labour', quantity: 1, unitPrice: 350000 },
      ],
      messages: [
        { id: 'm4', author: 'Finance Desk', role: 'Finance Recorder', text: 'Access Bank transfer executed. Reference: TRF/OCT/88219.', timestamp: 'Oct 14, 05:15 PM' },
        { id: 'm5', author: 'Verifier Desk', role: 'Internal Verifier', text: 'Disbursement verified. 72-hour receipt reconciliation countdown started.', timestamp: 'Oct 14, 05:45 PM' },
      ],
    },
  ]);

  const categories = ['All', 'Advances', 'Software', 'Travel', 'Power & Diesel', 'Vendors'];

  // Calculate Wizard Total
  const wizTotal = wizLineItems.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);

  // Line item helpers
  const addLineItem = () => {
    setWizLineItems([
      ...wizLineItems,
      { id: String(Date.now()), description: '', quantity: 1, unitPrice: 0 },
    ]);
  };
  const removeLineItem = (id: string) => {
    if (wizLineItems.length > 1) {
      setWizLineItems(wizLineItems.filter((i) => i.id !== id));
    }
  };
  const updateLineItem = (id: string, field: keyof LineItem, val: any) => {
    setWizLineItems(
      wizLineItems.map((i) => (i.id === id ? { ...i, [field]: val } : i))
    );
  };

  // Submit Final Wizard
  const handleFinalSubmit = () => {
    if (!wizTitle) return;

    const newReq: RequestItem = {
      id: `req-${Date.now()}`,
      number: `REQ-2026-000${requests.length + 1}`,
      title: wizTitle,
      category: wizCategory.includes('Advance') ? 'Advances' : 'Software',
      amount: wizTotal,
      status: 'SUBMITTED',
      statusLabel: 'Submitted to HOD',
      stepIndex: 0,
      submittedAt: 'Just now',
      department: wizDepartment,
      subsidiary: activeSubsidiary,
      beneficiaryAccount: wizBeneficiary === 'STAFF_ACCOUNT' ? 'Access Bank · 0123456789 (Temitope Bakare)' : 'Registered Vendor Account',
      needsRetirement: wizCategory.includes('Advance'),
      lineItems: wizLineItems,
      messages: [
        {
          id: `m-${Date.now()}`,
          author: 'Temitope Bakare',
          role: 'Requester',
          text: `Initiated request: "${wizRationale || 'Expenditure needed for Q4 deliverables.'}"`,
          timestamp: 'Just now',
          isStaff: true,
        },
      ],
    };

    setRequests([newReq, ...requests]);
    setShowWizard(false);
    setWizardStep(1);
    setWizTitle('');
    setWizRationale('');
    setNotice(`Request ${newReq.number} submitted and routed to HOD!`);
    setTimeout(() => setNotice(null), 4000);
  };

  // Chat message send in channel
  const handleSendMessage = () => {
    if (!chatMessage.trim() || !selectedRequest) return;
    const newMsg: ChannelMessage = {
      id: `m-${Date.now()}`,
      author: 'Temitope Bakare',
      role: 'Requester',
      text: chatMessage.trim(),
      timestamp: 'Just now',
      isStaff: true,
    };

    const updated = {
      ...selectedRequest,
      messages: [...selectedRequest.messages, newMsg],
    };

    setSelectedRequest(updated);
    setRequests(requests.map((r) => (r.id === updated.id ? updated : r)));
    setChatMessage('');
  };

  // Multi-receipt addition
  const handleAddReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReceiptMerchant || !newReceiptAmount) return;
    const amt = parseFloat(newReceiptAmount);
    setRetirementReceipts([
      ...retirementReceipts,
      {
        id: `r-${Date.now()}`,
        merchant: newReceiptMerchant,
        category: 'Field Supplies',
        amount: amt,
        fileName: `receipt_${newReceiptMerchant.toLowerCase().replace(/\s+/g, '_')}.pdf`,
      },
    ]);
    setNewReceiptMerchant('');
    setNewReceiptAmount('');
  };

  // Retirement calculations
  const totalReceipts = retirementReceipts.reduce((acc, r) => acc + r.amount, 0);
  const activeAdvanceObj = requests.find((r) => r.id === selectedAdvanceId) || requests[2];
  const advanceAmount = activeAdvanceObj?.amount || 1200000;
  const variance = advanceAmount - totalReceipts;

  const handleRetirementSubmission = () => {
    setRequests(
      requests.map((r) =>
        r.id === selectedAdvanceId
          ? { ...r, status: 'CLOSED', statusLabel: 'Retirement Verified & Closed', needsRetirement: false }
          : r
      )
    );
    setRetirementSubmitted(true);
    setNotice('Retirement certificate generated and submitted to Verifier!');
    setTimeout(() => setNotice(null), 4000);
  };

  // Test Notification Bridge Simulator
  const triggerSimulatedNotification = (type: 'whatsapp' | 'slack') => {
    if (type === 'whatsapp') {
      setSimulatedAlert({
        type: 'whatsapp',
        title: 'BEMS WhatsApp Bot',
        body: '🔔 REQ-2026-0003: Access Bank transfer of ₦1,200,000 has been verified. 72h retirement timer is active.',
      });
    } else {
      setSimulatedAlert({
        type: 'slack',
        title: '#bems-expenditure-alerts',
        body: '⚡ GMD Henry Nwosu approved REQ-2026-0002 for diesel delivery. Treasury batch prepared.',
      });
    }
    setTimeout(() => setSimulatedAlert(null), 6000);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex justify-center selection:bg-blue-600 selection:text-white font-sans antialiased">
      {/* Mobile Frame Container */}
      <div className="w-full max-w-md bg-[#F8FAFC] min-h-screen flex flex-col relative pb-28 shadow-2xl border-x border-[#E2E8F0]">
        
        {/* Top iOS Status Bar */}
        <div className="px-6 pt-3 pb-1 flex items-center justify-between text-xs font-semibold text-[#0F172A]">
          <span>10:40</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]">●●●</span>
            <div className="h-2.5 w-5 rounded-sm border border-[#0F172A] p-0.5 flex items-center">
              <div className="h-full w-full bg-[#0F172A] rounded-2xs" />
            </div>
          </div>
        </div>

        {/* Real-time Notification Banner Simulator */}
        {simulatedAlert && (
          <div className="mx-4 mt-1 p-3.5 bg-[#0F172A] text-white rounded-2xl shadow-xl border border-slate-700 animate-in slide-in-from-top-4 flex items-start gap-3 z-50">
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${simulatedAlert.type === 'whatsapp' ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
              {simulatedAlert.type === 'whatsapp' ? <Smartphone className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold text-slate-300">{simulatedAlert.title}</p>
              <p className="text-xs text-white mt-0.5 leading-snug">{simulatedAlert.body}</p>
            </div>
            <button onClick={() => setSimulatedAlert(null)} className="text-slate-400 hover:text-white font-bold text-xs">✕</button>
          </div>
        )}

        {/* Global Toast Notice */}
        {notice && (
          <div className="mx-4 mt-2 p-3 bg-emerald-600 text-white rounded-2xl text-xs font-medium flex items-center justify-between shadow-lg animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{notice}</span>
            </div>
            <button onClick={() => setNotice(null)} className="text-emerald-200 hover:text-white font-bold">✕</button>
          </div>
        )}

        {/* Top Navigation Bar: TripGlide + Finance Combination */}
        <header className="px-5 pt-3 pb-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#0F172A] leading-tight">
              Hello, Temitope
            </h1>
            <button
              onClick={() => {
                const nextIdx = (subsidiaries.indexOf(activeSubsidiary) + 1) % subsidiaries.length;
                setActiveSubsidiary(subsidiaries[nextIdx]);
                setNotice(`Switched entity to ${subsidiaries[nextIdx]}`);
                setTimeout(() => setNotice(null), 3000);
              }}
              className="text-[11px] font-medium text-[#1D4ED8] hover:underline flex items-center gap-1 mt-0.5"
            >
              <span>{activeSubsidiary}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* (+) Black circular button: launches 5-step wizard */}
            <button
              onClick={() => {
                setWizardStep(1);
                setShowWizard(true);
              }}
              className="h-9 w-9 rounded-full bg-[#0F172A] text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md"
              title="Create Fund Request Wizard"
            >
              <Plus className="h-5 w-5" />
            </button>

            {/* (↗) Quick Action button to retire advance */}
            <button
              onClick={() => setActiveTab('retirements')}
              className="h-9 w-9 rounded-full bg-white text-[#0F172A] border border-[#E2E8F0] flex items-center justify-center hover:bg-slate-50 transition-all shadow-sm"
              title="Retire Advances"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>

            {/* Profile Avatar Badge */}
            <button
              onClick={() => setActiveTab('profile')}
              className="h-9 w-9 rounded-full bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] font-bold text-xs flex items-center justify-center shadow-sm"
            >
              TB
            </button>
          </div>
        </header>

        {/* Return to Executive Web Portal link */}
        <div className="px-5 pb-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#64748B] hover:text-[#1D4ED8] transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Return to Executive Web Portal</span>
          </Link>
        </div>

        {/* ----------------------------------------------------------------------------------- */}
        {/* TAB 1: HOME (FINANCE HERO + STACKED COMMITMENTS + 2X2 STATS)                         */}
        {/* ----------------------------------------------------------------------------------- */}
        {activeTab === 'home' && (
          <div className="px-5 space-y-5 flex-1 overflow-y-auto">
            {/* Category Pill Bar from TripGlide (Image 2) */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-[#0F172A] text-white shadow-md'
                        : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-slate-50'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* "You are on Top of your Finances" Hero Section from Image 1 */}
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-[#0F172A] leading-tight">
                You are on Top
              </h2>
              <h3 className="text-2xl font-bold tracking-tight text-[#64748B] leading-tight">
                of your Requests
              </h3>
            </div>

            {/* Main Balance Card with Trendline Curve */}
            <div className="bg-white rounded-[26px] p-5 border border-[#E2E8F0] shadow-sm relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-medium text-[#64748B]">Total Active Advance</span>
                  <div className="text-2xl font-bold text-[#0F172A] mt-0.5 tracking-tight">
                    ₦1,200,000
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-bold flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>72h SLA Active</span>
                </span>
              </div>

              {/* Sparkline curve */}
              <div className="h-14 mt-4 relative flex items-center justify-center">
                <svg viewBox="0 0 300 60" className="w-full h-full stroke-[#1D4ED8] fill-none stroke-[2.5]">
                  <path d="M 0 45 Q 60 55 120 20 T 240 30 T 300 15" />
                  <circle cx="180" cy="24" r="5" className="fill-[#1D4ED8]" />
                  <circle cx="180" cy="24" r="10" className="fill-[#1D4ED8]/20" />
                </svg>
                <div className="absolute top-0 right-16 px-2 py-0.5 rounded-full bg-[#1D4ED8] text-white text-[9px] font-bold shadow-sm">
                  100% Policy SLA
                </div>
              </div>
            </div>

            {/* Side-by-Side Sub-Cards (Disbursed vs Under Review) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-[22px] p-4 border border-[#E2E8F0] shadow-sm">
                <div className="flex items-center justify-between text-[#64748B]">
                  <span className="text-[11px] font-medium">Disbursed MTD</span>
                  <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-base font-bold text-[#0F172A] mt-1">₦1,650,000</div>
              </div>
              <div className="bg-white rounded-[22px] p-4 border border-[#E2E8F0] shadow-sm">
                <div className="flex items-center justify-between text-[#64748B]">
                  <span className="text-[11px] font-medium">Under Review</span>
                  <Clock className="h-4 w-4 text-[#1D4ED8]" />
                </div>
                <div className="text-base font-bold text-[#0F172A] mt-1">₦450,000</div>
              </div>
            </div>

            {/* Lavender Alert Notice */}
            <div className="p-3.5 rounded-[20px] bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[#1D4ED8] text-white flex items-center justify-center shrink-0">
                  <Receipt className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#1E1B4B]">Advance retirement due in 24 hours.</p>
                  <p className="text-[10px] text-[#4338CA]">REQ-2026-0003 · Access Bank transfer verified</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('retirements')}
                className="text-xs font-bold text-[#1D4ED8] hover:underline shrink-0"
              >
                Retire →
              </button>
            </div>

            {/* STACKED COMMITMENT CARDS (from Image 1 Screen 3) */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-[#0F172A]">Active Commitments</h4>
                <span className="text-xs font-medium text-[#64748B]">Stack</span>
              </div>

              <div className="relative pt-2">
                {/* Layer 1 (Top Grey) */}
                <div className="h-12 bg-slate-100 rounded-[20px] border border-slate-200 px-4 py-2 flex items-center justify-between text-xs text-slate-500 font-semibold" />

                {/* Layer 2 (Middle Light Blue) */}
                <div className="-mt-9 h-12 bg-blue-100/80 rounded-[20px] border border-blue-200 px-4 py-2 flex items-center justify-between text-xs text-blue-800 font-semibold" />

                {/* Layer 3 (Bottom Hero Cobalt Blue Card) */}
                <div className="-mt-8 p-5 bg-gradient-to-br from-[#1D4ED8] to-[#1E40AF] text-white rounded-[24px] shadow-lg shadow-blue-600/30">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-blue-100">On-site Fiber Infrastructure Advance</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-white font-mono text-[10px] font-bold">
                      REQ-2026-0003
                    </span>
                  </div>
                  <div className="text-3xl font-bold mt-3 tracking-tight">₦1,200,000</div>
                  <p className="text-[11px] text-blue-100 mt-0.5">Pending Retirement · 72h Policy Window</p>

                  <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between">
                    <span className="text-xs text-blue-100 font-mono">Disbursed ········ 6789</span>
                    <button
                      onClick={() => setActiveTab('retirements')}
                      className="px-3.5 py-1.5 rounded-xl bg-white text-[#1D4ED8] text-xs font-bold hover:bg-blue-50 transition-all shadow-sm"
                    >
                      Retire Now →
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 2X2 STATS GRID (from Image 1 Screen 4 Target App) */}
            <div className="pt-3">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-[#0F172A]">Your Stats</h4>
                <span className="text-xs font-medium text-[#64748B]">See all</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-[22px] border border-[#E2E8F0] shadow-sm">
                  <div className="h-6 w-6 rounded-full border-2 border-[#1D4ED8] border-t-transparent animate-spin-slow flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-[#1D4ED8]" />
                  </div>
                  <p className="text-xs font-bold text-[#0F172A] mt-2.5">Policy SLA</p>
                  <p className="text-[11px] text-[#64748B]">100% Achieved</p>
                </div>

                <div className="bg-white p-4 rounded-[22px] border border-[#E2E8F0] shadow-sm">
                  <div className="h-6 w-6 rounded-full bg-[#1D4ED8] text-white flex items-center justify-center">
                    <Flame className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-xs font-bold text-[#0F172A] mt-2.5">Streaks</p>
                  <p className="text-[11px] text-[#64748B]">3 weeks on-time</p>
                </div>

                <div className="bg-white p-4 rounded-[22px] border border-[#E2E8F0] shadow-sm">
                  <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Receipt className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-xs font-bold text-[#0F172A] mt-2.5">Total Retired</p>
                  <p className="text-[11px] text-[#64748B]">₦4,850,000</p>
                </div>

                <div className="bg-white p-4 rounded-[22px] border border-[#E2E8F0] shadow-sm">
                  <div className="h-6 w-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                    <Wallet className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-xs font-bold text-[#0F172A] mt-2.5">Latest Salary</p>
                  <p className="text-[11px] text-[#64748B]">₦680,000 Settled</p>
                </div>
              </div>
            </div>

            {/* Recent Requests list from Image 1 Screen 2 */}
            <div className="pt-3">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-[#0F172A]">Recent Transactions</h4>
                <button onClick={() => setActiveTab('requests')} className="text-xs font-semibold text-[#64748B]">
                  See all
                </button>
              </div>

              <div className="space-y-2.5">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => {
                      setSelectedRequest(r);
                      setActiveTab('requests');
                    }}
                    className="p-3.5 bg-white rounded-[20px] border border-[#E2E8F0] shadow-sm flex items-center justify-between cursor-pointer hover:border-[#1D4ED8] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-slate-100 flex items-center justify-center text-xs font-bold text-[#0F172A]">
                        {r.title.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#0F172A] max-w-[170px] truncate">{r.title}</p>
                        <p className="text-[10px] text-[#64748B]">{r.number} · {r.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-[#0F172A] font-mono">₦{r.amount.toLocaleString()}</p>
                      <p className={`text-[10px] font-bold ${r.status === 'DISBURSED' ? 'text-emerald-600' : 'text-[#1D4ED8]'}`}>
                        {r.statusLabel}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------------------------- */}
        {/* TAB 2: REQUESTS (EXPANDABLE ITINERARY ACCORDION & CHANNEL DRAWER)                   */}
        {/* ----------------------------------------------------------------------------------- */}
        {activeTab === 'requests' && (
          <div className="px-5 space-y-4 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[#0F172A]">Fund Requests & Channels</h2>
                <p className="text-xs text-[#64748B]">Select any request to inspect live approvals & discussion</p>
              </div>
              <button
                onClick={() => {
                  setWizardStep(1);
                  setShowWizard(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#0F172A] text-white text-xs font-bold shadow-sm"
              >
                + New
              </button>
            </div>

            {/* Request Cards Carousel / Selector */}
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1">
              {requests.map((r) => {
                const isSelected = selectedRequest ? selectedRequest.id === r.id : r.id === 'req-001';
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRequest(r)}
                    className={`p-3 rounded-2xl text-left border min-w-[190px] transition-all ${
                      isSelected
                        ? 'bg-white border-[#1D4ED8] shadow-md ring-2 ring-[#1D4ED8]/20'
                        : 'bg-white border-[#E2E8F0]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono font-bold text-[#1D4ED8]">{r.number}</span>
                      <span className="text-[#64748B]">{r.category}</span>
                    </div>
                    <p className="text-xs font-bold text-[#0F172A] mt-1 truncate">{r.title}</p>
                    <p className="text-xs font-mono font-bold text-[#0F172A] mt-1">₦{r.amount.toLocaleString()}</p>
                  </button>
                );
              })}
            </div>

            {/* Selected Request Itinerary & Channel */}
            {(() => {
              const req = selectedRequest || requests[0];
              const stages = [
                {
                  stage: 'Stage 1',
                  title: 'HOD Technical Recommendation',
                  time: 'Completed · Oct 16, 11:20 AM',
                  actor: 'Adaobi Okeke (COO / Acting HOD)',
                  details: 'Line Manager validated quotes against technical requirements and approved routing to Finance.',
                  done: req.stepIndex >= 1,
                },
                {
                  stage: 'Stage 2',
                  title: 'Finance Budget Envelope Audit',
                  time: 'Completed · Oct 16, 02:45 PM',
                  actor: 'Ngozi Eze (Senior Finance Officer)',
                  details: 'Account code 4100-TECH verified against approved monthly departmental budget head.',
                  done: req.stepIndex >= 2,
                },
                {
                  stage: 'Stage 3',
                  title: 'GMD Executive Sign-off',
                  time: req.stepIndex >= 3 ? 'Approved · Oct 16, 04:15 PM' : 'Awaiting Final Signature',
                  actor: 'Henry Nwosu (Group Managing Director)',
                  details: 'Final threshold authorization signed and committed to treasury batch.',
                  done: req.stepIndex >= 3,
                },
                {
                  stage: 'Stage 4',
                  title: 'Access Bank Transfer Settlement',
                  time: req.stepIndex >= 4 ? 'Disbursed · Oct 16, 05:30 PM' : 'Pending Bank Release',
                  actor: req.beneficiaryAccount,
                  details: 'Disbursement recorded with bank verification receipt stamp.',
                  done: req.stepIndex >= 4,
                },
              ];

              return (
                <div className="space-y-4 pt-1">
                  {/* Selected Request Details Header Card */}
                  <div className="bg-white rounded-[24px] p-4 border border-[#E2E8F0] shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#1D4ED8] font-bold text-[10px]">
                        {req.number}
                      </span>
                      <span className="text-sm font-bold font-mono text-[#0F172A]">₦{req.amount.toLocaleString()}</span>
                    </div>
                    <h3 className="text-sm font-bold text-[#0F172A] mt-2">{req.title}</h3>
                    <p className="text-[11px] text-[#64748B]">{req.subsidiary} · {req.department}</p>
                    
                    {/* Itemized Line Items summary */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1">
                      <span className="text-[10px] font-bold text-[#64748B]">BUDGET BREAKDOWN:</span>
                      {req.lineItems.map((li) => (
                        <div key={li.id} className="flex justify-between text-xs text-[#0F172A]">
                          <span>{li.description} (x{li.quantity})</span>
                          <span className="font-mono">₦{(li.quantity * li.unitPrice).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Expandable Itinerary Accordions (TripGlide Image 2 Screen 3) */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Approval Itinerary</h4>
                    {stages.map((step, idx) => {
                      const isOpen = expandedAccordion === idx;
                      return (
                        <div
                          key={step.title}
                          className="bg-white rounded-[20px] border border-[#E2E8F0] shadow-sm overflow-hidden transition-all"
                        >
                          <button
                            onClick={() => setExpandedAccordion(isOpen ? null : idx)}
                            className="w-full p-3.5 flex items-center justify-between text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${step.done ? 'bg-[#0F172A] text-white' : 'bg-slate-100 text-slate-400'}`}>
                                {step.done ? '✓' : idx + 1}
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-[#94A3B8] uppercase">{step.stage}</p>
                                <p className="text-xs font-bold text-[#0F172A]">{step.title}</p>
                              </div>
                            </div>
                            {isOpen ? <ChevronUp className="h-4 w-4 text-[#64748B]" /> : <ChevronDown className="h-4 w-4 text-[#64748B]" />}
                          </button>

                          {isOpen && (
                            <div className="px-3.5 pb-3.5 pt-1 border-t border-[#F1F5F9] text-xs space-y-1 animate-in fade-in">
                              <p className="text-[11px] font-semibold text-emerald-600">{step.time}</p>
                              <p className="text-[#64748B]">{step.details}</p>
                              <p className="text-[11px] font-medium text-[#0F172A]">Ref / Actor: {step.actor}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Real-time Threaded Channel Chat */}
                  <div className="bg-white rounded-[24px] p-4 border border-[#E2E8F0] shadow-sm space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <MessageSquare className="h-4 w-4 text-[#1D4ED8]" />
                      <h4 className="text-xs font-bold text-[#0F172A]">Dedicated Request Channel</h4>
                    </div>

                    <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                      {req.messages.map((m) => (
                        <div key={m.id} className={`p-2.5 rounded-2xl text-xs ${m.isStaff ? 'bg-blue-50 text-blue-900 ml-4 border border-blue-100' : 'bg-slate-50 text-slate-900 mr-4 border border-slate-100'}`}>
                          <div className="flex justify-between items-center text-[10px] font-bold mb-0.5">
                            <span className={m.isStaff ? 'text-[#1D4ED8]' : 'text-[#0F172A]'}>{m.author} · {m.role}</span>
                            <span className="text-[#94A3B8]">{m.timestamp}</span>
                          </div>
                          <p>{m.text}</p>
                        </div>
                      ))}
                    </div>

                    {/* Chat Input */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Post update or clarification..."
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#1D4ED8]"
                      />
                      <button
                        onClick={handleSendMessage}
                        className="h-8 w-8 rounded-xl bg-[#0F172A] text-white flex items-center justify-center shrink-0 hover:bg-slate-800"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ----------------------------------------------------------------------------------- */}
        {/* TAB 3: RETIREMENTS (MULTI-RECEIPT ITEMIZATION + AUTO BALANCE MATH)                  */}
        {/* ----------------------------------------------------------------------------------- */}
        {activeTab === 'retirements' && (
          <div className="px-5 space-y-4 flex-1 overflow-y-auto">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#0F172A]">Retire Cash Advance</h2>
              <p className="text-xs text-[#64748B]">Multi-receipt reconciliation under 72h financial controls</p>
            </div>

            {retirementSubmitted ? (
              <div className="p-6 bg-white rounded-[24px] border border-emerald-200 text-center space-y-3 shadow-sm">
                <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <FileCheck className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-[#0F172A]">Retirement Verification Certificate Issued</h3>
                <p className="text-xs text-[#64748B]">
                  Certificate Ref: <strong>RET-2026-0482-CLOSE</strong>. Receipts sent to Internal Verifier. All ledger obligations cleared.
                </p>
                <div className="p-3 bg-slate-50 rounded-xl text-left text-xs font-mono text-slate-700 space-y-1">
                  <div>Advance: ₦{advanceAmount.toLocaleString()}</div>
                  <div>Accounted: ₦{totalReceipts.toLocaleString()}</div>
                  <div>Variance: {variance >= 0 ? `₦${variance.toLocaleString()} (Refunded)` : `₦${Math.abs(variance).toLocaleString()} (Reimbursement Claimed)`}</div>
                </div>
                <button
                  onClick={() => setRetirementSubmitted(false)}
                  className="w-full py-2.5 rounded-xl bg-[#0F172A] text-white text-xs font-bold"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Advance Details */}
                <div className="p-4 bg-white rounded-[22px] border border-[#E2E8F0] space-y-2">
                  <span className="text-[10px] font-bold text-[#64748B]">RECONCILING ADVANCE:</span>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#0F172A]">{activeAdvanceObj.number} · {activeAdvanceObj.title}</p>
                      <p className="text-[10px] text-[#64748B]">Disbursed to Access Bank ···· 6789</p>
                    </div>
                    <span className="text-sm font-bold text-[#0F172A] font-mono">₦{advanceAmount.toLocaleString()}</span>
                  </div>
                </div>

                {/* Multi-Receipt Table */}
                <div className="p-4 bg-white rounded-[22px] border border-[#E2E8F0] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0F172A]">Itemized Physical Receipts ({retirementReceipts.length})</span>
                    <span className="text-xs font-mono font-bold text-[#1D4ED8]">Total: ₦{totalReceipts.toLocaleString()}</span>
                  </div>

                  <div className="space-y-2">
                    {retirementReceipts.map((rcpt) => (
                      <div key={rcpt.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-[#0F172A]">{rcpt.merchant}</p>
                          <p className="text-[10px] text-slate-500">{rcpt.fileName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#0F172A]">₦{rcpt.amount.toLocaleString()}</span>
                          <button
                            onClick={() => setRetirementReceipts(retirementReceipts.filter((r) => r.id !== rcpt.id))}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Receipt Mini-Form */}
                  <div className="pt-2 border-t border-slate-100 flex gap-2">
                    <input
                      type="text"
                      placeholder="Merchant / Item name"
                      value={newReceiptMerchant}
                      onChange={(e) => setNewReceiptMerchant(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-[#1D4ED8]"
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={newReceiptAmount}
                      onChange={(e) => setNewReceiptAmount(e.target.value)}
                      className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-[#1D4ED8]"
                    />
                    <button
                      type="button"
                      onClick={handleAddReceipt}
                      className="px-3 py-1.5 rounded-lg bg-[#0F172A] text-white text-xs font-bold"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {/* Real-time Variance Settlement Engine */}
                <div className={`p-4 rounded-[22px] border ${variance === 0 ? 'bg-emerald-50 border-emerald-300' : variance > 0 ? 'bg-blue-50 border-blue-300' : 'bg-amber-50 border-amber-300'} space-y-2`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">
                      {variance === 0 ? '✓ 100% EXACT MATCH' : variance > 0 ? 'UNSPENT REFUND TO BEMS GROUP:' : 'EXCESS REIMBURSEMENT CLAIM:'}
                    </span>
                    <span className="font-mono font-bold text-sm text-slate-900">₦{Math.abs(variance).toLocaleString()}</span>
                  </div>

                  {variance > 0 && (
                    <div className="text-[11px] text-blue-900 space-y-1">
                      <p>Please return unspent ₦{variance.toLocaleString()} to BEMS Group Treasury:</p>
                      <div className="p-2 bg-white/80 rounded-lg font-mono text-[10px]">
                        <strong>Access Bank Plc</strong> · Account: <strong>0029182736</strong>
                      </div>

                      {refundProofFile ? (
                        <div className="p-2 bg-white rounded-lg text-emerald-800 font-semibold flex justify-between items-center">
                          <span>✓ {refundProofFile}</span>
                          <button onClick={() => setRefundProofFile(null)} className="font-bold">✕</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRefundProofFile('access_bank_refund_transfer_receipt.pdf')}
                          className="w-full py-2 rounded-lg bg-[#1D4ED8] text-white text-[11px] font-bold"
                        >
                          + Upload Proof of Refund Transfer
                        </button>
                      )}
                    </div>
                  )}

                  {variance < 0 && (
                    <p className="text-[11px] text-amber-900">
                      Legitimate excess spend of ₦{Math.abs(variance).toLocaleString()} will be automatically processed for reimbursement to your salary bank account upon Verifier sign-off.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleRetirementSubmission}
                  className="w-full py-3.5 rounded-2xl bg-[#0F172A] text-white font-bold text-xs shadow-md"
                >
                  Generate Certificate & Close Advance
                </button>
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------------------------- */}
        {/* TAB 4: PAYSLIPS (PR-14 PRIVATE SCOPE + OFFICIAL VOUCHER MODAL)                      */}
        {/* ----------------------------------------------------------------------------------- */}
        {activeTab === 'payslips' && (
          <div className="px-5 space-y-4 flex-1 overflow-y-auto">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#0F172A]">My Payslips & Income</h2>
              <p className="text-xs text-[#64748B]">PR-14: Private verified salary disbursement logs</p>
            </div>

            {/* Current Month Active Payslip Card */}
            <div className="bg-white rounded-[24px] p-5 border border-[#E2E8F0] shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A]">October 2026 Salary</h3>
                  <p className="text-[10px] text-[#64748B]">Paid via Access Bank Corporate</p>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                  SETTLED
                </span>
              </div>

              {/* Summary line */}
              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between text-[#64748B]">
                  <span>Gross Salary:</span>
                  <span className="font-mono text-[#0F172A]">₦750,000</span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>PAYE State Tax:</span>
                  <span className="font-mono">- ₦45,000</span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>RSA Pension (8%):</span>
                  <span className="font-mono">- ₦25,000</span>
                </div>
                <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-[#0F172A]">
                  <span>Net Paid to Account:</span>
                  <span className="font-mono text-emerald-600 text-sm">₦680,000</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => setShowPayslipVoucher(true)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[#0F172A] text-xs font-bold hover:bg-slate-50 flex items-center justify-center gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Inspect Voucher</span>
                </button>

                {payslipConfirmed ? (
                  <div className="flex-1 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold flex items-center justify-center gap-1">
                    <Check className="h-3.5 w-3.5" />
                    <span>Confirmed</span>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setPayslipConfirmed(true);
                      setNotice('Salary transfer confirmed! Acknowledgment logged with HR & Payroll.');
                      setTimeout(() => setNotice(null), 4000);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-[#0F172A] text-white text-xs font-bold shadow-sm"
                  >
                    Confirm Transfer
                  </button>
                )}
              </div>
            </div>

            {/* Historical Payslips */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-[#64748B] uppercase">Past Compensation Statements</h4>
              {['September 2026', 'August 2026', 'July 2026'].map((period) => (
                <div key={period} className="p-3.5 bg-white rounded-[20px] border border-[#E2E8F0] flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-[#0F172A]">{period} Salary</p>
                    <p className="text-[10px] text-slate-500">Access Bank · Settled</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-[#0F172A]">₦680,000</span>
                    <button
                      onClick={() => setShowPayslipVoucher(true)}
                      className="text-[#1D4ED8] hover:underline text-[11px] font-semibold"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------------------------- */}
        {/* TAB 5: PROFILE & NOTIFICATION BRIDGE HOOKS                                          */}
        {/* ----------------------------------------------------------------------------------- */}
        {activeTab === 'profile' && (
          <div className="px-5 space-y-4 flex-1 overflow-y-auto">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#0F172A]">Staff Profile & Bridges</h2>
              <p className="text-xs text-[#64748B]">Entity assignment & notification simulator</p>
            </div>

            <div className="bg-white p-5 rounded-[24px] border border-[#E2E8F0] shadow-sm flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-[#FEF3C7] text-[#92400E] font-bold text-base flex items-center justify-center">
                TB
              </div>
              <div>
                <p className="text-sm font-bold text-[#0F172A]">Temitope Bakare</p>
                <p className="text-xs text-[#64748B]">Lead DevOps Engineer</p>
                <span className="text-[10px] font-mono font-bold text-[#1D4ED8]">ID: BEMS-TECH-0482</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-[22px] border border-[#E2E8F0] shadow-sm space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-[#64748B]">Active Subsidiary:</span>
                <span className="font-semibold text-[#0F172A] text-right max-w-[200px] truncate">{activeSubsidiary}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-[#64748B]">Disbursement Bank:</span>
                <span className="font-semibold text-[#0F172A]">Access Bank · 0123456789</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#64748B]">Verification Status:</span>
                <span className="text-emerald-600 font-bold">Verified Employee</span>
              </div>
            </div>

            {/* Notification Bridge Test Triggers */}
            <div className="p-4 bg-white rounded-[22px] border border-[#E2E8F0] shadow-sm space-y-3">
              <div>
                <h4 className="text-xs font-bold text-[#0F172A]">Notification Bridge Hooks</h4>
                <p className="text-[11px] text-[#64748B]">Test instant alerts delivered to your devices</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => triggerSimulatedNotification('whatsapp')}
                  className="py-2.5 px-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 flex items-center justify-center gap-1.5"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>Test WhatsApp</span>
                </button>

                <button
                  onClick={() => triggerSimulatedNotification('slack')}
                  className="py-2.5 px-3 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold hover:bg-indigo-100 flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Test Slack</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------------------------- */}
        {/* FLOATING PILL BOTTOM NAVIGATION BAR (TRIPGLIDE IMAGE 2 SCREEN 1)                    */}
        {/* ----------------------------------------------------------------------------------- */}
        <div className="fixed bottom-3 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
          <nav className="h-16 bg-[#0F172A] rounded-full px-3 flex items-center gap-2 shadow-2xl pointer-events-auto border border-slate-800">
            {[
              { id: 'home', icon: Home, label: 'Home' },
              { id: 'requests', icon: FileText, label: 'Requests' },
              { id: 'retirements', icon: Receipt, label: 'Retirements', badge: activeAdvanceObj?.needsRetirement ? 1 : 0 },
              { id: 'payslips', icon: CreditCard, label: 'Payslips' },
              { id: 'profile', icon: User, label: 'Profile' },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`h-11 w-11 rounded-full flex items-center justify-center transition-all relative ${
                    isSelected
                      ? 'bg-white text-[#0F172A] shadow-md scale-105'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                  title={tab.label}
                >
                  <Icon className="h-5 w-5" />
                  {tab.badge && !isSelected ? (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-400" />
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ----------------------------------------------------------------------------------- */}
        {/* FLOW 1: 5-STEP FUND REQUEST CREATION WIZARD MODAL                                   */}
        {/* ----------------------------------------------------------------------------------- */}
        {showWizard && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] p-6 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-8">
              
              {/* Wizard Step Progress Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-[#1D4ED8] uppercase">STEP {wizardStep} OF 5</span>
                  <h3 className="text-base font-bold text-[#0F172A]">
                    {wizardStep === 1 && 'Expense Purpose & Category'}
                    {wizardStep === 2 && 'Itemized Budget Breakdown'}
                    {wizardStep === 3 && 'Documentation & Timeline'}
                    {wizardStep === 4 && 'Disbursement Beneficiary'}
                    {wizardStep === 5 && 'Review & Authorize Submission'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowWizard(false)}
                  className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Progress Indicator */}
              <div className="grid grid-cols-5 gap-1 my-3">
                {[1, 2, 3, 4, 5].map((st) => (
                  <div
                    key={st}
                    className={`h-1.5 rounded-full ${st <= wizardStep ? 'bg-[#1D4ED8]' : 'bg-slate-200'}`}
                  />
                ))}
              </div>

              {/* STEP 1: Basic Info */}
              {wizardStep === 1 && (
                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="font-bold text-[#0F172A] block mb-1">Request Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Annual SSL Wildcard Certificate & Hostinger VPS"
                      value={wizTitle}
                      onChange={(e) => setWizTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#1D4ED8]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#0F172A] block mb-1">Expense Category *</label>
                    <select
                      value={wizCategory}
                      onChange={(e) => setWizCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#1D4ED8] bg-white"
                    >
                      <option value="Software & Infrastructure">Software & Infrastructure</option>
                      <option value="Petty Cash & Field Advance">Petty Cash & Field Advance</option>
                      <option value="Travel & Logistics">Travel & Logistics</option>
                      <option value="Power & Facilities">Power & Facilities</option>
                      <option value="Vendor Supplier Invoice">Vendor Supplier Invoice</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-[#0F172A] block mb-1">Chargeable Department *</label>
                    <select
                      value={wizDepartment}
                      onChange={(e) => setWizDepartment(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#1D4ED8] bg-white"
                    >
                      <option value="Technology & DevOps">Technology & DevOps</option>
                      <option value="Operations & Facilities">Operations & Facilities</option>
                      <option value="Finance & Treasury">Finance & Treasury</option>
                      <option value="Media & Logistics">Media & Logistics</option>
                    </select>
                  </div>

                  <button
                    disabled={!wizTitle}
                    onClick={() => setWizardStep(2)}
                    className="w-full py-3 rounded-xl bg-[#0F172A] text-white font-bold text-xs shadow-md mt-4 disabled:opacity-40"
                  >
                    Next: Itemized Breakdown →
                  </button>
                </div>
              )}

              {/* STEP 2: Itemized Line Items Table */}
              {wizardStep === 2 && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0F172A]">Cost Line Items</span>
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="text-[#1D4ED8] font-bold text-xs"
                    >
                      + Add Item
                    </button>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {wizLineItems.map((item, idx) => (
                      <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#64748B]">ITEM #{idx + 1}</span>
                          {wizLineItems.length > 1 && (
                            <button onClick={() => removeLineItem(item.id)} className="text-red-500 font-bold text-[10px]">
                              Remove
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="Description of item or service"
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-slate-500">Qty:</span>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500">Unit Price (₦):</span>
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 flex justify-between font-bold text-[#0F172A]">
                    <span>Calculated Total:</span>
                    <span className="font-mono text-sm text-[#1D4ED8]">₦{wizTotal.toLocaleString()}</span>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setWizardStep(1)}
                      className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs"
                    >
                      ← Back
                    </button>
                    <button
                      disabled={wizTotal <= 0}
                      onClick={() => setWizardStep(3)}
                      className="flex-1 py-3 rounded-xl bg-[#0F172A] text-white font-bold text-xs shadow-md disabled:opacity-40"
                    >
                      Next: Documentation →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Documentation & Timeline */}
              {wizardStep === 3 && (
                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="font-bold text-[#0F172A] block mb-1">Required Settlement Date *</label>
                    <input
                      type="date"
                      value={wizRequiredDate}
                      onChange={(e) => setWizRequiredDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#0F172A] block mb-1">Business Rationale / Justification *</label>
                    <textarea
                      rows={3}
                      placeholder="Explain how this expenditure impacts current operational milestones..."
                      value={wizRationale}
                      onChange={(e) => setWizRationale(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#0F172A] block mb-1">Attach Supporting Proforma / Quote</label>
                    {wizAttachedFile ? (
                      <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs flex justify-between items-center border border-emerald-200">
                        <span>✓ {wizAttachedFile}</span>
                        <button onClick={() => setWizAttachedFile(null)} className="font-bold">✕</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setWizAttachedFile('hostinger_official_quote_oct2026.pdf')}
                        className="w-full py-2.5 rounded-xl border border-dashed border-[#1D4ED8] text-[#1D4ED8] font-bold text-xs hover:bg-blue-50"
                      >
                        + Select Quote PDF or Image
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setWizardStep(2)}
                      className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={() => setWizardStep(4)}
                      className="flex-1 py-3 rounded-xl bg-[#0F172A] text-white font-bold text-xs shadow-md"
                    >
                      Next: Beneficiary →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: Beneficiary Selection */}
              {wizardStep === 4 && (
                <div className="space-y-3.5 text-xs">
                  <span className="font-bold text-[#0F172A] block">Choose Payment Beneficiary:</span>

                  <div
                    onClick={() => setWizBeneficiary('STAFF_ACCOUNT')}
                    className={`p-3.5 rounded-2xl border cursor-pointer ${
                      wizBeneficiary === 'STAFF_ACCOUNT'
                        ? 'bg-blue-50 border-[#1D4ED8] ring-2 ring-[#1D4ED8]/20'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0F172A]">My Salary Bank Account</span>
                      <span className="text-xs text-[#1D4ED8] font-bold">VERIFIED</span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-1">Access Bank Plc · 0123456789 (Temitope Bakare)</p>
                  </div>

                  <div
                    onClick={() => setWizBeneficiary('VENDOR_ACCOUNT')}
                    className={`p-3.5 rounded-2xl border cursor-pointer ${
                      wizBeneficiary === 'VENDOR_ACCOUNT'
                        ? 'bg-blue-50 border-[#1D4ED8] ring-2 ring-[#1D4ED8]/20'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0F172A]">Registered Vendor Account</span>
                      <span className="text-xs text-slate-500">3-Way Match</span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-1">Direct settlement to approved vendor per invoice PO</p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setWizardStep(3)}
                      className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={() => setWizardStep(5)}
                      className="flex-1 py-3 rounded-xl bg-[#0F172A] text-white font-bold text-xs shadow-md"
                    >
                      Next: Review Summary →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5: Final Review & Submission */}
              {wizardStep === 5 && (
                <div className="space-y-3.5 text-xs">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <span className="text-[10px] font-bold text-[#64748B]">EXPENDITURE SUMMARY:</span>
                    <h4 className="text-sm font-bold text-[#0F172A]">{wizTitle}</h4>
                    <div className="text-2xl font-bold font-mono text-[#1D4ED8]">₦{wizTotal.toLocaleString()}</div>
                    <div className="text-[11px] text-slate-600 space-y-0.5 pt-1 border-t border-slate-200">
                      <div>Entity: {activeSubsidiary}</div>
                      <div>Department: {wizDepartment}</div>
                      <div>Beneficiary: {wizBeneficiary === 'STAFF_ACCOUNT' ? 'Access Bank · 0123456789' : 'Vendor Registry'}</div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setWizardStep(4)}
                      className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleFinalSubmit}
                      className="flex-1 py-3.5 rounded-xl bg-[#1D4ED8] text-white font-bold text-xs shadow-lg shadow-blue-600/30"
                    >
                      Submit for Approval ✓
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------------------------- */}
        {/* FLOW 4: OFFICIAL PAYSLIP VOUCHER MODAL (PR-14 COMPLIANT)                            */}
        {/* ----------------------------------------------------------------------------------- */}
        {showPayslipVoucher && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-[28px] p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg overflow-hidden flex items-center justify-center bg-[#0F172A] border border-slate-200">
                    <img src="/bems-logo.png" alt="BEMS Group" className="h-full w-full object-contain" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#0F172A]">BEMS GROUP</h3>
                    <p className="text-[9px] text-[#64748B]">Official Compensation Voucher</p>
                  </div>
                </div>
                <button onClick={() => setShowPayslipVoucher(false)} className="text-slate-400 hover:text-slate-700 font-bold text-sm">✕</button>
              </div>

              <div className="text-center py-2 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">OCTOBER 2026 EARNINGS</span>
                <div className="text-2xl font-bold font-mono text-[#0F172A] mt-0.5">₦680,000</div>
                <span className="text-[10px] text-emerald-600 font-bold">SETTLED VIA ACCESS BANK</span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Basic Salary:</span>
                  <span className="font-mono">₦450,000</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Housing Allowance:</span>
                  <span className="font-mono">₦180,000</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Transport Allowance:</span>
                  <span className="font-mono">₦80,000</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Utility Allowance:</span>
                  <span className="font-mono">₦40,000</span>
                </div>
                <div className="border-t border-slate-100 pt-1 flex justify-between font-bold text-[#0F172A]">
                  <span>Total Gross Pay:</span>
                  <span className="font-mono">₦750,000</span>
                </div>
                <div className="flex justify-between text-red-500 pt-1 border-t border-slate-100">
                  <span>PAYE Income Tax:</span>
                  <span className="font-mono">- ₦45,000</span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>RSA Pension (8%):</span>
                  <span className="font-mono">- ₦25,000</span>
                </div>
                <div className="border-t-2 border-slate-200 pt-1.5 flex justify-between font-bold text-sm text-[#0F172A]">
                  <span>Net Take-Home:</span>
                  <span className="font-mono text-emerald-600">₦680,000</span>
                </div>
              </div>

              <div className="p-2.5 bg-blue-50 text-[10px] text-blue-900 rounded-xl space-y-0.5">
                <div>Employing Entity: Bems Group Cloud & Technologies Ltd</div>
                <div>Paying Entity: Bems Group Holdings Ltd (HQ Treasury)</div>
                <div>Bank Reference: TRF/PAY/BEMS/2026/10-0982</div>
              </div>

              <button
                onClick={() => {
                  setShowPayslipVoucher(false);
                  setNotice('Voucher downloaded to device!');
                  setTimeout(() => setNotice(null), 3000);
                }}
                className="w-full py-2.5 rounded-xl bg-[#0F172A] text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Save Official Voucher (PDF)</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
