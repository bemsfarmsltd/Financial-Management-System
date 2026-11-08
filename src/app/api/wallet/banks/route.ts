import {walletHttp} from '@/lib/wallet/http';
import {requireWallet} from '@/lib/wallet/core';
import {listMonnifyBanks} from '@/lib/wallet/provider';
export async function GET(r:Request){return walletHttp(r,async()=>{requireWallet();return {banks:await listMonnifyBanks()};});}
