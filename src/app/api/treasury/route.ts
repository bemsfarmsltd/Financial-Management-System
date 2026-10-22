import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

const DATA_FILE = path.join(process.cwd(), 'src', 'data', 'company-bank-accounts.json');

function readSavedAccounts(): any[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(content) || [];
    }
  } catch (e) {
    console.error('Error reading bank accounts file:', e);
  }
  return [];
}

function writeSavedAccounts(accounts: any[]) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(accounts, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing bank accounts file:', e);
  }
}

function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(amount);
}

export async function GET(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to view treasury information.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'FINANCE', 'COO', 'DIRECTOR', 'HEAD_OF_ADMIN', 'AI_ANALYST', 'FINANCE_CONTROLLER', 'HR'])) {
      return NextResponse.json({ error: 'Executive or finance access is required.' }, { status: 403 });
    }

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
    const mtdOutflow = disbursedMinor / 100;

    const rawAccounts = readSavedAccounts();
    const accounts = rawAccounts.map((a) => ({
      ...a,
      balanceFormatted: formatNaira(Number(a.balance) || 0),
      dailyLimitFormatted: formatNaira(Number(a.dailyLimit) || 25000000),
    }));

    const totalLiquidReserves = accounts.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);
    const uncommittedReserves = Math.max(0, totalLiquidReserves - pendingPipeline);
    const runwayMonths = totalLiquidReserves > 0 && mtdOutflow > 0 ? (totalLiquidReserves / mtdOutflow).toFixed(1) : '0.0';

    return NextResponse.json({
      accounts,
      summary: {
        totalLiquidReserves,
        totalLiquidReservesFormatted: formatNaira(totalLiquidReserves),
        uncommittedReservesFormatted: formatNaira(uncommittedReserves),
        pendingPipelineFormatted: formatNaira(pendingPipeline),
        mtdOutflowFormatted: formatNaira(mtdOutflow),
        runwayMonths: `${runwayMonths} Months`,
        liquidityHealth: accounts.length === 0 ? 'Awaiting Account Setup' : 'Active Registry'
      }
    });
  } catch (error: any) {
    console.error('Error in treasury API:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch treasury data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to configure treasury accounts.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'FINANCE', 'COO', 'FINANCE_CONTROLLER'])) {
      return NextResponse.json({ error: 'Only GMD, System Admin, or Finance can add company bank accounts.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      bankName,
      accountName,
      accountNumber,
      accountType,
      currency,
      balance,
      dailyLimit,
      assignedSubsidiary
    } = body;

    if (!bankName || !bankName.trim()) {
      return NextResponse.json({ error: 'Bank name is required.' }, { status: 400 });
    }
    if (!accountName || !accountName.trim()) {
      return NextResponse.json({ error: 'Account title / name is required.' }, { status: 400 });
    }
    if (!accountNumber || !accountNumber.trim()) {
      return NextResponse.json({ error: '10-digit NUBAN account number is required.' }, { status: 400 });
    }

    const accounts = readSavedAccounts();
    const newId = `acc-${Date.now()}`;
    const newAccount = {
      id: newId,
      bankName: bankName.trim(),
      accountName: accountName.trim(),
      accountNumber: accountNumber.trim(),
      accountType: accountType || 'Corporate Operational',
      currency: currency || 'NGN',
      balance: Number(balance) || 0,
      dailyLimit: Number(dailyLimit) || 25000000,
      assignedSubsidiary: assignedSubsidiary || 'BEMS Group',
      tier: 'Primary Maker-Checker',
      status: 'Active',
      createdAt: new Date().toISOString()
    };

    accounts.push(newAccount);
    writeSavedAccounts(accounts);

    return NextResponse.json({
      message: 'Bank account added successfully.',
      account: {
        ...newAccount,
        balanceFormatted: formatNaira(newAccount.balance),
        dailyLimitFormatted: formatNaira(newAccount.dailyLimit)
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating bank account:', error);
    return NextResponse.json({ error: error.message || 'Failed to save bank account' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await getAuthenticatedEmployee(req);
    if (!actor) return NextResponse.json({ error: 'Sign in to configure treasury accounts.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD', 'COO'])) {
      return NextResponse.json({ error: 'Only GMD or System Admin can delete bank accounts.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Account ID is required.' }, { status: 400 });

    const accounts = readSavedAccounts();
    const filtered = accounts.filter(a => a.id !== id);
    writeSavedAccounts(filtered);

    return NextResponse.json({ message: 'Bank account removed successfully.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to remove bank account' }, { status: 500 });
  }
}
