import { NextResponse } from 'next/server';
import { destroyEmployeeSession } from '@/lib/auth';

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
  const resUrl = new URL('/', request.url);
  return makeLogoutResponse(resUrl.toString());
}
