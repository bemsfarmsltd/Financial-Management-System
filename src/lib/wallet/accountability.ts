import {Prisma} from '@prisma/client';
import {walletEnabled} from './core';
export async function walletRequestFunding(tx:Prisma.TransactionClient,requestId:string){
 if(!walletEnabled())return null;
 const[s]=await tx.$queryRaw<any[]>`SELECT count(*)::integer AS "count",COALESCE(sum("amountMinor"),0)::bigint AS "creditedMinor",COALESCE(sum("settledMinor"),0)::bigint AS "settledMinor",COALESCE(sum("availableMinor"),0)::bigint AS "availableMinor",COALESCE(sum("heldMinor"),0)::bigint AS "heldMinor",COALESCE(sum("returnedMinor"),0)::bigint AS "returnedMinor" FROM "WalletCreditLot" WHERE "sourceType"='REQUEST' AND "sourceId"=${requestId}`;
 if(s.count)return s;
 const[w]=await tx.$queryRaw<any[]>`SELECT * FROM "WalletWithdrawal" WHERE "targetType"='VENDOR' AND "requestId"=${requestId} ORDER BY "createdAt" DESC LIMIT 1`;
 if(!w)return null;
 return {count:1,creditedMinor:w.amountMinor,settledMinor:w.status==='SUCCEEDED'?w.amountMinor:BigInt(0),availableMinor:BigInt(0),heldMinor:['HELD','SUBMITTING','PENDING','UNKNOWN'].includes(w.status)?w.amountMinor:BigInt(0),returnedMinor:['FAILED','REVERSED'].includes(w.status)?w.amountMinor:BigInt(0),vendor:true};
}
