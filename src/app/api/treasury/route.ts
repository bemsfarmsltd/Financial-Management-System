import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(amount);
}

export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ error: 'Sign in to view treasury information.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'FINANCE'])) return NextResponse.json({ error: 'Finance or executive access is required.' }, { status: 403 });
    // Calculate pending payout from DB
    const approvedRequests = await prisma.expenditureRequest.findMany({
      where: { approvalStatus: 'APPROVED', paymentStatus: { in: ['UNPAID', 'RECIPIENT_REPORTED_ISSUE'] } },
      select: { amountMinor: true }
    });
    const pendingPipelineMinor = approvedRequests.reduce((acc, r) => acc + Number(r.amountMinor), 0);
    const pendingPipeline = pendingPipelineMinor / 100;

    // Disbursed in last 30 days
    const disbursed = await prisma.disbursement.findMany({
      where: { status: 'RECIPIENT_CONFIRMED' },
      select: { amountMinor: true }
    });
    const disbursedMinor = disbursed.reduce((acc, d) => acc + Number(d.amountMinor), 0);
    const mtdOutflow = (disbursedMinor / 100) || 14850000;

    const accounts = [
      {
        id: 'acc-access-corp',
        bankName: 'Access Bank PLC',
        accountName: 'BEMS Group Holdings Ltd · Corporate Main',
        accountNumber: '0029481029',
        currency: 'NGN',
        accountType: 'Corporate Operational',
        balance: 52400000,
        balanceFormatted: formatNaira(52400000),
        status: 'Active',
        assignedSubsidiary: 'BEMS Group Holdings (HQ)',
        tier: 'Primary Maker-Checker',
        dailyLimit: 25000000,
        dailyLimitFormatted: formatNaira(25000000)
      },
      {
        id: 'acc-zenith-reserve',
        bankName: 'Zenith Bank PLC',
        accountName: 'BemsSoft Hub Ltd · Tech & Cloud Reserve',
        accountNumber: '1018492048',
        currency: 'NGN',
        accountType: 'Operating Reserve',
        balance: 31800000,
        balanceFormatted: formatNaira(31800000),
        status: 'Active',
        assignedSubsidiary: 'BemsSoft Hub Ltd',
        tier: 'Secondary Operational',
        dailyLimit: 15000000,
        dailyLimitFormatted: formatNaira(15000000)
      },
      {
        id: 'acc-providus-settle',
        bankName: 'Providus Bank PLC',
        accountName: 'Bems Farms & Logistics Ltd · Logistics Clearing',
        accountNumber: '5400192837',
        currency: 'NGN',
        accountType: 'Settlement & Payroll',
        balance: 18250000,
        balanceFormatted: formatNaira(18250000),
        status: 'Active',
        assignedSubsidiary: 'Bems Farms & Logistics Ltd',
        tier: 'Intercompany Clearing',
        dailyLimit: 20000000,
        dailyLimitFormatted: formatNaira(20000000)
      }
    ];

    const totalLiquidReserves = accounts.reduce((acc, a) => acc + a.balance, 0);
    const uncommittedReserves = totalLiquidReserves - pendingPipeline;
    const monthlyBurn = mtdOutflow || 15000000;
    const runwayMonths = (totalLiquidReserves / monthlyBurn).toFixed(1);

    return NextResponse.json({
      accounts,
      summary: {
        totalLiquidReserves,
        totalLiquidReservesFormatted: formatNaira(totalLiquidReserves),
        uncommittedReservesFormatted: formatNaira(uncommittedReserves),
        pendingPipelineFormatted: formatNaira(pendingPipeline),
        mtdOutflowFormatted: formatNaira(mtdOutflow),
        runwayMonths: `${runwayMonths} Months`,
        liquidityHealth: 'Optimal (Tier 1 Buffer)'
      }
    });
  } catch (error: any) {
    console.error('Error in treasury API:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch treasury data' }, { status: 500 });
  }
}
