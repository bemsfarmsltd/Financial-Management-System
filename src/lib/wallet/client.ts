/** Browser transport: reads use GET; every payload-bearing operation remains a mutation. */
export async function walletApi(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST', idempotencyKey?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  let response: Response;
  try {
    response = await fetch(`/api/wallet/${path}`, {
      method, headers, credentials: 'same-origin', cache: 'no-store',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch { throw new Error('Unable to reach the wallet service. Check your connection and try again.'); }
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof json?.message === 'string' ? json.message : typeof json?.error === 'string' ? json.error : null;
    throw new Error(message || (response.status === 401 ? 'Sign in again to access wallets.' : `The wallet request failed (HTTP ${response.status}). Please retry or contact support.`));
  }
  if (!json || typeof json !== 'object') throw new Error('The wallet service returned an unexpected response. Refresh the page and try again.');
  return json;
}
