import {walletHttp} from '@/lib/wallet/http';
import {verifyVendorBank} from '@/lib/wallet/vendor-bank';
export async function POST(r:Request,{params}:{params:Promise<{id:string}>}){return walletHttp(r,async actor=>verifyVendorBank(actor,(await params).id,await r.json()));}
