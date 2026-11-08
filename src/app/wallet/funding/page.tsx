import { redirect } from 'next/navigation';
import { getAuthenticatedEmployee } from '@/lib/auth';
import FundingView from '@/components/wallet/FundingView';
export const dynamic = 'force-dynamic';
export default async function FundingPage() { const actor = await getAuthenticatedEmployee(); if (!actor || !['GMD','SUPER_ADMIN','SYSTEM_ADMIN'].includes(actor.role)) redirect('/finance'); return <FundingView />; }
