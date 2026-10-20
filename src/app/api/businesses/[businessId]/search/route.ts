import { NextResponse } from 'next/server';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').toLowerCase().trim();

  if (!q) return NextResponse.json([]);

  const defaultResults = [
    { type: 'Desk', label: 'Fund Requests Register', sublabel: 'View all submitted requisitions', navigate: 'Fund requests' },
    { type: 'Finance', label: 'Treasury Accounts', sublabel: 'Operating & disbursement balances', navigate: 'Treasury accounts' },
    { type: 'Payroll', label: 'Hybrid Payroll', sublabel: 'Monthly staff salary batches', navigate: 'Hybrid payroll' },
    { type: 'HR', label: 'Staff Profiles', sublabel: 'Registered employee directory', navigate: 'Staff profiles' },
    { type: 'HR', label: 'Staff Onboarding', sublabel: 'Self-registration review & approvals', navigate: 'Staff onboarding' },
    { type: 'Governance', label: 'Audit Logs', sublabel: 'Append-only regulatory event trail', navigate: 'Audit logs' }
  ];

  const matched = defaultResults.filter(r => 
    r.label.toLowerCase().includes(q) || 
    r.sublabel.toLowerCase().includes(q) || 
    r.type.toLowerCase().includes(q)
  );

  return NextResponse.json(matched);
}
