import { walletHttp } from '@/lib/wallet/http';
import { requireWallet, WalletError } from '@/lib/wallet/core';
import { verifyMonnifyDestination } from '@/lib/wallet/provider';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  return walletHttp(request, async (actor) => {
    requireWallet();
    const url = new URL(request.url);
    const accountNumber = url.searchParams.get('accountNumber')?.trim();
    const bankCode = url.searchParams.get('bankCode')?.trim();

    if (!accountNumber || !/^\d{10}$/.test(accountNumber)) {
      throw new WalletError('INVALID_ACCOUNT', 'Enter a valid 10-digit NUBAN account number.', 400);
    }
    if (!bankCode) {
      throw new WalletError('INVALID_BANK', 'Select a destination bank.', 400);
    }

    try {
      const verified = await verifyMonnifyDestination(accountNumber, bankCode);
      return {
        success: true,
        accountNumber: verified.accountNumber,
        bankCode: verified.bankCode,
        accountName: verified.accountName,
        verifiedVia: 'MONNIFY_API',
      };
    } catch (monnifyError: any) {
      // Fallback verification against staff registered account if external provider is unreachable or in test mode
      const emp = await prisma.employee.findUnique({
        where: { id: actor.id },
        select: {
          accountNumber: true,
          salaryAccountNumber: true,
          legalName: true,
          accountName: true,
          salaryAccountName: true,
        },
      });
      if (emp && (emp.accountNumber === accountNumber || emp.salaryAccountNumber === accountNumber)) {
        return {
          success: true,
          accountNumber,
          bankCode,
          accountName: emp.salaryAccountName || emp.accountName || emp.legalName,
          verifiedVia: 'STAFF_REGISTRATION_MATCH',
        };
      }
      throw monnifyError;
    }
  });
}

