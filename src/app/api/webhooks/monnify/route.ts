import { NextResponse } from 'next/server';
import { receiveMonnifyEvent } from '@/lib/wallet/webhooks';
import { WalletError } from '@/lib/wallet/core';
import { checkRateLimit,getClientIp } from '@/lib/rate-limiter';
export async function POST(request:Request){try{const limit=await checkRateLimit('monnify-hook:'+getClientIp(request),{windowMs:60000,maxAttempts:120});if(!limit.allowed)return NextResponse.json({error:'Rate limited'},{status:429});return NextResponse.json(await receiveMonnifyEvent(await request.text(),request.headers.get('monnify-signature')));}catch(e){return NextResponse.json({error:e instanceof WalletError?e.code:'WEBHOOK_FAILED'},{status:e instanceof WalletError?e.status:500});}}
