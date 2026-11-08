import { checkRateLimit } from '@/lib/rate-limiter';
import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { WalletError } from './core';
export async function walletHttp(request: Request, work: (actor: NonNullable<Awaited<ReturnType<typeof getAuthenticatedEmployee>>>) => Promise<unknown>) {
  try {
    if (request.headers.get('x-bems-delegation-token') || request.headers.get('x-delegation-token') || request.headers.get('x-api-key')) throw new WalletError('HUMAN_SESSION_REQUIRED', 'Use an authenticated human session.', 403);
    if (!['GET','HEAD'].includes(request.method)) {
      // Browsers must prove same origin. Native requests use bearer sessions;
      // bearer-less cookie mutations without an Origin fail closed.
      const origin = request.headers.get('origin');
      const bearer = /^Bearer\s+\S+$/i.test(request.headers.get('authorization') || '');
      const canonical = process.env.NEXT_PUBLIC_APP_URL;
      if ((origin && origin !== new URL(request.url).origin && origin !== canonical) || (!origin && !bearer)) throw new WalletError('ORIGIN_NOT_ALLOWED', 'A same-origin browser or authenticated native request is required.', 403);
    }
    const actor = await getAuthenticatedEmployee(request, { disallowServiceToken: true });
    if (!actor) throw new WalletError('SIGN_IN_REQUIRED', 'Sign in to access wallets.', 401);
    const limit = await checkRateLimit('wallet:' + actor.id + ':' + request.method, { windowMs: 60000, maxAttempts: request.method === 'GET' ? 60 : 20 });
    if (!limit.allowed) throw new WalletError('RATE_LIMITED', 'Too many wallet requests. Try again shortly.', 429);
    return NextResponse.json(await work(actor), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const known = error instanceof WalletError;
    if (!known) console.error('Wallet operation failed', { name: error instanceof Error ? error.name : 'UnknownError' });
    return NextResponse.json({ error: known ? error.message : 'The wallet operation could not be completed.', code: known ? error.code : 'WALLET_OPERATION_FAILED' }, { status: known ? error.status : 500, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
