import {NextResponse} from 'next/server';
import {walletEnabled} from '@/lib/wallet/core';
export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json({walletMode:walletEnabled()},{headers:{'Cache-Control':'no-store'}});}
