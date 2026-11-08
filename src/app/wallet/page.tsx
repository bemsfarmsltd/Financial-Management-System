import { redirect } from 'next/navigation';
import { getAuthenticatedEmployee } from '@/lib/auth';
import WalletView from '@/components/wallet/WalletView';
export const dynamic = 'force-dynamic';
export default async function WalletPage() { const actor=await getAuthenticatedEmployee();if(!actor)redirect('/finance');if(actor.role!=='STAFF')redirect('/wallet/funding');return <WalletView />; }
