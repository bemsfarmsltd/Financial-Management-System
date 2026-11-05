/**
 * Nigerian Banking & Quick-Disburse Utilities
 * Generates USSD dial strings, app deep link schemes, and quick payment intents.
 */

export interface NigerianBankInfo {
  name: string;
  code: string;
  ussdPrefix?: string; // e.g. *737*
  ussdPattern?: (amount: number, account: string) => string;
  appScheme?: string;
  webUrl?: string;
}

export const NIGERIAN_BANKS: Record<string, NigerianBankInfo> = {
  'GTBANK': {
    name: 'Guaranty Trust Bank (GTBank)',
    code: '058',
    ussdPrefix: '*737*',
    ussdPattern: (amt, acc) => `*737*2*${amt}*${acc}#`,
    appScheme: 'gtworld://',
    webUrl: 'https://ibank.gtbank.com/',
  },
  'ZENITH': {
    name: 'Zenith Bank',
    code: '057',
    ussdPrefix: '*966*',
    ussdPattern: (amt, acc) => `*966*${amt}*${acc}#`,
    appScheme: 'zenithbank://',
    webUrl: 'https://www.zenithbank.com/',
  },
  'ACCESS': {
    name: 'Access Bank',
    code: '044',
    ussdPrefix: '*901*',
    ussdPattern: (amt, acc) => `*901*${amt}*${acc}#`,
    appScheme: 'accessmore://',
    webUrl: 'https://www.accessbankplc.com/',
  },
  'KUDA': {
    name: 'Kuda Microfinance Bank',
    code: '50211',
    appScheme: 'kuda://',
    webUrl: 'https://app.kuda.com/',
  },
  'OPAY': {
    name: 'OPay',
    code: '999992',
    appScheme: 'opay://',
    webUrl: 'https://www.opayweb.com/',
  },
  'MONIEPOINT': {
    name: 'Moniepoint Microfinance Bank',
    code: '50515',
    appScheme: 'moniepoint://',
    webUrl: 'https://app.moniepoint.com/',
  },
  'PALMPAY': {
    name: 'PalmPay',
    code: '999991',
    appScheme: 'palmpay://',
    webUrl: 'https://www.palmpay.com/',
  },
  'FIRSTBANK': {
    name: 'First Bank of Nigeria',
    code: '011',
    ussdPrefix: '*894*',
    ussdPattern: (amt, acc) => `*894*${amt}*${acc}#`,
    appScheme: 'firstmobile://',
    webUrl: 'https://www.firstbanknigeria.com/',
  },
  'UBA': {
    name: 'United Bank for Africa (UBA)',
    code: '033',
    ussdPrefix: '*919*',
    ussdPattern: (amt, acc) => `*919*3*${acc}*${amt}#`,
    appScheme: 'ubamobile://',
    webUrl: 'https://www.ubagroup.com/',
  },
  'STANBIC': {
    name: 'Stanbic IBTC Bank',
    code: '221',
    ussdPrefix: '*909*',
    ussdPattern: (amt, acc) => `*909*${amt}*${acc}#`,
    appScheme: 'stanbic://',
    webUrl: 'https://www.stanbicibtc.com/',
  },
  'FIDELITY': {
    name: 'Fidelity Bank',
    code: '070',
    ussdPrefix: '*770*',
    ussdPattern: (amt, acc) => `*770*${acc}*${amt}#`,
    appScheme: 'fidelity://',
    webUrl: 'https://www.fidelitybank.ng/',
  },
  'STERLING': {
    name: 'Sterling Bank',
    code: '232',
    ussdPrefix: '*822*',
    ussdPattern: (amt, acc) => `*822*${amt}*${acc}#`,
    appScheme: 'sterling://',
    webUrl: 'https://www.sterling.ng/',
  },
  'FCMB': {
    name: 'First City Monument Bank (FCMB)',
    code: '214',
    ussdPrefix: '*329*',
    ussdPattern: (amt, acc) => `*329*${amt}*${acc}#`,
    appScheme: 'fcmb://',
    webUrl: 'https://www.fcmb.com/',
  },
  'WEMA': {
    name: 'Wema Bank (ALAT)',
    code: '035',
    ussdPrefix: '*945*',
    ussdPattern: (amt, acc) => `*945*${acc}*${amt}#`,
    appScheme: 'alat://',
    webUrl: 'https://alat.ng/',
  },
};

/**
 * Identify closest Nigerian bank configuration by name or code
 */
export function matchBank(bankNameOrCode: string): NigerianBankInfo | null {
  if (!bankNameOrCode) return null;
  const q = bankNameOrCode.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const [key, b] of Object.entries(NIGERIAN_BANKS)) {
    const k = key.toLowerCase();
    const n = b.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (q === k || q === b.code || n.includes(q) || q.includes(k)) {
      return b;
    }
  }
  return null;
}

/**
 * Generate disbursement deep link payload
 */
export function generateDisbursementLinks(params: {
  amountNaira: number;
  accountNumber: string;
  accountName: string;
  bankName: string;
  reference: string;
  baseUrl?: string;
}) {
  const { amountNaira, accountNumber, accountName, bankName, reference } = params;
  const baseUrl = params.baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://bemserp.work');

  const bankInfo = matchBank(bankName);
  const ussdString = bankInfo?.ussdPattern
    ? bankInfo.ussdPattern(Math.round(amountNaira), accountNumber.trim())
    : null;

  const appScheme = bankInfo?.appScheme || null;
  const webPortalUrl = `${baseUrl}/pay/${encodeURIComponent(reference)}`;

  return {
    beneficiaryName: accountName,
    accountNumber: accountNumber.trim(),
    bankName: bankInfo?.name || bankName,
    bankCode: bankInfo?.code || null,
    amount: amountNaira,
    formattedAmount: `₦${amountNaira.toLocaleString()}`,
    reference,
    quickPayUrl: webPortalUrl,
    ussdDialer: ussdString ? `tel:${encodeURIComponent(ussdString)}` : null,
    ussdRaw: ussdString,
    appScheme,
    bankingApps: [
      { name: 'GTWorld (GTBank)', scheme: 'gtworld://', icon: 'gtb' },
      { name: 'Kuda Bank', scheme: 'kuda://', icon: 'kuda' },
      { name: 'OPay', scheme: 'opay://', icon: 'opay' },
      { name: 'Moniepoint', scheme: 'moniepoint://', icon: 'moniepoint' },
      { name: 'Zenith Bank', scheme: 'zenithbank://', icon: 'zenith' },
      { name: 'Access More', scheme: 'accessmore://', icon: 'access' },
      { name: 'FirstMobile (FirstBank)', scheme: 'firstmobile://', icon: 'firstbank' },
      { name: 'PalmPay', scheme: 'palmpay://', icon: 'palmpay' },
      { name: 'ALAT (Wema)', scheme: 'alat://', icon: 'wema' },
      { name: 'UBA Mobile', scheme: 'ubamobile://', icon: 'uba' },
    ],
  };
}
