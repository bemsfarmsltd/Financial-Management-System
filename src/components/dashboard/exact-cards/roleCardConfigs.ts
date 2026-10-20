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
      timeTrackerBg: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
      topographicStroke: '#fb923c',
      funnelGradient: 'linear-gradient(180deg, #f97316 0%, #c2410c 100%)',
      funnelHatch: 'repeating-linear-gradient(45deg, #ea580c, #ea580c 4px, #f97316 4px, #f97316 8px)',
      arcStroke: '#ea580c',
    },
    bentoPills: [
      { label: 'Total Group Requests', value: '0', delta: '0 requests recorded in system', isPrimary: true, link: '/requests' },
      { label: 'Closed & Accounted', value: '0', delta: '0 closed with evidence recorded', link: '/accountability' },
      { label: 'Payments Recorded', value: '0', delta: '0 disbursements recorded', link: '/disbursements' },
      { label: 'Executive Review Required', value: '0', delta: 'Queue is all clear', link: '/approvals' },
    ],
    funnelTitle: 'Group Multi-Subsidiary Expenditure Funnel',
    funnelSubtitle: 'End-to-end expenditure progression from submission to clearance',
    funnelStages: [
      { label: 'Initiated Requests', value: '0', amount: '₦0', height: 175, drop: '0%' },
      { label: 'HOD Authorized', value: '0', amount: '₦0', height: 145, drop: '0%' },
      { label: 'GMD Approved', value: '0', amount: '₦0', height: 115, drop: '0%' },
      { label: 'Payment Recorded', value: '0', amount: '₦0', height: 85, drop: '0%' },
      { label: 'Audited & Cleared', value: '0', amount: '₦0', height: 65, drop: 'Closed' },
    ],
    funnelExplorePrompt: 'Real-time conversion progression',
    funnelTagText: '/gmd-pipeline',
    volumeTitle: 'Gross Group Outflow',
    volumeAmount: '₦0',
    volumeRows: [
      { label: 'No expenditure recorded yet', percent: 100, color: '#cbd5e1', hatchGradient: 'repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 3px, #e2e8f0 3px, #e2e8f0 6px)' },
    ],
    analyticsTitle: 'Group Spending Velocity',
    capsuleDays: [
      { day: 'S', height: 50, type: 'hatched' },
      { day: 'M', height: 50, type: 'hatched' },
      { day: 'T', height: 50, type: 'hatched' },
      { day: 'W', height: 50, type: 'hatched' },
      { day: 'T', height: 50, type: 'hatched' },
      { day: 'F', height: 50, type: 'hatched' },
      { day: 'S', height: 50, type: 'hatched' },
    ],
    reminderTitle: 'Executive Governance Review',
    reminderSubtitle: 'Executive Command Desk',
    reminderTime: 'All review queues clear',
    reminderButton: 'Open Approvals Desk',
    projectsTitle: 'Active Capital Commitments',
    projects: [
      { title: 'No active expenditure requests', date: 'Requisitions will appear here as submitted', glyph: 'endpoints' },
    ],
    teamTitle: 'Executive C-Suite & Approvers',
    teamMembers: [
      { name: 'No staff profiles registered yet', avatarEmoji: '👥', avatarBg: '#f1f5f9', task: 'Add staff profiles to populate executive team', status: 'Pending', statusColor: '#f8fafc', textColor: '#64748b', borderColor: '#e2e8f0' },
    ],
    arcTitle: 'Accountability Clearance Rate',
    arcPercent: 100,
    arcSubtitle: 'All records clear',
    timerTitle: 'GMD Review SLA Clock',
    timerSubtitle: 'All requests within SLA',
    timerValue: '00:00:00',
    retentionTitle: 'Budget Retention',
    retentionPeak: '0%',
    transactionsTitle: 'Transactions',
    transactionsAmount: '0',
    transactionsDelta: '0',
    transactionsPeak: '—',
    insightValue: '100%',
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
      timeTrackerBg: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
      topographicStroke: '#fb923c',
      funnelGradient: 'linear-gradient(180deg, #f97316 0%, #ea580c 100%)',
      funnelHatch: 'repeating-linear-gradient(45deg, #ea580c, #ea580c 4px, #fdba74 4px, #fdba74 8px)',
      arcStroke: '#ea580c',
    },
    bentoPills: [
      { label: 'Total Operations Requests', value: '0', delta: '0 operations requests recorded', isPrimary: true, link: '/requests' },
      { label: 'Delivered & Waybill Verified', value: '0', delta: '0 delivery records', link: '/accountability' },
      { label: 'In Transit & Execution', value: '0', delta: '0 in progress', link: '/disbursements' },
      { label: 'Vendor Price Reviews', value: '0', delta: 'All quotes clear', link: '/approvals' },
    ],
    funnelTitle: 'Procurement & Logistics Execution Pipeline',
    funnelSubtitle: 'From vendor quote to 3-way matched supplier payment',
    funnelStages: [
      { label: 'PO Submitted', value: '0', amount: '₦0', height: 175, drop: '0%' },
      { label: 'Price Benchmarked', value: '0', amount: '₦0', height: 145, drop: '0%' },
      { label: 'Goods Received (GRN)', value: '0', amount: '₦0', height: 115, drop: '0%' },
      { label: '3-Way Matched', value: '0', amount: '₦0', height: 85, drop: '0%' },
      { label: 'Supplier Disbursed', value: '0', amount: '₦0', height: 65, drop: 'Settled' },
    ],
    funnelExplorePrompt: 'Operations progression',
    funnelTagText: '/operations-pipeline',
    volumeTitle: 'Operations Procurement Spend',
    volumeAmount: '₦0',
    volumeRows: [
      { label: 'No procurement spend recorded yet', percent: 100, color: '#cbd5e1', hatchGradient: 'repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 3px, #e2e8f0 3px, #e2e8f0 6px)' },
    ],
    analyticsTitle: 'Daily Fleet & Logistics Waybills',
    capsuleDays: [
      { day: 'S', height: 50, type: 'hatched' },
      { day: 'M', height: 50, type: 'hatched' },
      { day: 'T', height: 50, type: 'hatched' },
      { day: 'W', height: 50, type: 'hatched' },
      { day: 'T', height: 50, type: 'hatched' },
      { day: 'F', height: 50, type: 'hatched' },
      { day: 'S', height: 50, type: 'hatched' },
    ],
    reminderTitle: 'Vendor Performance Review',
    reminderSubtitle: 'Procurement & Operations',
    reminderTime: 'All review queues clear',
    reminderButton: 'Open Operations Desk',
    projectsTitle: 'Operational Execution Desk',
    projects: [
      { title: 'No active procurement orders', date: 'POs will appear here as recorded', glyph: 'endpoints' },
    ],
    teamTitle: 'Operations & Logistics Team',
    teamMembers: [
      { name: 'No staff profiles registered yet', avatarEmoji: '👥', avatarBg: '#f1f5f9', task: 'Add team members in Staff Profiles', status: 'Pending', statusColor: '#f8fafc', textColor: '#64748b', borderColor: '#e2e8f0' },
    ],
    arcTitle: '3-Way Match Verification Rate',
    arcPercent: 100,
    arcSubtitle: 'Invoices Cleared',
    timerTitle: 'Expedited Dispatch SLA Clock',
    timerSubtitle: 'All orders on schedule',
    timerValue: '00:00:00',
    retentionTitle: 'Inventory Turnover',
    retentionPeak: '0%',
    transactionsTitle: 'Waybill Volume',
    transactionsAmount: '0',
    transactionsDelta: '0',
    transactionsPeak: '—',
    insightValue: '100%',
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
      { label: 'Total Active Staff', value: '0', delta: '0 registered employees', isPrimary: true, link: '/payroll' },
      { label: 'Payroll Cleared (No Tax)', value: '0', delta: '0 batches active', link: '/payroll' },
      { label: 'Dual-Entity 70/30 Splits', value: '0', delta: '0 split allocations', link: '/intercompany' },
      { label: 'Pending Welfare Claims', value: '0', delta: '0 pending claims', link: '/requests' },
    ],
    funnelTitle: 'Monthly Payroll Run Pipeline (No Tax)',
    funnelSubtitle: 'Zero-tax statutory formula: clean gross = net across entities',
    funnelStages: [
      { label: 'Timesheets Logged', value: '0', amount: '₦0', height: 175, drop: '0%' },
      { label: '70/30 Splits Applied', value: '0', amount: '₦0', height: 145, drop: '0%' },
      { label: 'HR Lead Cleared', value: '0', amount: '₦0', height: 115, drop: '0%' },
      { label: 'COO Authorized', value: '0', amount: '₦0', height: 85, drop: '0%' },
      { label: 'Disbursed to Staff', value: '0', amount: '₦0', height: 65, drop: 'Paid' },
    ],
    funnelExplorePrompt: 'Payroll pipeline status',
    funnelTagText: '/payroll-pipeline',
    volumeTitle: 'Monthly Payroll Volume',
    volumeAmount: '₦0',
    volumeRows: [
      { label: 'No payroll batches computed yet', percent: 100, color: '#cbd5e1', hatchGradient: 'repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 3px, #e2e8f0 3px, #e2e8f0 6px)' },
    ],
    analyticsTitle: 'Daily Staff Advances & Welfare Claims',
    capsuleDays: [
      { day: 'S', height: 50, type: 'hatched' },
      { day: 'M', height: 50, type: 'hatched' },
      { day: 'T', height: 50, type: 'hatched' },
      { day: 'W', height: 50, type: 'hatched' },
      { day: 'T', height: 50, type: 'hatched' },
      { day: 'F', height: 50, type: 'hatched' },
      { day: 'S', height: 50, type: 'hatched' },
    ],
    reminderTitle: 'Monthly Payroll Sign-Off',
    reminderSubtitle: 'People & Compensation',
    reminderTime: 'All payroll queues clear',
    reminderButton: 'Open Payroll Module',
    projectsTitle: 'People & Payroll Operations',
    projects: [
      { title: 'No active payroll operations', date: 'Batches will appear here once initiated', glyph: 'dashboard' },
    ],
    teamTitle: 'People & Compensation Team',
    teamMembers: [
      { name: 'No staff profiles registered yet', avatarEmoji: '👥', avatarBg: '#f1f5f9', task: 'Add employees in Staff Profiles', status: 'Pending', statusColor: '#f8fafc', textColor: '#64748b', borderColor: '#e2e8f0' },
    ],
    arcTitle: 'Payroll Verification Score',
    arcPercent: 100,
    arcSubtitle: 'All Batches Cleared',
    timerTitle: 'Payroll Batch Cut-off Clock',
    timerSubtitle: 'No pending batches',
    timerValue: '00:00:00',
    retentionTitle: 'Staff Retention',
    retentionPeak: '0%',
    transactionsTitle: 'Salary Outflow',
    transactionsAmount: '0 Staff',
    transactionsDelta: '0 Hires',
    transactionsPeak: '—',
    insightValue: '100%',
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
      { label: 'Requests Under Audit', value: '0', delta: '0 pending audits', isPrimary: true, link: '/audit' },
      { label: 'Clearance Stamped', value: '0', delta: '0 validated', link: '/accountability' },
      { label: 'Proof Receipts in Review', value: '0', delta: '0 in review', link: '/accountability' },
      { label: 'Flagged Anomalies', value: '0', delta: 'No anomalies flagged', link: '/approvals' },
    ],
    funnelTitle: 'Expenditure Proof & Clearance Funnel',
    funnelSubtitle: '5-stage rigorous gate from advance payment to verified closure',
    funnelStages: [
      { label: 'Advances Disbursed', value: '0', amount: '₦0', height: 175, drop: '0%' },
      { label: 'Invoices Uploaded', value: '0', amount: '₦0', height: 145, drop: '0%' },
      { label: 'Waybills Inspected', value: '0', amount: '₦0', height: 115, drop: '0%' },
      { label: 'Delivery Confirmed', value: '0', amount: '₦0', height: 85, drop: '0%' },
      { label: 'Clearance Stamped', value: '0', amount: '₦0', height: 65, drop: 'Cleared' },
    ],
    funnelExplorePrompt: 'Audit progression',
    funnelTagText: '/audit-pipeline',
    volumeTitle: 'Funds Under Accountability Audit',
    volumeAmount: '₦0',
    volumeRows: [
      { label: 'No funds under audit yet', percent: 100, color: '#cbd5e1', hatchGradient: 'repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 3px, #e2e8f0 3px, #e2e8f0 6px)' },
    ],
    analyticsTitle: 'Daily Receipts & Retirals Audited',
    capsuleDays: [
      { day: 'S', height: 50, type: 'hatched' },
      { day: 'M', height: 50, type: 'hatched' },
      { day: 'T', height: 50, type: 'hatched' },
      { day: 'W', height: 50, type: 'hatched' },
      { day: 'T', height: 50, type: 'hatched' },
      { day: 'F', height: 50, type: 'hatched' },
      { day: 'S', height: 50, type: 'hatched' },
    ],
    reminderTitle: 'Audit Retiral Clearance Session',
    reminderSubtitle: 'Compliance & Verification Desk',
    reminderTime: 'All audit queues clear',
    reminderButton: 'Open Audit Desk',
    projectsTitle: 'Accountability Retirals Pending',
    projects: [
      { title: 'No pending accountability retirals', date: 'Clearance tasks will appear here', glyph: 'endpoints' },
    ],
    teamTitle: 'Audit Desk & Compliance Officers',
    teamMembers: [
      { name: 'No staff profiles registered yet', avatarEmoji: '👥', avatarBg: '#f1f5f9', task: 'Add audit staff in Staff Profiles', status: 'Pending', statusColor: '#f8fafc', textColor: '#64748b', borderColor: '#e2e8f0' },
    ],
    arcTitle: '14-Day Accountability Compliance',
    arcPercent: 100,
    arcSubtitle: 'All Retirals Cleared',
    timerTitle: 'Advance Retiral Grace Clock',
    timerSubtitle: 'No active timers',
    timerValue: '00:00:00',
    retentionTitle: 'Compliance Integrity',
    retentionPeak: '0%',
    transactionsTitle: 'Audit Checks',
    transactionsAmount: '0 Docs',
    transactionsDelta: '0 Checked',
    transactionsPeak: '—',
    insightValue: '100%',
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
      { label: 'My Total Requests', value: '0', delta: '0 requests submitted', isPrimary: true, link: '/requests' },
      { label: 'Disbursed & Paid Out', value: '0', delta: '0 disbursements received', link: '/disbursements' },
      { label: 'In Approval Chain', value: '0', delta: '0 pending approval', link: '/approvals' },
      { label: 'Receipts Due for Upload', value: '0', delta: 'All proof uploaded', link: '/accountability' },
    ],
    funnelTitle: 'My Requisition Lifecycle Funnel',
    funnelSubtitle: 'Track your personal fund request from submission to closure',
    funnelStages: [
      { label: 'Drafted', value: '0', amount: '₦0', height: 175, drop: '0%' },
      { label: 'HOD Endorsed', value: '0', amount: '₦0', height: 145, drop: '0%' },
      { label: 'COO Approved', value: '0', amount: '₦0', height: 115, drop: '0%' },
      { label: 'Bank Disbursed', value: '0', amount: '₦0', height: 85, drop: '0%' },
      { label: 'Receipt Closed', value: '0', amount: '₦0', height: 65, drop: 'Cleared' },
    ],
    funnelExplorePrompt: 'Personal requisitions pipeline',
    funnelTagText: '/my-requests',
    volumeTitle: 'My Personal Requisitions Volume',
    volumeAmount: '₦0',
    volumeRows: [
      { label: 'No personal requisitions submitted yet', percent: 100, color: '#cbd5e1', hatchGradient: 'repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 3px, #e2e8f0 3px, #e2e8f0 6px)' },
    ],
    analyticsTitle: 'My Weekly Expense Submissions',
    capsuleDays: [
      { day: 'S', height: 50, type: 'hatched' },
      { day: 'M', height: 50, type: 'hatched' },
      { day: 'T', height: 50, type: 'hatched' },
      { day: 'W', height: 50, type: 'hatched' },
      { day: 'T', height: 50, type: 'hatched' },
      { day: 'F', height: 50, type: 'hatched' },
      { day: 'S', height: 50, type: 'hatched' },
    ],
    reminderTitle: 'Receipt Upload Reminder',
    reminderSubtitle: 'Personal Accountability',
    reminderTime: 'All receipts accounted',
    reminderButton: 'Submit Fund Request ＋',
    projectsTitle: 'My Requests & Requisitions',
    projects: [
      { title: 'No personal fund requests', date: 'Click New Fund Request to submit', glyph: 'endpoints' },
    ],
    teamTitle: 'My Approval Chain',
    teamMembers: [
      { name: 'No staff profiles registered yet', avatarEmoji: '👥', avatarBg: '#f1f5f9', task: 'Approvers will appear when assigned', status: 'Pending', statusColor: '#f8fafc', textColor: '#64748b', borderColor: '#e2e8f0' },
    ],
    arcTitle: 'My Receipt Accountability Compliance',
    arcPercent: 100,
    arcSubtitle: 'All receipts accounted',
    timerTitle: 'SLA Clock',
    timerSubtitle: 'No active deadlines',
    timerValue: '00:00:00',
    retentionTitle: 'My Spending Budget',
    retentionPeak: '0%',
    transactionsTitle: 'My Submissions',
    transactionsAmount: '0',
    transactionsDelta: '0 Requests',
    transactionsPeak: '—',
    insightValue: '100%',
    insightLabel: 'Clearance Score',
  },
};
