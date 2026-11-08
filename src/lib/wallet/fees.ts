import {Prisma} from '@prisma/client';
import {WalletError,minorUnits} from './core';
export async function requiredFeeReserve(tx:Prisma.TransactionClient,extraCredits:Array<{employeeId:string|null;amountMinor:bigint}>=[],extraDirectFee=BigInt(0)){
 if(!process.env.BEMS_WALLET_MAX_TRANSFER_FEE_MINOR)throw new WalletError('FEE_POLICY_REQUIRED','Configure the verified maximum company transfer fee before releasing funds.',503);
 const fee=minorUnits(process.env.BEMS_WALLET_MAX_TRANSFER_FEE_MINOR),minimum=minorUnits(process.env.BEMS_WALLET_MIN_WITHDRAWAL_MINOR||'10000');
 const rows=await tx.$queryRaw<Array<{employeeId:string;amount:bigint}>>`SELECT "employeeId",sum("availableMinor")::bigint AS "amount" FROM "WalletCreditLot" GROUP BY "employeeId"`;
 const amounts=new Map(rows.map(r=>[r.employeeId,r.amount]));
 for(const c of extraCredits)if(c.employeeId)amounts.set(c.employeeId,(amounts.get(c.employeeId)||BigInt(0))+c.amountMinor);
 const[held]=await tx.$queryRaw<Array<{amount:bigint}>>`SELECT COALESCE(sum("feeLimitMinor"),0)::bigint AS "amount" FROM "WalletWithdrawal" WHERE "status" IN ('HELD','SUBMITTING','PENDING','UNKNOWN')`;
 // Published minimum withdrawal bounds the maximum number of future principal
 // withdrawals. Reserve fees for that worst case, not just the next employee.
 return [...amounts.values()].reduce((n,amount)=>n+(amount/minimum)*fee,held.amount+extraDirectFee);
}

/** A reserve target can use free cash, never manufacture a deficit by refilling spent fees. */
export function backedFeeReserve(available:bigint,commitments:bigint,target:bigint,required:bigint){
 const capacity=available>commitments?available-commitments:BigInt(0);
 if(required>capacity)return required; // A real shortfall remains visible and blocks commitments.
 const desired=target>required?target:required;
 return desired>capacity?capacity:desired;
}
