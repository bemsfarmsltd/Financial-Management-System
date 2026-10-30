import { NextResponse } from 'next/server';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  const channels = [
    {
      name: 'WhatsApp Bot Bridge',
      icon: '💬',
      description: 'Instant notification & emergency requisitions via WhatsApp',
      status: 'Live',
      address: '+234 800 BEMS BOT',
      workflow: 'High-priority notifications',
      color: '#25D366'
    },
    {
      name: 'Slack Executive Channel',
      icon: '⌗',
      description: 'Real-time alert dispatch to #executive-finance and #gmd-desk',
      status: 'Live',
      address: '#finance-disbursements',
      workflow: 'Executive disbursement approvals',
      color: '#4A154B'
    },
    {
      name: 'Corporate Email Dispatch',
      icon: '✉',
      description: 'Formal audit trails, debit/credit notes, and settlement notices',
      status: 'Live',
      address: 'finance@bemsgroup.com',
      workflow: 'Official PDF vouchers & statements',
      color: '#EA4335'
    }
  ];

  return NextResponse.json(channels);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ ...body, status: body.status || 'Live' });
}
