export interface RoleCardTheme {
  primaryGradient: string;
  primarySolid: string;
  secondarySolid: string;
  accentColor: string;
  lightBg: string;
  pillBorder: string;
  timeTrackerBg: string;
  topographicStroke: string;
  funnelGradient: string;
  funnelHatch: string;
  arcStroke: string;
}

export interface FunnelStageData {
  label: string;
  value: string;
  amount: string;
  height: number;
  drop: string;
}

export interface VolumeRowData {
  label: string;
  percent: number;
  color: string;
  hatchGradient: string;
}

export interface BentoPillData {
  label: string;
  value: string;
  delta: string;
  deltaIcon?: string;
  link: string;
  isPrimary?: boolean;
  statusBadge?: string;
}

export interface TeamMemberData {
  name: string;
  avatarEmoji: string;
  avatarBg: string;
  task: string;
  status: 'Completed' | 'In Progress' | 'Pending';
  statusColor: string;
  textColor: string;
  borderColor: string;
}

export interface ProjectItemData {
  title: string;
  date: string;
  glyph: 'endpoints' | 'onboarding' | 'dashboard' | 'optimize' | 'testing';
}

export interface RoleDashboardConfig {
  roleTitle: string;
  roleBadge: string;
  subtitle: string;
  theme: RoleCardTheme;
  bentoPills: BentoPillData[];
  funnelTitle: string;
  funnelSubtitle: string;
  funnelStages: FunnelStageData[];
  funnelExplorePrompt: string;
  funnelTagText: string;
  volumeTitle: string;
  volumeAmount: string;
  volumeRows: VolumeRowData[];
  analyticsTitle: string;
  capsuleDays: { day: string; height: number; type: 'hatched' | 'solid-light' | 'solid-mid' | 'solid-dark'; tooltip?: string }[];
  reminderTitle: string;
  reminderSubtitle: string;
  reminderTime: string;
  reminderButton: string;
  projectsTitle: string;
  projects: ProjectItemData[];
  teamTitle: string;
  teamMembers: TeamMemberData[];
  arcTitle: string;
  arcPercent: number;
  arcSubtitle: string;
  timerTitle: string;
  timerSubtitle: string;
  timerValue: string;
  retentionTitle: string;
  retentionPeak: string;
  transactionsTitle: string;
  transactionsAmount: string;
  transactionsDelta: string;
  transactionsPeak: string;
  insightValue: string;
  insightLabel: string;
}

export const roleDashboardConfigs: Record<string, RoleDashboardConfig> = {
  GMD: {
    roleTitle: 'Group Managing Director Command',
    roleBadge: 'Super Executive',
    subtitle: 'Group-wide multi-subsidiary expenditure, approvals & treasury accountability.',
    theme: {
      primaryGradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
      primarySolid: '#ea580c',
      secondarySolid: '#f97316',
      accentColor: '#fdba74',
      lightBg: '#fff7ed',
      pillBorder: '#fed7aa',
      timeTrackerBg: 'linear-gradient(145deg, #0b1220 0%, #2a150e 100%)',
      topographicStroke: '#fb923c',
      funnelGradient: 'linear-gradient(180deg, #f97316 0%, #c2410c 100%)',
      funnelHatch: 'repeating-linear-gradient(45deg, #ea580c, #ea580c 4px, #f97316 4px, #f97316 8px)',
      arcStroke: '#ea580c',
    },
    bentoPills: [
      { label: 'Total Group Requests', value: '24', delta: 'Requests across all subsidiaries', isPrimary: true, link: '/requests' },
      { label: 'Closed & Accounted', value: '10', delta: 'Requests closed with evidence recorded', link: '/accountability' },
      { label: 'Payments Recorded', value: '12', delta: 'Payment records awaiting or completing verification', link: '/disbursements' },
      { label: 'Executive Review Required', value: '2', delta: 'Pending GMD authorization', statusBadge: 'Action Needed', link: '/approvals' },
    ],
    funnelTitle: 'Group Multi-Subsidiary Expenditure Funnel',
    funnelSubtitle: 'End-to-end expenditure progression from submission to clearance',
    funnelStages: [
      { label: 'Initiated Requests', value: '65.2k', amount: '₦65.2M', height: 175, drop: '-16%' },
      { label: 'HOD Authorized', value: '54.8k', amount: '₦54.8M', height: 145, drop: '-11%' },
      { label: 'GMD Approved', value: '48.6k', amount: '₦48.6M', height: 115, drop: '-21%' },
      { label: 'Payment Recorded', value: '38.3k', amount: '₦38.3M', height: 85, drop: '-14%' },
      { label: 'Audited & Cleared', value: '32.9k', amount: '₦32.9M', height: 65, drop: 'Closed' },
    ],
    funnelExplorePrompt: 'What caused the drop-off from authorized to',
    funnelTagText: '/gmd-approved',
    volumeTitle: 'Gross Group Outflow',
    volumeAmount: '₦41.5M',
    volumeRows: [
      { label: 'Direct Supplier Invoices', percent: 65, color: '#10b981', hatchGradient: 'repeating-linear-gradient(45deg, #10b981, #10b981 3px, #34d399 3px, #34d399 6px)' },
      { label: 'Cloud & Infrastructure Renewals', percent: 25, color: '#ea580c', hatchGradient: 'repeating-linear-gradient(45deg, #ea580c, #ea580c 3px, #fb923c 3px, #fb923c 6px)' },
      { label: 'Petty Cash & Project Advances', percent: 10, color: '#ec4899', hatchGradient: 'repeating-linear-gradient(45deg, #ec4899, #ec4899 3px, #f472b6 3px, #f472b6 6px)' },
    ],
    analyticsTitle: 'Group Spending Velocity',
    capsuleDays: [
      { day: 'S', height: 75, type: 'hatched' },
      { day: 'M', height: 135, type: 'solid-mid' },
      { day: 'T', height: 105, type: 'solid-light', tooltip: '82%' },
      { day: 'W', height: 160, type: 'solid-dark' },
      { day: 'T', height: 120, type: 'hatched' },
      { day: 'F', height: 135, type: 'hatched' },
      { day: 'S', height: 70, type: 'hatched' },
    ],
    reminderTitle: 'Executive Governance Review',
    reminderSubtitle: 'Meeting with Subsidiary Leads',
    reminderTime: 'Time : 02.00 pm - 04.00 pm',
    reminderButton: 'Join Executive Briefing',
    projectsTitle: 'Active Capital Commitments',
    projects: [
      { title: 'Hostinger Cloud VPS Infrastructure', date: 'Due: Oct 28, 2026', glyph: 'endpoints' },
      { title: 'Bems Farms Bulk Diesel Supply', date: 'Due: Oct 30, 2026', glyph: 'onboarding' },
      { title: 'DevOps Engineering Payroll Allocation', date: 'Due: Nov 05, 2026', glyph: 'dashboard' },
      { title: 'Zenith Treasury Float Balancing', date: 'Due: Nov 12, 2026', glyph: 'optimize' },
      { title: 'Q1 External Compliance Audit', date: 'Due: Nov 20, 2026', glyph: 'testing' },
    ],
    teamTitle: 'Executive C-Suite & Approvers',
    teamMembers: [
      { name: 'Henry Nwosu', avatarEmoji: '👨🏾‍💼', avatarBg: '#ffedd5', task: 'Reviewing Hostinger Cloud VPS Renewal', status: 'Completed', statusColor: '#f0fdf4', textColor: '#16a34a', borderColor: '#dcfce7' },
      { name: 'System Admin', avatarEmoji: '👨🏾‍💻', avatarBg: '#fef3c7', task: 'Reviewing Bulk Diesel Supply (TotalEnergies)', status: 'In Progress', statusColor: '#fefce8', textColor: '#ca8a04', borderColor: '#fef08a' },
      { name: 'Isaac Oluwatemilorun', avatarEmoji: '🧔🏾‍♂️', avatarBg: '#ede9fe', task: 'Auditing Q1 Advance Waybills & Retirals', status: 'Pending', statusColor: '#fef2f2', textColor: '#dc2626', borderColor: '#fee2e2' },
      { name: 'David Oshodi (HR)', avatarEmoji: '👨🏽‍🎨', avatarBg: '#ffedd5', task: 'Recharging DevOps Salaries (70/30 Split)', status: 'In Progress', statusColor: '#fefce8', textColor: '#ca8a04', borderColor: '#fef08a' },
    ],
    arcTitle: 'Accountability Clearance Rate',
    arcPercent: 84,
    arcSubtitle: 'Subsidiaries Cleared',
    timerTitle: 'GMD Review SLA Clock',
    timerSubtitle: 'Emergency advance approval: REQ-2026-0003',
    timerValue: '01:24:08',
    retentionTitle: 'Budget Retention',
    retentionPeak: '42%',
    transactionsTitle: 'Transactions',
    transactionsAmount: '106k',
    transactionsDelta: '+34,002',
    transactionsPeak: 'Wed',
    insightValue: '75%',
    insightLabel: 'Group Compliance',
  },

  COO: {
    roleTitle: 'COO Operations & Logistics Command',
    roleBadge: 'Operations Lead',
    subtitle: 'Daily operational purchase orders, 3-way matching, dispatch & vendor payments.',
    theme: {
      primaryGradient: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
      primarySolid: '#ea580c',
      secondarySolid: '#f97316',
      accentColor: '#fdba74',
      lightBg: '#fff7ed',
      pillBorder: '#fed7aa',
      timeTrackerBg: 'linear-gradient(145deg, #0b1220 0%, #2a150e 100%)',
      topographicStroke: '#fb923c',
      funnelGradient: 'linear-gradient(180deg, #f97316 0%, #ea580c 100%)',
      funnelHatch: 'repeating-linear-gradient(45deg, #ea580c, #ea580c 4px, #fdba74 4px, #fdba74 8px)',
      arcStroke: '#ea580c',
    },
    bentoPills: [
      { label: 'Total Operations Requests', value: '18', delta: '+12% from last cycle', isPrimary: true, link: '/requests' },
      { label: 'Delivered & Waybill Verified', value: '9', delta: 'Physical delivery confirmed', link: '/accountability' },
      { label: 'In Transit & Execution', value: '7', delta: 'Fleet dispatch in progress', link: '/disbursements' },
      { label: 'Vendor Price Reviews', value: '2', delta: 'Quotation benchmark review', statusBadge: 'Needs COO Check', link: '/approvals' },
    ],
    funnelTitle: 'Procurement & Logistics Execution Pipeline',
    funnelSubtitle: 'From vendor quote to 3-way matched supplier payment',
    funnelStages: [
      { label: 'PO Submitted', value: '42.0k', amount: '₦42.0M', height: 175, drop: '-12%' },
      { label: 'Price Benchmarked', value: '37.0k', amount: '₦37.0M', height: 145, drop: '-8%' },
      { label: 'Goods Received (GRN)', value: '34.0k', amount: '₦34.0M', height: 115, drop: '-18%' },
      { label: '3-Way Matched', value: '28.0k', amount: '₦28.0M', height: 85, drop: '-10%' },
      { label: 'Supplier Disbursed', value: '25.2k', amount: '₦25.2M', height: 65, drop: 'Settled' },
    ],
    funnelExplorePrompt: 'What caused the drop-off from goods received to',
    funnelTagText: '/3-way-matched',
    volumeTitle: 'Operations Procurement Spend',
    volumeAmount: '₦28.4M',
    volumeRows: [
      { label: 'Logistics Fleet Diesel & Maintenance', percent: 55, color: '#ea580c', hatchGradient: 'repeating-linear-gradient(45deg, #ea580c, #ea580c 3px, #fb923c 3px, #fb923c 6px)' },
      { label: 'Cold Chain & Warehouse Operations', percent: 30, color: '#0d9488', hatchGradient: 'repeating-linear-gradient(45deg, #0d9488, #0d9488 3px, #2dd4bf 3px, #2dd4bf 6px)' },
      { label: 'Farm Equipment Repairs & Parts', percent: 15, color: '#f59e0b', hatchGradient: 'repeating-linear-gradient(45deg, #f59e0b, #f59e0b 3px, #fbbf24 3px, #fbbf24 6px)' },
    ],
    analyticsTitle: 'Daily Fleet & Logistics Waybills',
    capsuleDays: [
      { day: 'S', height: 60, type: 'hatched' },
      { day: 'M', height: 140, type: 'solid-mid' },
      { day: 'T', height: 110, type: 'solid-light', tooltip: '88%' },
      { day: 'W', height: 165, type: 'solid-dark' },
      { day: 'T', height: 130, type: 'solid-mid' },
      { day: 'F', height: 145, type: 'hatched' },
      { day: 'S', height: 80, type: 'hatched' },
    ],
    reminderTitle: 'Vendor Performance Review',
    reminderSubtitle: 'TotalEnergies Bulk Diesel Contract',
    reminderTime: 'Time : 11.00 am - 12.30 pm',
    reminderButton: 'Open Logistics Review',
    projectsTitle: 'Operational Execution Desk',
    projects: [
      { title: 'TotalEnergies 10,000L Bulk Diesel Delivery', date: 'Due: Oct 26, 2026', glyph: 'onboarding' },
      { title: 'Cold Storage Generator Overhaul', date: 'Due: Oct 29, 2026', glyph: 'endpoints' },
      { title: 'Fleet Tracking GPS Subscription Renewal', date: 'Due: Nov 02, 2026', glyph: 'dashboard' },
      { title: 'Warehouse Packaging Bags Procurement', date: 'Due: Nov 08, 2026', glyph: 'optimize' },
      { title: 'Poultry Feed Batch 4 Reconciliation', date: 'Due: Nov 15, 2026', glyph: 'testing' },
    ],
    teamTitle: 'Operations & Logistics Team',
    teamMembers: [
      { name: 'Edwin Adenike', avatarEmoji: '👨🏾‍💻', avatarBg: '#e0f2fe', task: 'Approving Bulk Diesel Supply', status: 'Completed', statusColor: '#f0fdf4', textColor: '#16a34a', borderColor: '#dcfce7' },
      { name: 'Chukwuma Eze (Logistics)', avatarEmoji: '🚛', avatarBg: '#fef3c7', task: 'Waybill Inspection: Truck #4 Delivery', status: 'In Progress', statusColor: '#fefce8', textColor: '#ca8a04', borderColor: '#fef08a' },
      { name: 'Grace Bello (Warehouse)', avatarEmoji: '📦', avatarBg: '#ede9fe', task: 'Goods Received Note for Spare Parts', status: 'Pending', statusColor: '#fef2f2', textColor: '#dc2626', borderColor: '#fee2e2' },
      { name: 'Babatunde Alabi (Procurement)', avatarEmoji: '📋', avatarBg: '#ffedd5', task: 'Benchmarking 3 Local Vendor Quotes', status: 'In Progress', statusColor: '#fefce8', textColor: '#ca8a04', borderColor: '#fef08a' },
    ],
    arcTitle: '3-Way Match Verification Rate',
    arcPercent: 91,
    arcSubtitle: 'Invoices Cleared',
    timerTitle: 'Expedited Dispatch SLA Clock',
    timerSubtitle: 'Truck 04 Diesel Delivery: REQ-2026-0002',
    timerValue: '03:45:12',
    retentionTitle: 'Inventory Turnover',
    retentionPeak: '58%',
    transactionsTitle: 'Waybill Volume',
    transactionsAmount: '84k',
    transactionsDelta: '+12,450',
    transactionsPeak: 'Thu',
    insightValue: '91%',
    insightLabel: 'Logistics SLA',
  },

  HR: {
    roleTitle: 'HR & People Operations Command',
    roleBadge: 'People & Payroll',
    subtitle: 'Dual-entity 70/30 staff allocation, clean payroll (no tax) & staff welfare.',
    theme: {
      primaryGradient: 'linear-gradient(135deg, #4c1d95 0%, #7158de 100%)',
      primarySolid: '#4c1d95',
      secondarySolid: '#7158de',
      accentColor: '#c084fc',
      lightBg: '#faf5ff',
      pillBorder: '#e9d5ff',
      timeTrackerBg: 'linear-gradient(145deg, #2e1065 0%, #4c1d95 100%)',
      topographicStroke: '#c4b5fd',
      funnelGradient: 'linear-gradient(180deg, #7158de 0%, #4c1d95 100%)',
      funnelHatch: 'repeating-linear-gradient(45deg, #7158de, #7158de 4px, #a78bfa 4px, #a78bfa 8px)',
      arcStroke: '#7158de',
    },
    bentoPills: [
      { label: 'Total Active Staff', value: '46', delta: 'Across 3 subsidiaries', isPrimary: true, link: '/payroll' },
      { label: 'Payroll Cleared (No Tax)', value: '42', delta: '100% Gross = Net calculated', link: '/payroll' },
      { label: 'Dual-Entity 70/30 Splits', value: '8', delta: 'Intercompany notes generated', link: '/intercompany' },
      { label: 'Pending Welfare Claims', value: '4', delta: 'Medical & transport advances', statusBadge: 'Review Needed', link: '/requests' },
    ],
    funnelTitle: 'Monthly Payroll Run Pipeline (No Tax)',
    funnelSubtitle: 'Zero-tax statutory formula: clean gross = net across entities',
    funnelStages: [
      { label: 'Timesheets Logged', value: '46.0k', amount: '₦21.2M', height: 175, drop: '-6%' },
      { label: '70/30 Splits Applied', value: '43.2k', amount: '₦19.8M', height: 145, drop: '-4%' },
      { label: 'HR Lead Cleared', value: '41.5k', amount: '₦18.5M', height: 115, drop: '-8%' },
      { label: 'COO Authorized', value: '38.2k', amount: '₦17.2M', height: 85, drop: '-5%' },
      { label: 'Disbursed to Staff', value: '36.3k', amount: '₦16.3M', height: 65, drop: 'Paid' },
    ],
    funnelExplorePrompt: 'What caused the drop-off from 70/30 split to',
    funnelTagText: '/hr-cleared',
    volumeTitle: 'Monthly Payroll Volume',
    volumeAmount: '₦18.5M',
    volumeRows: [
      { label: 'BemsSoft Hub Ltd (Engineering & Ops)', percent: 60, color: '#7158de', hatchGradient: 'repeating-linear-gradient(45deg, #7158de, #7158de 3px, #a78bfa 3px, #a78bfa 6px)' },
      { label: 'Bems Farms & Logistics Ltd (Field & Drivers)', percent: 30, color: '#059669', hatchGradient: 'repeating-linear-gradient(45deg, #059669, #059669 3px, #34d399 3px, #34d399 6px)' },
      { label: 'BEMS Group Holdings Ltd (Management)', percent: 10, color: '#ea580c', hatchGradient: 'repeating-linear-gradient(45deg, #ea580c, #ea580c 3px, #fb923c 3px, #fb923c 6px)' },
    ],
    analyticsTitle: 'Daily Staff Advances & Welfare Claims',
    capsuleDays: [
      { day: 'S', height: 50, type: 'hatched' },
      { day: 'M', height: 120, type: 'solid-mid' },
      { day: 'T', height: 135, type: 'solid-light', tooltip: '94%' },
      { day: 'W', height: 155, type: 'solid-dark' },
      { day: 'T', height: 110, type: 'solid-mid' },
      { day: 'F', height: 140, type: 'hatched' },
      { day: 'S', height: 65, type: 'hatched' },
    ],
    reminderTitle: 'Monthly Payroll Sign-Off',
    reminderSubtitle: 'Cut-off for Bank Batch Upload',
    reminderTime: 'Time : 04.00 pm - 05.30 pm',
    reminderButton: 'Review Payroll Batch',
    projectsTitle: 'People & Payroll Operations',
    projects: [
      { title: 'DevOps Lead Salary 70/30 Cost Allocation', date: 'Due: Oct 25, 2026', glyph: 'dashboard' },
      { title: 'Q4 Health Insurance Group Renewal', date: 'Due: Oct 28, 2026', glyph: 'onboarding' },
      { title: 'Intercompany Debit Note BSH -> BFL', date: 'Due: Nov 01, 2026', glyph: 'endpoints' },
      { title: 'Agronomy Interns Stipend Batch', date: 'Due: Nov 05, 2026', glyph: 'optimize' },
      { title: 'Annual Leave Advance Reconciliations', date: 'Due: Nov 10, 2026', glyph: 'testing' },
    ],
    teamTitle: 'People & Compensation Team',
    teamMembers: [
      { name: 'David Oshodi', avatarEmoji: '👨🏽‍🎨', avatarBg: '#ffedd5', task: 'Finalizing October Payroll Batch (No Tax)', status: 'Completed', statusColor: '#f0fdf4', textColor: '#16a34a', borderColor: '#dcfce7' },
      { name: 'Fatima Sanusi (HR)', avatarEmoji: '👩🏽‍💼', avatarBg: '#e0f2fe', task: 'Verifying Attendance for Farm Handlers', status: 'In Progress', statusColor: '#fefce8', textColor: '#ca8a04', borderColor: '#fef08a' },
      { name: 'Emeka Obi (Finance)', avatarEmoji: '👨🏾‍💼', avatarBg: '#ede9fe', task: 'Generating Dual-Entity Split Invoices', status: 'Pending', statusColor: '#fef2f2', textColor: '#dc2626', borderColor: '#fee2e2' },
      { name: 'Amina Yusuf (Admin)', avatarEmoji: '👩🏾‍💻', avatarBg: '#fef3c7', task: 'Staff Medical Reimbursements Check', status: 'In Progress', statusColor: '#fefce8', textColor: '#ca8a04', borderColor: '#fef08a' },
    ],
    arcTitle: 'Payroll Verification Score',
    arcPercent: 96,
    arcSubtitle: 'Staff Batches Approved',
    timerTitle: 'Payroll Batch Cut-off Clock',
    timerSubtitle: 'Batch dispatch to Access Bank: PAY-2026-10',
    timerValue: '04:15:00',
    retentionTitle: 'Staff Retention',
    retentionPeak: '94%',
    transactionsTitle: 'Salary Outflow',
    transactionsAmount: '46 Staff',
    transactionsDelta: '+3 Hires',
    transactionsPeak: '25th',
    insightValue: '96%',
    insightLabel: 'Payroll Accuracy',
  },

  Auditor: {
    roleTitle: 'Internal Auditor & Compliance Gate',
    roleBadge: 'Accountability Gate',
    subtitle: 'Rigorous proof inspection, waybill verification, receipt stamps & advance retirals.',
    theme: {
      primaryGradient: 'linear-gradient(135deg, #0e3e2d 0%, #15553e 100%)',
      primarySolid: '#0e3e2d',
      secondarySolid: '#0d8a70',
      accentColor: '#34d399',
      lightBg: '#f0fdf4',
      pillBorder: '#bbf7d0',
      timeTrackerBg: 'linear-gradient(145deg, #072319 0%, #0d3a2b 100%)',
      topographicStroke: '#4ade80',
      funnelGradient: 'linear-gradient(180deg, #0d8a70 0%, #0e3e2d 100%)',
      funnelHatch: 'repeating-linear-gradient(45deg, #0d8a70, #0d8a70 4px, #34d399 4px, #34d399 8px)',
      arcStroke: '#0e3e2d',
    },
    bentoPills: [
      { label: 'Requests Under Audit', value: '32', delta: 'Active audit pipeline', isPrimary: true, link: '/audit' },
      { label: 'Clearance Stamped', value: '19', delta: '100% Waybills + receipts validated', link: '/accountability' },
      { label: 'Proof Receipts in Review', value: '9', delta: 'Pending document checks', link: '/accountability' },
      { label: 'Flagged Anomalies', value: '4', delta: 'Unmatched invoices or missing items', statusBadge: 'High Priority', link: '/approvals' },
    ],
    funnelTitle: 'Expenditure Proof & Clearance Funnel',
    funnelSubtitle: '5-stage rigorous gate from advance payment to verified closure',
    funnelStages: [
      { label: 'Advances Disbursed', value: '32.0k', amount: '₦18.4M', height: 175, drop: '-15%' },
      { label: 'Invoices Uploaded', value: '27.2k', amount: '₦15.6M', height: 145, drop: '-12%' },
      { label: 'Waybills Inspected', value: '24.0k', amount: '₦13.8M', height: 115, drop: '-18%' },
      { label: 'Delivery Confirmed', value: '19.7k', amount: '₦11.3M', height: 85, drop: '-8%' },
      { label: 'Clearance Stamped', value: '18.1k', amount: '₦10.4M', height: 65, drop: 'Cleared' },
    ],
    funnelExplorePrompt: 'What caused the drop-off from waybills inspected to',
    funnelTagText: '/clearance-stamped',
    volumeTitle: 'Funds Under Accountability Audit',
    volumeAmount: '₦14.2M',
    volumeRows: [
      { label: 'Fully Verified Proofs (Invoices + Waybills)', percent: 72, color: '#0e3e2d', hatchGradient: 'repeating-linear-gradient(45deg, #0e3e2d, #0e3e2d 3px, #10b981 3px, #10b981 6px)' },
      { label: 'Under Query / Document Clarification', percent: 18, color: '#f59e0b', hatchGradient: 'repeating-linear-gradient(45deg, #f59e0b, #f59e0b 3px, #fbbf24 3px, #fbbf24 6px)' },
      { label: 'Overdue Retirals (>14 Days Unclosed)', percent: 10, color: '#dc2626', hatchGradient: 'repeating-linear-gradient(45deg, #dc2626, #dc2626 3px, #f87171 3px, #f87171 6px)' },
    ],
    analyticsTitle: 'Daily Receipts & Retirals Audited',
    capsuleDays: [
      { day: 'S', height: 75, type: 'hatched' },
      { day: 'M', height: 135, type: 'solid-mid' },
      { day: 'T', height: 105, type: 'solid-light', tooltip: '74%' },
      { day: 'W', height: 160, type: 'solid-dark' },
      { day: 'T', height: 120, type: 'hatched' },
      { day: 'F', height: 135, type: 'hatched' },
      { day: 'S', height: 70, type: 'hatched' },
    ],
    reminderTitle: 'Audit Retiral Clearance Session',
    reminderSubtitle: 'Hostinger & Diesel Proof Review',
    reminderTime: 'Time : 02.00 pm - 04.00 pm',
    reminderButton: 'Start Inspection Desk',
    projectsTitle: 'Accountability Retirals Pending',
    projects: [
      { title: 'REQ-2026-0001 Hostinger Official VAT Receipt', date: 'Due: Oct 26, 2026', glyph: 'endpoints' },
      { title: 'REQ-2026-0002 TotalEnergies Stamped Waybill', date: 'Due: Oct 27, 2026', glyph: 'onboarding' },
      { title: 'REQ-2026-0003 Agronomy Advance Site Photos', date: 'Due: Oct 30, 2026', glyph: 'dashboard' },
      { title: 'DevOps Salary Debit Note Verification', date: 'Due: Nov 02, 2026', glyph: 'optimize' },
      { title: 'Petty Cash Float Reconciliation (Oct)', date: 'Due: Nov 05, 2026', glyph: 'testing' },
    ],
    teamTitle: 'Audit Desk & Compliance Officers',
    teamMembers: [
      { name: 'Isaac Oluwatemilorun', avatarEmoji: '🧔🏾‍♂️', avatarBg: '#ede9fe', task: 'Stamping Hostinger VPS Proof of Payment', status: 'Completed', statusColor: '#f0fdf4', textColor: '#16a34a', borderColor: '#dcfce7' },
      { name: 'Oluwaseun Bakare (Auditor)', avatarEmoji: '👨🏾‍🔬', avatarBg: '#e0f2fe', task: 'Reconciling TotalEnergies Waybill #4902', status: 'In Progress', statusColor: '#fefce8', textColor: '#ca8a04', borderColor: '#fef08a' },
      { name: 'Ngozi Okeke (Field Audit)', avatarEmoji: '👩🏾‍🔧', avatarBg: '#fef3c7', task: 'Physical Verification of Generator Parts', status: 'Pending', statusColor: '#fef2f2', textColor: '#dc2626', borderColor: '#fee2e2' },
      { name: 'Tunde Adewale (Compliance)', avatarEmoji: '👨🏽‍💻', avatarBg: '#ffedd5', task: 'Checking Vendor Tax Clearance Certificate', status: 'In Progress', statusColor: '#fefce8', textColor: '#ca8a04', borderColor: '#fef08a' },
    ],
    arcTitle: '14-Day Accountability Compliance',
    arcPercent: 78,
    arcSubtitle: 'Retirals Cleared',
    timerTitle: 'Advance Retiral Grace Clock',
    timerSubtitle: 'Submission deadline: REQ-2026-0003',
    timerValue: '02:18:45',
    retentionTitle: 'Compliance Integrity',
    retentionPeak: '89%',
    transactionsTitle: 'Audit Checks',
    transactionsAmount: '940 Docs',
    transactionsDelta: '+184 Checked',
    transactionsPeak: 'Wed',
    insightValue: '78%',
    insightLabel: 'Audit Health',
  },

  Staff: {
    roleTitle: 'Staff Personal Requisitions Desk',
    roleBadge: 'Requester View',
    subtitle: 'Submit requests, track COO/GMD approvals, upload receipts & close accountability.',
    theme: {
      primaryGradient: 'linear-gradient(135deg, #78350f 0%, #b45309 100%)',
      primarySolid: '#78350f',
      secondarySolid: '#b45309',
      accentColor: '#fbbf24',
      lightBg: '#fffbeb',
      pillBorder: '#fde68a',
      timeTrackerBg: 'linear-gradient(145deg, #451a03 0%, #78350f 100%)',
      topographicStroke: '#fcd34d',
      funnelGradient: 'linear-gradient(180deg, #b45309 0%, #78350f 100%)',
      funnelHatch: 'repeating-linear-gradient(45deg, #b45309, #b45309 4px, #fbbf24 4px, #fbbf24 8px)',
      arcStroke: '#b45309',
    },
    bentoPills: [
      { label: 'My Total Requests', value: '5', delta: 'This fiscal quarter', isPrimary: true, link: '/requests' },
      { label: 'Disbursed & Paid Out', value: '3', delta: 'Credited to my bank account', link: '/disbursements' },
      { label: 'In Approval Chain', value: '1', delta: 'Awaiting COO sign-off', link: '/approvals' },
      { label: 'Receipts Due for Upload', value: '1', delta: 'REQ-2026-0003 advance proof', statusBadge: 'Upload Needed', link: '/accountability' },
    ],
    funnelTitle: 'My Requisition Lifecycle Funnel',
    funnelSubtitle: 'Track your personal fund request from submission to closure',
    funnelStages: [
      { label: 'Drafted', value: '5', amount: '₦1.2M', height: 175, drop: '0%' },
      { label: 'HOD Endorsed', value: '4', amount: '₦950k', height: 145, drop: '-20%' },
      { label: 'COO Approved', value: '4', amount: '₦950k', height: 115, drop: '0%' },
      { label: 'Bank Disbursed', value: '3', amount: '₦720k', height: 85, drop: '-25%' },
      { label: 'Receipt Closed', value: '2', amount: '₦420k', height: 65, drop: 'Cleared' },
    ],
    funnelExplorePrompt: 'Check status of my request in progress:',
    funnelTagText: '/my-requests',
    volumeTitle: 'My Personal Requisitions Volume',
    volumeAmount: '₦1.2M',
    volumeRows: [
      { label: 'Approved & Disbursed to Bank', percent: 80, color: '#b45309', hatchGradient: 'repeating-linear-gradient(45deg, #b45309, #b45309 3px, #f59e0b 3px, #f59e0b 6px)' },
      { label: 'In Executive Approval Queue', percent: 15, color: '#d97706', hatchGradient: 'repeating-linear-gradient(45deg, #d97706, #d97706 3px, #fbbf24 3px, #fbbf24 6px)' },
      { label: 'Proof Submitted & Awaiting Audit Stamp', percent: 5, color: '#10b981', hatchGradient: 'repeating-linear-gradient(45deg, #10b981, #10b981 3px, #34d399 3px, #34d399 6px)' },
    ],
    analyticsTitle: 'My Weekly Expense Submissions',
    capsuleDays: [
      { day: 'S', height: 40, type: 'hatched' },
      { day: 'M', height: 110, type: 'solid-mid' },
      { day: 'T', height: 130, type: 'solid-light', tooltip: '100%' },
      { day: 'W', height: 150, type: 'solid-dark' },
      { day: 'T', height: 90, type: 'hatched' },
      { day: 'F', height: 120, type: 'hatched' },
      { day: 'S', height: 45, type: 'hatched' },
    ],
    reminderTitle: 'Receipt Upload Reminder',
    reminderSubtitle: 'REQ-2026-0003 Project Advance',
    reminderTime: 'Deadline : Within 48 hours of purchase',
    reminderButton: 'Upload Receipt / Waybill',
    projectsTitle: 'My Requests & Requisitions',
    projects: [
      { title: 'REQ-2026-0003 Hybrid Seed & Fertilizer Advance', date: 'Status: Disbursed', glyph: 'onboarding' },
      { title: 'Field Travel Logistics Reimbursement', date: 'Status: Approved', glyph: 'endpoints' },
      { title: 'Laptop Charger & Peripherals Replacement', date: 'Status: Closed', glyph: 'dashboard' },
      { title: 'Site Inspection Fuel Voucher', date: 'Status: Closed', glyph: 'optimize' },
      { title: 'Client Meeting Refreshments Claim', date: 'Status: Draft', glyph: 'testing' },
    ],
    teamTitle: 'My Approval Chain',
    teamMembers: [
      { name: 'Dr. Chika Nweke (HOD)', avatarEmoji: '👨🏾‍🏫', avatarBg: '#e0f2fe', task: 'Endorsed Seed Procurement Advance', status: 'Completed', statusColor: '#f0fdf4', textColor: '#16a34a', borderColor: '#dcfce7' },
      { name: 'Edwin Adenike (COO)', avatarEmoji: '👨🏾‍💻', avatarBg: '#fef3c7', task: 'Authorized Payment via Zenith Bank', status: 'Completed', statusColor: '#f0fdf4', textColor: '#16a34a', borderColor: '#dcfce7' },
      { name: 'Treasury Desk (Disbursement)', avatarEmoji: '₦', avatarBg: '#ede9fe', task: 'Disbursed to Staff Zenith Account', status: 'Completed', statusColor: '#f0fdf4', textColor: '#16a34a', borderColor: '#dcfce7' },
      { name: 'Isaac Oluwatemilorun (Auditor)', avatarEmoji: '🧔🏾‍♂️', avatarBg: '#ffedd5', task: 'Awaiting Upload of Seed Purchase Waybills', status: 'Pending', statusColor: '#fef2f2', textColor: '#dc2626', borderColor: '#fee2e2' },
    ],
    arcTitle: 'My Receipt Accountability Compliance',
    arcPercent: 100,
    arcSubtitle: 'Receipts Accounted',
    timerTitle: 'Urgent Proof Upload Deadline',
    timerSubtitle: 'Seed Advance Retiral: REQ-2026-0003',
    timerValue: '01:24:08',
    retentionTitle: 'My Spending Budget',
    retentionPeak: '65%',
    transactionsTitle: 'My Submissions',
    transactionsAmount: '₦1.2M',
    transactionsDelta: '5 Requests',
    transactionsPeak: 'Wed',
    insightValue: '100%',
    insightLabel: 'Clearance Score',
  },
};
