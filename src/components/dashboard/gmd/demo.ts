export type Approval = 'Pending' | 'Approved' | 'Clarification' | 'Rejected';
export type GmdView = 'overview' | 'approvals' | 'requests' | 'payments' | 'accountability' | 'payroll' | 'portfolio' | 'briefing' | 'audit' | 'matrix' | 'emergency' | 'treasury';
export type Obligation = {
  id: string; title: string; company: string; owner: string; category: string;
  amount: number; date: string; due: string; approval: Approval;
  payment: 'Unpaid' | 'Recorded' | 'Verified'; closed: boolean;
  kind: 'Expense' | 'Advance' | 'Payroll'; urgent: boolean;
  purpose: string; deliverable: string; evidence: string[];
  history: { text: string; at: string }[];
};
export const AS_OF = '2026-10-15';
export const COMPANIES = ['BemsSoft Hub Ltd', 'Bems Logistics & Distribution Ltd', 'BEMS Group Holdings Ltd'];
export const BUDGETS: Record<string, number> = {
  'BemsSoft Hub Ltd': 1200000000,
  'Bems Logistics & Distribution Ltd': 1800000000,
  'BEMS Group Holdings Ltd': 1000000000,
};
const rows: [string, string, number, string, number, string, string, Approval, Obligation['payment'], boolean, Obligation['kind'], boolean, string, string][] = [
  ['REQ-2026-0001', 'Cloud infrastructure annual renewal', 0, 'Temitope Bakare', 450000, '2026-10-12', '2026-10-16', 'Pending', 'Unpaid', false, 'Expense', true, 'Keep production hosting and business applications available for the next twelve months.', 'Renewed hosting licence and supplier invoice'],
  ['REQ-2026-0002', 'Bulk diesel supply · 4,000 litres', 1, 'Edwin Adenike', 2800000, '2026-10-10', '2026-10-17', 'Pending', 'Unpaid', false, 'Expense', true, 'Replenish fleet and cold-storage fuel for scheduled deliveries.', 'Signed delivery waybill and stock receipt'],
  ['REQ-2026-0003', 'Field operations project advance', 1, 'Amaka Okafor', 1200000, '2026-10-03', '2026-10-12', 'Approved', 'Verified', false, 'Advance', false, 'Mobilisation and field expenses for the October distribution programme.', 'Itemised retirement, receipts and return of unused funds'],
  ['REQ-2026-0004', 'Engineering workstation procurement', 0, 'Temitope Bakare', 3200000, '2026-10-06', '2026-10-20', 'Approved', 'Recorded', false, 'Expense', false, 'Supply four workstations for the engineering team.', 'Supplier invoice, asset tags and signed goods receipt'],
  ['REQ-2026-0005', 'Warehouse equipment servicing', 1, 'Edwin Adenike', 1850000, '2026-10-02', '2026-10-10', 'Approved', 'Verified', true, 'Expense', false, 'Scheduled preventive maintenance of warehouse handling equipment.', 'Service completion report signed by the operations lead'],
  ['REQ-2026-0006', 'Head office lease renewal', 2, 'Babatunde Adeleke', 4000000, '2026-10-07', '2026-10-25', 'Approved', 'Unpaid', false, 'Expense', false, 'Renew the head office lease for the approved rental period.', 'Executed renewal and landlord acknowledgement'],
  ['REQ-2026-0007', 'Group compliance review', 2, 'Chinedu Obi', 650000, '2026-10-08', '2026-10-23', 'Clarification', 'Unpaid', false, 'Expense', false, 'Commission a review of operational controls across the group.', 'Agreed scope, review report and management action list'],
  ['REQ-2026-0008', 'Customer onboarding workshop', 0, 'Adaobi Okeke', 300000, '2026-10-01', '2026-10-08', 'Approved', 'Verified', true, 'Expense', false, 'Deliver product onboarding sessions for the customer support team.', 'Attendance register and workshop report'],
  ['PAY-2026-0010', 'October engineering payroll', 0, 'David Oshodi', 4200000, '2026-10-14', '2026-10-28', 'Pending', 'Unpaid', false, 'Payroll', false, 'Monthly salary batch prepared by HR for 12 employees. Demo salary amounts only.', 'Approved payroll register and individually verified salary payments'],
  ['PAY-2026-0011', 'October operations payroll', 1, 'David Oshodi', 3100000, '2026-10-14', '2026-10-28', 'Pending', 'Unpaid', false, 'Payroll', false, 'Monthly salary batch prepared by HR for 18 employees. Demo salary amounts only.', 'Approved payroll register and individually verified salary payments'],
  ['REQ-2026-0009', 'Fleet tyre replacements', 1, 'Edwin Adenike', 900000, '2026-09-18', '2026-09-25', 'Approved', 'Verified', true, 'Expense', false, 'Replace worn tyres on the distribution fleet.', 'Installation report and supplier receipt'],
  ['REQ-2026-0010', 'Security software renewal', 0, 'Temitope Bakare', 600000, '2026-09-21', '2026-09-29', 'Approved', 'Verified', true, 'Expense', false, 'Renew annual endpoint protection licences.', 'Licence activation confirmation'],
];
export const SEED: Obligation[] = rows.map(([id,title,company,owner,naira,date,due,approval,payment,closed,kind,urgent,purpose,deliverable]) => ({
  id,title,company:COMPANIES[company],owner,amount:naira*100,date,due,approval,payment,closed,kind,urgent,purpose,deliverable,
  category: kind === 'Payroll' ? 'People & payroll' : company === 0 ? 'Technology' : company === 1 ? 'Operations' : 'Administration',
  evidence: closed ? ['Supplier document', 'Completion report'] : payment === 'Recorded' || payment === 'Verified' ? ['Transfer receipt (demo)'] : ['Cost proposal (demo)'],
  history: [{text:`${owner} submitted this ${kind.toLowerCase()}.`,at:`${date}T09:00:00`}, ...(approval === 'Approved' ? [{text:'Approval completed. Finance may record an external transfer.',at:`${date}T12:00:00`}] : []), ...(payment !== 'Unpaid' ? [{text:`Payment ${payment.toLowerCase()} by Finance.`,at:`${date}T14:00:00`}] : [])],
}));
export const money = (minor: number, compact = false) => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency: 'NGN', maximumFractionDigits: compact ? 2 : 0,
  ...(compact ? { notation: 'compact' as const } : {}),
}).format(minor / 100);
export const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
export const sum = (rows: Obligation[]) => rows.reduce((total,row) => total + row.amount,0);
export const isOverdue = (row: Obligation) => row.payment === 'Verified' && !row.closed && row.due < AS_OF;
export function metrics(rows: Obligation[]) {
  return {
    pending: rows.filter(r => r.approval === 'Pending'),
    paid: rows.filter(r => r.payment === 'Verified'),
    open: rows.filter(r => r.payment === 'Verified' && !r.closed),
    committed: rows.filter(r => r.approval === 'Approved' && r.payment !== 'Verified'),
    closed: rows.filter(r => r.closed),
  };
}
export const VIEW_LABELS: Record<GmdView, string> = {
  overview:'Overview', approvals:'Approvals desk', requests:'Fund requests', payments:'Disbursements desk',
  accountability:'Accountability closure', payroll:'Payroll sign-off', portfolio:'Subsidiary portfolio', briefing:'Executive briefing', audit:'Audit logs', matrix:'Approval matrix', emergency:'Emergency overrides', treasury:'Treasury accounts',
};
// Versioned frontend demo only. Decisions never call financial APIs.
export const STORAGE_KEY = 'bems.gmd.demo.v1';
export function validRows(value: unknown): value is Obligation[] {
  return Array.isArray(value) && value.every(r => r && typeof r.id === 'string' && typeof r.title === 'string' &&
    typeof r.company === 'string' && typeof r.owner === 'string' && typeof r.purpose === 'string' &&
    typeof r.deliverable === 'string' && typeof r.category === 'string' && typeof r.date === 'string' &&
    typeof r.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && /^\d{4}-\d{2}-\d{2}$/.test(r.due) &&
    Number.isSafeInteger(r.amount) && r.amount > 0 && ['Pending','Approved','Clarification','Rejected'].includes(r.approval) &&
    ['Unpaid','Recorded','Verified'].includes(r.payment) && ['Expense','Advance','Payroll'].includes(r.kind) &&
    typeof r.closed === 'boolean' && typeof r.urgent === 'boolean' && Array.isArray(r.evidence) && r.evidence.every((e: unknown) => typeof e === 'string') &&
    Array.isArray(r.history) && r.history.every((h: {text?: unknown;at?: unknown}) => h && typeof h.text === 'string' && typeof h.at === 'string'));
}
