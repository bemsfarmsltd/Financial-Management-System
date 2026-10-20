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
};

// GMD and SYSTEM_ADMIN share the exact same executive command dashboard
roleDashboardConfigs.SYSTEM_ADMIN = roleDashboardConfigs.GMD;
