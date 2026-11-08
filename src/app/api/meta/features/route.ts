import { superAdminGmdAccessEnabled } from '@/lib/gmd-access';
import {NextResponse} from 'next/server';
import {walletEnabled} from '@/lib/wallet/core';
export const dynamic='force-dynamic';
export async function GET(){return NextResponse.json({walletMode:walletEnabled(),superAdminGmdAccess:superAdminGmdAccessEnabled()},{headers:{'Cache-Control':'no-store'}});}
