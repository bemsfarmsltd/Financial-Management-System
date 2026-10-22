import { NextResponse } from 'next/server';
import { destroyEmployeeSession } from '@/lib/auth';

function getPublicRedirectUrl(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host') || 'bemserp.work';
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const cleanHost = (host.includes('0.0.0.0') || host.includes('localhost') && process.env.NODE_ENV === 'production')
    ? 'bemserp.work'
    : host;
  return `${proto}://${cleanHost}/`;
}

function makeLogoutResponse(redirectUrl?: string) {
  const res = redirectUrl
    ? NextResponse.redirect(redirectUrl)
    : NextResponse.json({ success: true });

  const clearOptions = {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };

  res.cookies.set('bems_session', '', clearOptions);
  res.cookies.delete('bems_session');

  // Explicit headers to guarantee Chrome, Safari, Firefox completely clear it:
  res.headers.append(
    'Set-Cookie',
    'bems_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax; Secure'
  );
  res.headers.append(
    'Set-Cookie',
    'bems_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax'
  );

  return res;
}

export async function POST() {
  await destroyEmployeeSession();
  return makeLogoutResponse();
}

export async function GET(request: Request) {
  await destroyEmployeeSession();
  const targetUrl = getPublicRedirectUrl(request);
  return makeLogoutResponse(targetUrl);
}
