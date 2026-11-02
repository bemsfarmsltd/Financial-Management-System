import { NextResponse } from 'next/server';
import { STANDARD_NIGERIAN_BANKS } from '@/lib/monnify';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'success',
    count: STANDARD_NIGERIAN_BANKS.length,
    banks: STANDARD_NIGERIAN_BANKS,
  });
}
