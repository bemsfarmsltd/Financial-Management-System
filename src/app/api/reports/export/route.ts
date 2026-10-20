import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'FINANCE_CONTROLLER', 'AUDITOR'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Not permitted.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { report_type, format, title } = body;

    const reportId = `rep_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return NextResponse.json({
      ok: true,
      report_id: reportId,
      title: title || `${report_type || 'Executive'} Export`,
      format: format || 'csv',
      download_url: `/api/audit?export=true&format=${format || 'csv'}`,
      expires_at: expiresAt,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
