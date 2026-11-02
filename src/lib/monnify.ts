/**
 * Monnify Integration Utility for BEMS Fund Request & Accountability System
 * Handles secure OAuth token generation, live bank listing, and real-time NUBAN validation.
 */

const MONNIFY_BASE_URL = process.env.MONNIFY_BASE_URL || 'https://api.monnify.com';
const MONNIFY_API_KEY = process.env.MONNIFY_API_KEY || 'MK_PROD_F5C1ZT8534';
const MONNIFY_SECRET_KEY = process.env.MONNIFY_SECRET_KEY || 'HCXD21T8FD0MLHJKQ9H7FE40F83Q4UJ7';

let cachedToken: { token: string; expiresAt: number } | null = null;

export const STANDARD_NIGERIAN_BANKS = [
  { name: 'Access Bank', code: '044' },
  { name: 'Access Bank (Diamond)', code: '063' },
  { name: 'Citibank Nigeria', code: '023' },
  { name: 'Ecobank Nigeria', code: '050' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'First City Monument Bank (FCMB)', code: '214' },
  { name: 'Guaranty Trust Bank (GTBank)', code: '058' },
  { name: 'Heritage Bank', code: '030' },
  { name: 'Jaiz Bank', code: '301' },
  { name: 'Keystone Bank', code: '082' },
  { name: 'Kuda Bank', code: '50211' },
  { name: 'Moniepoint MFB', code: '50515' },
  { name: 'OPay Digital Services', code: '999992' },
  { name: 'Optimus Bank', code: '107' },
  { name: 'PalmPay', code: '999991' },
  { name: 'Parallex Bank', code: '526' },
  { name: 'Polaris Bank', code: '076' },
  { name: 'Premium Trust Bank', code: '105' },
  { name: 'Providus Bank', code: '101' },
  { name: 'Rubies MFB', code: '125' },
  { name: 'Stanbic IBTC Bank', code: '221' },
  { name: 'Standard Chartered Bank', code: '068' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'Suntrust Bank', code: '100' },
  { name: 'TAJ Bank', code: '302' },
  { name: 'Titan Trust Bank', code: '102' },
  { name: 'Union Bank of Nigeria', code: '032' },
  { name: 'United Bank for Africa (UBA)', code: '033' },
  { name: 'Unity Bank', code: '215' },
  { name: 'VFD Microfinance Bank', code: '566' },
  { name: 'Wema Bank / ALAT', code: '035' },
  { name: 'Zenith Bank', code: '057' },
];

export const BANK_NAME_TO_CODE: Record<string, string> = {
  'access bank': '044',
  'access bank plc': '044',
  'access': '044',
  'diamond bank': '063',
  'citibank': '023',
  'ecobank': '050',
  'ecobank nigeria': '050',
  'fidelity bank': '070',
  'fidelity bank plc': '070',
  'fidelity': '070',
  'first bank': '011',
  'first bank of nigeria': '011',
  'fbn': '011',
  'fcmb': '214',
  'first city monument bank': '214',
  'first city monument bank (fcmb)': '214',
  'gtbank': '058',
  'gtb': '058',
  'guaranty trust bank': '058',
  'guaranty trust bank (gtbank)': '058',
  'heritage bank': '030',
  'jaiz bank': '301',
  'keystone bank': '082',
  'kuda': '50211',
  'kuda bank': '50211',
  'kuda microfinance bank': '50211',
  'moniepoint': '50515',
  'moniepoint mfb': '50515',
  'moniepoint microfinance bank': '50515',
  'opay': '999992',
  'opay digital services': '999992',
  'optimus bank': '107',
  'palmpay': '999991',
  'parallex bank': '526',
  'polaris bank': '076',
  'premium trust bank': '105',
  'providus bank': '101',
  'providus': '101',
  'rubies mfb': '125',
  'stanbic': '221',
  'stanbic ibtc': '221',
  'stanbic ibtc bank': '221',
  'standard chartered': '068',
  'sterling bank': '232',
  'sterling': '232',
  'suntrust bank': '100',
  'taj bank': '302',
  'titan trust bank': '102',
  'union bank': '032',
  'union bank of nigeria': '032',
  'uba': '033',
  'united bank for africa': '033',
  'united bank for africa (uba)': '033',
  'unity bank': '215',
  'vfd': '566',
  'vfd microfinance bank': '566',
  'wema': '035',
  'wema bank': '035',
  'wema bank / alat': '035',
  'wema bank plc': '035',
  'alat': '035',
  'zenith': '057',
  'zenith bank': '057',
  'zenith bank plc': '057',
};

/**
 * Resolve bank code from name or code string
 */
export function resolveBankCode(bankNameOrCode?: string): string | null {
  if (!bankNameOrCode) return null;
  const raw = bankNameOrCode.trim();
  // If it's already a 3 to 6 digit numeric code
  if (/^\d{3,6}$/.test(raw)) return raw;

  // Check parenthesized code e.g. "Access Bank (044)"
  const match = raw.match(/\((\d{3,6})\)/);
  if (match) return match[1];

  const lower = raw.toLowerCase();
  if (BANK_NAME_TO_CODE[lower]) return BANK_NAME_TO_CODE[lower];

  // Partial match
  for (const [key, val] of Object.entries(BANK_NAME_TO_CODE)) {
    if (lower.includes(key) || key.includes(lower)) {
      return val;
    }
  }

  return null;
}

/**
 * 1. Generate / Retrieve Monnify OAuth Bearer Token
 */
export async function getMonnifyToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60000) {
    return cachedToken.token;
  }

  if (!MONNIFY_API_KEY || !MONNIFY_SECRET_KEY) {
    throw new Error('Monnify API Key and Secret Key are required.');
  }

  const basicAuth = Buffer.from(`${MONNIFY_API_KEY}:${MONNIFY_SECRET_KEY}`).toString('base64');
  const res = await fetch(`${MONNIFY_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Monnify authentication failed (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  if (!data?.requestSuccessful || !data?.responseBody?.accessToken) {
    throw new Error(data?.responseMessage || 'Failed to authenticate with Monnify');
  }

  const token = data.responseBody.accessToken as string;
  const expiresInSec = Number(data.responseBody.expiresIn) || 3500;
  cachedToken = {
    token,
    expiresAt: now + expiresInSec * 1000,
  };

  return token;
}

/**
 * 2. Validate Nigerian Bank Account Number & Retrieve Account Name
 * GET /api/v2/disbursements/account/validate
 */
export async function validateMonnifyBankAccount(
  accountNumber: string,
  bankCodeOrName: string
): Promise<{
  accountNumber: string;
  accountName: string;
  bankCode: string;
}> {
  const cleanAcct = String(accountNumber || '').trim().replace(/\D/g, '');
  if (cleanAcct.length !== 10) {
    throw new Error('Valid 10-digit Nigerian NUBAN account number is required');
  }

  const targetCode = resolveBankCode(bankCodeOrName);
  if (!targetCode) {
    throw new Error(`Unable to determine bank code for "${bankCodeOrName}"`);
  }

  // Fintech / NIP Candidate routing: some fintechs use NIP 6-digit routing codes
  const candidateCodes = [targetCode];
  if (targetCode === '999992') candidateCodes.push('090110', '100004', '304'); // OPay
  if (targetCode === '999991') candidateCodes.push('090175', '100033'); // PalmPay
  if (targetCode === '50211') candidateCodes.push('090267'); // Kuda
  if (targetCode === '50515') candidateCodes.push('090405'); // Moniepoint

  const token = await getMonnifyToken();
  let lastError: Error | null = null;

  for (const code of candidateCodes) {
    try {
      const url = `${MONNIFY_BASE_URL}/api/v2/disbursements/account/validate?accountNumber=${encodeURIComponent(
        cleanAcct
      )}&bankCode=${encodeURIComponent(code)}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (data?.requestSuccessful && data?.responseBody?.accountName) {
        return {
          accountNumber: cleanAcct,
          accountName: String(data.responseBody.accountName).trim(),
          bankCode: code,
        };
      } else if (data?.responseMessage) {
        lastError = new Error(data.responseMessage);
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error('Account validation failed. Please check the account number and bank.');
}
