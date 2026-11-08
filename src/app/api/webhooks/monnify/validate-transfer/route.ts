import { NextResponse } from 'next/server';
import { validateMonnifyIntent } from '@/lib/wallet/webhooks';
import { WalletError } from '@/lib/wallet/core';
export async function POST(request:Request){try{return NextResponse.json(await validateMonnifyIntent(await request.json(),request.headers.get('x-monnify-signature'),request.headers.get('x-monnify-timestamp')));}catch(e){return NextResponse.json({error:e instanceof WalletError?e.code:'VALIDATION_FAILED'},{status:e instanceof WalletError?e.status:500});}}
