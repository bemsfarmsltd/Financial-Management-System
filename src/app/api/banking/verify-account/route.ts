import { NextResponse } from 'next/server';
import { validateMonnifyBankAccount, STANDARD_NIGERIAN_BANKS } from '@/lib/monnify';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawAccount = body.accountNumber || body.account_number || body.account;
    const rawBankCode = body.bankCode || body.bank_code || body.code;
    const rawBankName = body.bankName || body.bank_name || body.bank;

    const cleanAcct = String(rawAccount || '').trim().replace(/\D/g, '');
    if (!cleanAcct || cleanAcct.length !== 10) {
      return NextResponse.json(
        {
          isValid: false,
          status: 'error',
          message: 'Valid 10-digit Nigerian NUBAN account number is required',
        },
        { status: 400 }
      );
    }

    if (!rawBankCode && !rawBankName) {
      return NextResponse.json(
        {
          isValid: false,
          status: 'error',
          message: 'Bank selection or bank code is required for verification',
        },
        { status: 400 }
      );
    }

    const bankIdentifier = rawBankCode || rawBankName;
    const result = await validateMonnifyBankAccount(cleanAcct, bankIdentifier);

    // Resolve matched bank display name if possible
    const matchedBank = STANDARD_NIGERIAN_BANKS.find(
      (b) => b.code === result.bankCode || b.name.toLowerCase() === String(rawBankName).toLowerCase()
    );

    return NextResponse.json({
      isValid: true,
      status: 'success',
      accountNumber: result.accountNumber,
      accountName: result.accountName,
      bankCode: result.bankCode,
      bankName: matchedBank ? matchedBank.name : rawBankName,
      message: `Account resolved: ${result.accountName}`,
    });
  } catch (error: any) {
    console.error('Monnify account verification error:', error.message);
    return NextResponse.json(
      {
        isValid: false,
        status: 'error',
        message: error.message || 'Unable to verify account details. Please check the account number and bank.',
      },
      { status: 422 }
    );
  }
}
