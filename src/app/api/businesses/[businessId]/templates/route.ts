import { NextResponse } from 'next/server';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  return NextResponse.json({
    imported: ['tpl-fund-request-standard', 'tpl-accountability-72h'],
    updates: []
  });
}
